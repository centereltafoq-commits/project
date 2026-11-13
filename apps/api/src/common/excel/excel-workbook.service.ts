import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { UploadedMulterFile } from '../types/multer.types';
import type {
  ExcelColumnSpec,
  ParsedExcelRow,
  ParsedExcelSheet,
  ParseSheetOptions,
  WorkbookBuildSpec,
} from './excel-import.types';

const DEFAULT_MAX_IMPORT_ROWS = 2000;
const EXCEL_BIDI_AND_BOM_REGEX = /[\u200E\u200F\u202A-\u202E\uFEFF]/g;
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

@Injectable()
export class ExcelWorkbookService {
  normalizeArabicDigits(input: string): string {
    let result = '';
    for (const ch of input) {
      const arabicIdx = ARABIC_INDIC_DIGITS.indexOf(ch);
      if (arabicIdx !== -1) {
        result += String(arabicIdx);
        continue;
      }
      const easternIdx = EASTERN_ARABIC_DIGITS.indexOf(ch);
      if (easternIdx !== -1) {
        result += String(easternIdx);
        continue;
      }
      result += ch;
    }
    return result;
  }

  normalizeCellText(value: unknown): string {
    const scalar = this.extractCellValue(value);
    if (scalar === null || scalar === undefined) {
      return '';
    }
    if (scalar instanceof Date) {
      return this.formatUtcDate(scalar) ?? '';
    }
    return String(scalar)
      .replace(EXCEL_BIDI_AND_BOM_REGEX, '')
      .replace(/\u00A0/g, ' ')
      .trim();
  }

  normalizePhoneText(value: unknown): string {
    const raw = this.normalizeCellText(value);
    if (!raw) {
      return '';
    }
    const asciiDigits = this.normalizeArabicDigits(raw);
    return asciiDigits.replace(/[\s()-]/g, '').trim();
  }

  normalizeDateCell(value: unknown): string | null {
    const scalar = this.extractCellValue(value);
    if (scalar === null || scalar === undefined) {
      return null;
    }

    if (scalar instanceof Date) {
      return this.formatUtcDate(scalar);
    }

    if (typeof scalar === 'number' && Number.isFinite(scalar) && scalar > 20000 && scalar < 100000) {
      const utcMs = Date.UTC(1899, 11, 30) + Math.round(scalar) * 86_400_000;
      return this.formatUtcDate(new Date(utcMs));
    }

    const text = this.normalizeArabicDigits(this.normalizeCellText(scalar));
    if (!text) {
      return null;
    }

    // YYYY-MM-DD or YYYY/M/D
    const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
    if (isoMatch) {
      return this.buildValidatedIsoDate(
        Number(isoMatch[1]),
        Number(isoMatch[2]),
        Number(isoMatch[3]),
      );
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(text);
    if (dmyMatch) {
      return this.buildValidatedIsoDate(
        Number(dmyMatch[3]),
        Number(dmyMatch[2]),
        Number(dmyMatch[1]),
      );
    }

    return null;
  }

  async buildWorkbookBuffer(spec: WorkbookBuildSpec): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EduCenter ERP';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(spec.sheetName, {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });

    worksheet.columns = spec.columns.map((col) => ({
      key: col.key,
      header: col.header,
      width: col.width ?? 22,
      style: col.numFmt ? { numFmt: col.numFmt } : undefined,
    }));

    this.styleHeaderRow(worksheet, spec.columns.length);

    if (spec.columns.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: spec.columns.length },
      };
    }

    for (const rowData of spec.rows) {
      const normalizedRow: Record<string, unknown> = {};
      for (const col of spec.columns) {
        const val = rowData[col.key];
        normalizedRow[col.key] =
          col.numFmt === '@' ? (val === null || val === undefined ? '' : String(val)) : (val ?? '');
      }
      const addedRow = worksheet.addRow(normalizedRow);
      this.styleDataRow(addedRow, spec.columns);
    }

    const instructionsSheet = spec.instructionsSheet
      ? this.buildInstructionsWorksheet(workbook, spec.instructionsSheet)
      : null;

    const validationEndRow = spec.validationRowCount ?? Math.max(500, spec.rows.length + 200);
    this.applyDropdownValidations(
      worksheet,
      spec.columns,
      validationEndRow,
      instructionsSheet,
    );

    const output = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(output) ? output : Buffer.from(output);
  }

  resolveColumnHeaders<TField extends string>(
    headers: string[],
    aliases: Record<TField, string[]>,
  ): Partial<Record<TField, string>> {
    const normalizedMap = new Map<string, string>();
    for (const h of headers) {
      normalizedMap.set(h.replace(/\*/g, '').trim().toLowerCase(), h);
    }

    const result: Partial<Record<TField, string>> = {};
    (Object.keys(aliases) as TField[]).forEach((field) => {
      for (const alias of aliases[field]) {
        const key = alias.replace(/\*/g, '').trim().toLowerCase();
        const found = normalizedMap.get(key);
        if (found) {
          result[field] = found;
          break;
        }
      }
    });
    return result;
  }

  async allocateUniqueCodes(
    explicitCodes: Array<string | null>,
    prefix: string,
    findExistingCodes: (candidates: string[]) => Promise<Set<string>>,
  ): Promise<string[]> {
    const reserved = new Set<string>(
      explicitCodes
        .filter((code): code is string => Boolean(code))
        .map((code) => code.trim().toUpperCase()),
    );

    const unassignedIndices: number[] = [];
    const results = explicitCodes.map((code, idx) => {
      if (code && code.trim()) {
        return code.trim();
      }
      unassignedIndices.push(idx);
      return '';
    });

    if (unassignedIndices.length === 0) {
      return results;
    }

    const candidates: string[] = [];
    for (let i = 0; i < unassignedIndices.length; i++) {
      let candidate = '';
      for (let attempt = 0; attempt < 25; attempt++) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        const attemptCode = `${prefix}${rand}`;
        if (!reserved.has(attemptCode.toUpperCase())) {
          candidate = attemptCode;
          reserved.add(attemptCode.toUpperCase());
          break;
        }
      }
      if (!candidate) {
        candidate = `${prefix}${Date.now().toString().slice(-4)}${i}`;
        reserved.add(candidate.toUpperCase());
      }
      candidates.push(candidate);
    }

    const existingCodes = await findExistingCodes(candidates);
    unassignedIndices.forEach((targetIdx, idx) => {
      let code = candidates[idx];
      if (existingCodes.has(code.toUpperCase())) {
        let suffix = 1;
        let replacement = `${prefix}${Date.now().toString().slice(-4)}${idx}${suffix}`;
        while (existingCodes.has(replacement.toUpperCase()) || reserved.has(replacement.toUpperCase())) {
          suffix += 1;
          replacement = `${prefix}${Date.now().toString().slice(-4)}${idx}${suffix}`;
        }
        reserved.add(replacement.toUpperCase());
        code = replacement;
      }
      results[targetIdx] = code;
    });

    return results;
  }

  async parseUploadedWorkbook(
    file: UploadedMulterFile | undefined,
    options: ParseSheetOptions = {},
  ): Promise<ParsedExcelSheet> {
    this.assertValidXlsxFile(file);

    const maxRows = options.maxRows ?? DEFAULT_MAX_IMPORT_ROWS;
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException(
        'تعذر قراءة ملف Excel. تأكد من أن الملف بصيغة .xlsx صالحة وغير تالف أو محمي بكلمة مرور.',
      );
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('ملف Excel لا يحتوي على أي أوراق عمل.');
    }

    const headerRow = worksheet.getRow(1);
    const columnMappings: Array<{ colNumber: number; header: string }> = [];
    const seenHeaders = new Set<string>();
    const colCount = Math.max(worksheet.columnCount, headerRow.cellCount);

    for (let colIdx = 1; colIdx <= colCount; colIdx++) {
      const rawHeader = this.normalizeCellText(headerRow.getCell(colIdx).value);
      if (!rawHeader) {
        continue;
      }
      if (seenHeaders.has(rawHeader)) {
        throw new BadRequestException(`يوجد عمود مكرر في الصف الأول: "${rawHeader}"`);
      }
      seenHeaders.add(rawHeader);
      columnMappings.push({ colNumber: colIdx, header: rawHeader });
    }

    if (columnMappings.length === 0) {
      throw new BadRequestException('الصف الأول في ملف Excel فارغ ولا يحتوي على عناوين الأعمدة.');
    }

    const rows: ParsedExcelRow[] = [];
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const cells: Record<string, unknown> = {};
      let hasAnyValue = false;

      for (const mapping of columnMappings) {
        const scalar = this.extractCellValue(row.getCell(mapping.colNumber).value);
        if (scalar !== null && scalar !== undefined && String(scalar).trim() !== '') {
          hasAnyValue = true;
        }
        cells[mapping.header] = scalar;
      }

      if (!hasAnyValue) {
        continue;
      }

      rows.push({ rowNumber, cells });
      if (rows.length > maxRows) {
        throw new BadRequestException(
          `تجاوز الملف الحد الأقصى المسموح للاستيراد في المرة الواحدة (${maxRows} صف). يرجى تقسيم الملف إلى دفعات أصغر.`,
        );
      }
    }

    return {
      sheetName: worksheet.name,
      headers: columnMappings.map((item) => item.header),
      rows,
    };
  }

  private assertValidXlsxFile(file: UploadedMulterFile | undefined): asserts file is UploadedMulterFile {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('يرجى إرفاق ملف Excel بصيغة .xlsx.');
    }

    const lowerName = (file.originalname ?? '').toLowerCase();
    if (!lowerName.endsWith('.xlsx')) {
      throw new BadRequestException('صيغة الملف غير مدعومة. يرجى رفع ملف Excel بامتداد .xlsx فقط.');
    }

    // XLSX files are OOXML ZIP containers beginning with PK\x03\x04
    const hasZipSignature =
      file.buffer.length >= 4 &&
      file.buffer[0] === 0x50 &&
      file.buffer[1] === 0x4b &&
      file.buffer[2] === 0x03 &&
      file.buffer[3] === 0x04;

    if (!hasZipSignature) {
      throw new BadRequestException('الملف المرفق ليس ملف .xlsx صالحاً.');
    }
  }

  private extractCellValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'object' || value instanceof Date) {
      return value;
    }

    const record = value as Record<string, unknown>;

    if ('richText' in record && Array.isArray(record.richText)) {
      return record.richText
        .map((part) => (part && typeof part === 'object' && 'text' in part ? String(part.text ?? '') : ''))
        .join('');
    }

    if ('text' in record && typeof record.text !== 'object') {
      return record.text ?? null;
    }

    if ('result' in record) {
      return this.extractCellValue(record.result);
    }

    if ('hyperlink' in record && 'text' in record) {
      return record.text ?? record.hyperlink ?? null;
    }

    return String(value);
  }

  private styleHeaderRow(worksheet: ExcelJS.Worksheet, columnCount: number) {
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    for (let colIdx = 1; colIdx <= columnCount; colIdx++) {
      const cell = headerRow.getCell(colIdx);
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    }
  }

  private styleDataRow(row: ExcelJS.Row, columns: ExcelColumnSpec[]) {
    row.height = 22;
    columns.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);
      if (col.numFmt) {
        cell.numFmt = col.numFmt;
      }
      cell.font = { size: 11, name: 'Arial' };
      cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: false };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  }

  private buildInstructionsWorksheet(
    workbook: ExcelJS.Workbook,
    spec: NonNullable<WorkbookBuildSpec['instructionsSheet']>,
  ): ExcelJS.Worksheet {
    const sheet = workbook.addWorksheet(spec.sheetName ?? 'التعليمات والأمثلة', {
      views: [{ rightToLeft: true }],
    });

    sheet.getColumn(1).width = 32;
    sheet.getColumn(2).width = 24;
    sheet.getColumn(3).width = 24;
    sheet.getColumn(4).width = 24;

    const titleRow = sheet.addRow([spec.title]);
    titleRow.height = 30;
    const titleCell = titleRow.getCell(1);
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' }, name: 'Arial' };

    sheet.addRow([]);

    spec.lines.forEach((line, idx) => {
      const row = sheet.addRow([`${idx + 1}. ${line}`]);
      row.getCell(1).font = { size: 11, name: 'Arial' };
    });

    if (spec.sampleHeaders && spec.sampleRow) {
      sheet.addRow([]);
      const sampleTitleRow = sheet.addRow(['نموذج توضيحي للصفوف (للقراءة فقط — يتم إدخال البيانات الفعلية في الورقة الأولى):']);
      sampleTitleRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF0F766E' }, name: 'Arial' };

      const headerRow = sheet.addRow(spec.sampleHeaders);
      spec.sampleHeaders.forEach((_, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
        sheet.getColumn(idx + 1).width = Math.max(sheet.getColumn(idx + 1).width ?? 20, 22);
      });

      const exampleRow = sheet.addRow(spec.sampleRow);
      spec.sampleRow.forEach((_, idx) => {
        const cell = exampleRow.getCell(idx + 1);
        cell.numFmt = '@';
        cell.font = { size: 10, name: 'Arial' };
      });
    }

    if (spec.referenceLists && spec.referenceLists.length > 0) {
      for (const refList of spec.referenceLists) {
        sheet.addRow([]);
        const refHeader = sheet.addRow([refList.title]);
        refHeader.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' }, name: 'Arial' };
        for (const item of refList.items) {
          const itemRow = sheet.addRow([item]);
          itemRow.getCell(1).font = { size: 10, name: 'Arial' };
        }
      }
    }

    return sheet;
  }

  private applyDropdownValidations(
    worksheet: ExcelJS.Worksheet,
    columns: ExcelColumnSpec[],
    endRow: number,
    instructionsSheet: ExcelJS.Worksheet | null,
  ) {
    let refColumnCursor = 12; // Column L+ in instructions sheet for long dropdown lists

    columns.forEach((col, colIdx) => {
      const options = col.dropdownValues?.filter((item) => item.trim().length > 0) ?? [];
      if (options.length === 0) {
        return;
      }

      const columnLetter = this.columnIndexToLetter(colIdx + 1);
      const inlineList = `"${options.map((v) => v.replace(/"/g, '')).join(',')}"`;

      let formula = inlineList;
      if (inlineList.length > 250 && instructionsSheet) {
        const refCol = instructionsSheet.getColumn(refColumnCursor);
        const refLetter = this.columnIndexToLetter(refColumnCursor);
        refCol.hidden = true;
        options.forEach((opt, optIdx) => {
          instructionsSheet.getCell(optIdx + 1, refColumnCursor).value = opt;
        });
        formula = `'${instructionsSheet.name}'!$${refLetter}$1:$${refLetter}$${options.length}`;
        refColumnCursor += 1;
      } else if (inlineList.length > 250) {
        return;
      }

      for (let rowIdx = 2; rowIdx <= endRow; rowIdx++) {
        worksheet.getCell(`${columnLetter}${rowIdx}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'قيمة غير مطابقة',
          error: 'يفضل اختيار قيمة من القائمة المنسدلة لتجنب أخطاء الاستيراد.',
        };
      }
    });
  }

  private columnIndexToLetter(colIndex: number): string {
    let dividend = colIndex;
    let columnName = '';
    while (dividend > 0) {
      const modulo = (dividend - 1) % 26;
      columnName = String.fromCharCode(65 + modulo) + columnName;
      dividend = Math.floor((dividend - modulo) / 26);
    }
    return columnName;
  }

  private formatUtcDate(date: Date): string | null {
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private buildValidatedIsoDate(year: number, month: number, day: number): string | null {
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    ) {
      return null;
    }
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}
