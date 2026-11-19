import { BadRequestException, Injectable } from '@nestjs/common';
import { TeacherEmploymentStatus } from '@edu-center/shared';
import { CacheService } from '../../common/cache/cache.module';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type {
  DuplicateImportStrategy,
  ExcelImportCommitResponse,
  ExcelImportPreviewResponse,
  ExcelImportPreviewRow,
} from '../../common/excel/excel-import.types';
import { ExcelWorkbookService } from '../../common/excel/excel-workbook.service';
import type { UploadedMulterFile } from '../../common/types/multer.types';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  TeacherExcelCommitDto,
  TeacherExcelImportOptionsDto,
  TeacherExportQueryDto,
} from './dto/teacher-excel.dto';
import { TeachersRepository } from './teachers.repository';

export interface ParsedTeacherImportRow {
  teacherCode: string | null;
  fullName: string;
  phone: string;
  specialization: string;
  contractDate: string;
  employmentStatus: TeacherEmploymentStatus;
  notes: string | null;
}

const TEACHER_STATUS_LABELS: Record<TeacherEmploymentStatus, string> = {
  [TeacherEmploymentStatus.ACTIVE]: 'نشط',
  [TeacherEmploymentStatus.ON_LEAVE]: 'في إجازة',
  [TeacherEmploymentStatus.INACTIVE]: 'غير نشط',
};

const TEACHER_STATUS_PARSE_MAP: Record<string, TeacherEmploymentStatus> = {
  ACTIVE: TeacherEmploymentStatus.ACTIVE,
  نشط: TeacherEmploymentStatus.ACTIVE,
  ON_LEAVE: TeacherEmploymentStatus.ON_LEAVE,
  'في إجازة': TeacherEmploymentStatus.ON_LEAVE,
  اجازة: TeacherEmploymentStatus.ON_LEAVE,
  'في اجازة': TeacherEmploymentStatus.ON_LEAVE,
  INACTIVE: TeacherEmploymentStatus.INACTIVE,
  'غير نشط': TeacherEmploymentStatus.INACTIVE,
};

const TEACHER_HEADER_ALIASES: Record<keyof ParsedTeacherImportRow, string[]> = {
  teacherCode: ['كود المدرس (اختياري)', 'كود المدرس', 'teacherCode', 'code'],
  fullName: ['اسم المدرس *', 'اسم المدرس', 'الاسم الكامل', 'fullName', 'name'],
  phone: ['رقم الهاتف *', 'رقم الهاتف', 'الهاتف', 'phone'],
  specialization: ['التخصص *', 'التخصص', 'المادة', 'specialization'],
  contractDate: ['تاريخ التعاقد (YYYY-MM-DD)', 'تاريخ التعاقد', 'contractDate'],
  employmentStatus: ['حالة التعاقد', 'الحالة', 'employmentStatus'],
  notes: ['ملاحظات', 'notes'],
};

@Injectable()
export class TeachersExcelService {
  constructor(
    private readonly excelService: ExcelWorkbookService,
    private readonly repository: TeachersRepository,
    private readonly audit: AuditLogsService,
    private readonly cache: CacheService,
  ) {}

  async generateTemplate(): Promise<Buffer> {
    return this.excelService.buildWorkbookBuffer({
      sheetName: 'بيانات المدرسين',
      columns: [
        { key: 'teacherCode', header: 'كود المدرس (اختياري)', width: 22, numFmt: '@' },
        { key: 'fullName', header: 'اسم المدرس *', width: 28 },
        { key: 'phone', header: 'رقم الهاتف *', width: 20, numFmt: '@' },
        { key: 'specialization', header: 'التخصص *', width: 24 },
        { key: 'contractDate', header: 'تاريخ التعاقد (YYYY-MM-DD)', width: 26, numFmt: '@' },
        {
          key: 'employmentStatus',
          header: 'حالة التعاقد',
          width: 18,
          dropdownValues: ['نشط', 'في إجازة', 'غير نشط'],
        },
        { key: 'notes', header: 'ملاحظات', width: 30 },
      ],
      rows: [],
      validationRowCount: 500,
      instructionsSheet: {
        sheetName: 'التعليمات والأمثلة',
        title: 'تعليمات استيراد بيانات المدرسين من Excel',
        lines: [
          'أدخل بيانات المدرسين في الورقة الأولى (بيانات المدرسين) بدءاً من الصف رقم 2 أسفل العناوين مباشرة.',
          'الحقول المميزة بعلامة (*) إجبارية: اسم المدرس، رقم الهاتف، والتخصص.',
          'كود المدرس اختياري؛ إذا تُرك فارغاً سيقوم النظام بإنشاء كود فريد تلقائياً بصيغة TCH-XXXX.',
          'عمود الهاتف مضبوط بصيغة نص (@) للحفاظ على الصفر البادئ (مثل 01012345678).',
          'تاريخ التعاقد اختياري بصيغة YYYY-MM-DD، وإذا تُرك فارغاً يُسجَّل بتاريخ اليوم.',
          'حالة التعاقد اختيارية (نشط / في إجازة / غير نشط) وتُعيَّن افتراضياً إلى "نشط".',
          'المثال التوضيحي بالأسفل للقراءة فقط ولن يتم استيراده إلا إذا أُدخل في الورقة الأولى.',
        ],
        sampleHeaders: [
          'كود المدرس (اختياري)',
          'اسم المدرس *',
          'رقم الهاتف *',
          'التخصص *',
          'تاريخ التعاقد (YYYY-MM-DD)',
          'حالة التعاقد',
          'ملاحظات',
        ],
        sampleRow: [
          '',
          'أ. محمد عبد الرحمن',
          '01098765432',
          'الرياضيات',
          new Date().toISOString().slice(0, 10),
          'نشط',
          'خبرة 8 سنوات',
        ],
        referenceLists: [
          {
            title: 'حالات التعاقد المقبولة:',
            items: ['نشط (ACTIVE)', 'في إجازة (ON_LEAVE)', 'غير نشط (INACTIVE)'],
          },
        ],
      },
    });
  }

  async previewImport(
    file: UploadedMulterFile | undefined,
    dto?: TeacherExcelImportOptionsDto,
  ): Promise<ExcelImportPreviewResponse<ParsedTeacherImportRow>> {
    const strategy: DuplicateImportStrategy = dto?.duplicateStrategy ?? 'skip';
    return this.parseAndValidate(file, strategy);
  }

  async commitImport(
    file: UploadedMulterFile | undefined,
    dto: TeacherExcelCommitDto,
    actor: AuthenticatedUser,
  ): Promise<ExcelImportCommitResponse> {
    const strategy: DuplicateImportStrategy = dto.duplicateStrategy ?? 'skip';
    const preview = await this.parseAndValidate(file, strategy);

    if (preview.errorCount > 0 && !dto.skipInvalidRows) {
      throw new BadRequestException(
        `يحتوي الملف على ${preview.errorCount} صفاً بها أخطاء. يرجى تصحيحها أو تفعيل خيار تخطي الصفوف غير الصالحة قبل الحفظ.`,
      );
    }

    const validRows = preview.rows.filter((row) => row.status === 'valid');
    if (validRows.length === 0) {
      return {
        importedCount: 0,
        skippedCount: preview.skippedCount,
        failedCount: preview.errorCount,
      };
    }

    const assignedCodes = await this.excelService.allocateUniqueCodes(
      validRows.map((row) => row.data.teacherCode),
      'TCH-',
      async (candidates) => {
        const { existingCodes } = await this.repository.findExistingCodesAndNamePhones(
          candidates,
          [],
        );
        return existingCodes;
      },
    );

    const payload = validRows.map((row, index) => ({
      teacherCode: assignedCodes[index],
      fullName: row.data.fullName,
      phone: row.data.phone,
      specialization: row.data.specialization,
      contractDate: row.data.contractDate,
      employmentStatus: row.data.employmentStatus,
      notes: row.data.notes,
    }));

    const inserted = await this.repository.createManyTx(payload);

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'IMPORT_TEACHERS_EXCEL',
      entityType: 'TEACHER',
      entityId: inserted[0]?.id ?? null,
      afterData: {
        importedCount: inserted.length,
        skippedCount: preview.skippedCount,
        failedCount: preview.errorCount,
        filename: file?.originalname ?? null,
      },
    });

    await this.cache.invalidateRosterViews();
    return {
      importedCount: inserted.length,
      skippedCount: preview.skippedCount,
      failedCount: preview.errorCount,
    };
  }

  async exportExcel(
    query: TeacherExportQueryDto,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const rows = await this.repository.findAllForExport(query);
    const today = new Date().toISOString().slice(0, 10);

    const buffer = await this.excelService.buildWorkbookBuffer({
      sheetName: 'سجل المدرسين',
      columns: [
        { key: 'teacherCode', header: 'كود المدرس', width: 18, numFmt: '@' },
        { key: 'fullName', header: 'اسم المدرس', width: 28 },
        { key: 'phone', header: 'رقم الهاتف', width: 18, numFmt: '@' },
        { key: 'specialization', header: 'التخصص', width: 22 },
        { key: 'assignedGroupsCount', header: 'المجموعات المسندة', width: 18 },
        { key: 'contractDate', header: 'تاريخ التعاقد', width: 18, numFmt: '@' },
        { key: 'employmentStatus', header: 'حالة التعاقد', width: 16 },
        { key: 'notes', header: 'ملاحظات', width: 32 },
      ],
      rows: rows.map((row) => ({
        teacherCode: row.teacherCode,
        fullName: row.fullName,
        phone: row.phone,
        specialization: row.specialization,
        assignedGroupsCount: Number(row.assignedGroupsCount ?? 0),
        contractDate: row.contractDate,
        employmentStatus:
          TEACHER_STATUS_LABELS[row.employmentStatus as TeacherEmploymentStatus] ??
          row.employmentStatus,
        notes: row.notes ?? '',
      })),
    });

    return {
      buffer,
      filename: `teachers-${today}.xlsx`,
    };
  }

  private async parseAndValidate(
    file: UploadedMulterFile | undefined,
    duplicateStrategy: DuplicateImportStrategy,
  ): Promise<ExcelImportPreviewResponse<ParsedTeacherImportRow>> {
    const parsedSheet = await this.excelService.parseUploadedWorkbook(file, { maxRows: 2000 });
    const headerLookup = this.excelService.resolveColumnHeaders(
      parsedSheet.headers,
      TEACHER_HEADER_ALIASES,
    );

    if (!headerLookup.fullName || !headerLookup.phone || !headerLookup.specialization) {
      throw new BadRequestException(
        'تنسيق الأعمدة غير مطابق للنموذج المعتمد. تأكد من وجود الأعمدة: اسم المدرس، رقم الهاتف، التخصص.',
      );
    }

    const candidateCodes: string[] = [];
    const candidatePhones: string[] = [];
    const extracted = parsedSheet.rows.map((row) => {
      const code = headerLookup.teacherCode
        ? this.excelService.normalizeCellText(row.cells[headerLookup.teacherCode])
        : '';
      const phone = this.excelService.normalizePhoneText(row.cells[headerLookup.phone!]);
      if (code) candidateCodes.push(code.toUpperCase());
      if (phone) candidatePhones.push(phone);
      return { row, code, phone };
    });

    const { existingCodes, existingNamePhones } =
      await this.repository.findExistingCodesAndNamePhones(candidateCodes, candidatePhones);

    const seenInFileCodes = new Set<string>();
    const seenInFileNamePhones = new Set<string>();
    const today = new Date().toISOString().slice(0, 10);

    let validCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let warningCount = 0;

    const previewRows: ExcelImportPreviewRow<ParsedTeacherImportRow>[] = extracted.map(({ row }) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      const rawCode = headerLookup.teacherCode
        ? this.excelService.normalizeCellText(row.cells[headerLookup.teacherCode])
        : '';
      const fullName = this.excelService.normalizeCellText(row.cells[headerLookup.fullName!]);
      const phone = this.excelService.normalizePhoneText(row.cells[headerLookup.phone!]);
      const specialization = this.excelService.normalizeCellText(
        row.cells[headerLookup.specialization!],
      );
      const rawContractDate = headerLookup.contractDate
        ? row.cells[headerLookup.contractDate]
        : null;
      const rawStatus = headerLookup.employmentStatus
        ? this.excelService.normalizeCellText(row.cells[headerLookup.employmentStatus])
        : '';
      const rawNotes = headerLookup.notes
        ? this.excelService.normalizeCellText(row.cells[headerLookup.notes])
        : '';

      if (!fullName || fullName.length < 2) {
        errors.push('اسم المدرس مطلوب ويجب ألا يقل عن حرفين');
      } else if (fullName.length > 160) {
        errors.push('اسم المدرس يتجاوز الحد الأقصى (160 حرفاً)');
      }

      if (!phone || phone.length < 6) {
        errors.push('رقم الهاتف مطلوب (6 أرقام على الأقل)');
      } else if (phone.length > 30) {
        errors.push('رقم الهاتف يتجاوز الحد الأقصى (30 حرفاً)');
      }

      if (!specialization || specialization.length < 2) {
        errors.push('التخصص مطلوب ويجب ألا يقل عن حرفين');
      } else if (specialization.length > 100) {
        errors.push('التخصص يتجاوز الحد الأقصى (100 حرف)');
      }

      let contractDate = today;
      const rawDateText = this.excelService.normalizeCellText(rawContractDate);
      if (rawDateText) {
        const parsedDate = this.excelService.normalizeDateCell(rawContractDate);
        if (!parsedDate) {
          errors.push('تاريخ التعاقد غير صالح (الصيغة المطلوبة YYYY-MM-DD)');
        } else {
          contractDate = parsedDate;
        }
      }

      let employmentStatus: TeacherEmploymentStatus = TeacherEmploymentStatus.ACTIVE;
      if (rawStatus) {
        const mappedStatus =
          TEACHER_STATUS_PARSE_MAP[rawStatus.toUpperCase()] ??
          TEACHER_STATUS_PARSE_MAP[rawStatus];
        if (!mappedStatus) {
          errors.push('حالة التعاقد غير صالحة (المسموح: نشط، في إجازة، غير نشط)');
        } else {
          employmentStatus = mappedStatus;
        }
      }

      if (rawNotes.length > 2000) {
        errors.push('الملاحظات تتجاوز الحد الأقصى (2000 حرف)');
      }

      let isSkipped = false;
      if (rawCode) {
        if (rawCode.length > 40) {
          errors.push('كود المدرس يتجاوز الحد الأقصى (40 حرفاً)');
        } else {
          const upperCode = rawCode.toUpperCase();
          if (seenInFileCodes.has(upperCode)) {
            errors.push(`كود المدرس "${rawCode}" مكرر داخل نفس الملف`);
          } else {
            seenInFileCodes.add(upperCode);
          }

          if (existingCodes.has(upperCode)) {
            if (duplicateStrategy === 'skip') {
              isSkipped = true;
              warnings.push(`كود المدرس "${rawCode}" مسجل مسبقاً — سيتم تخطي هذا الصف`);
            } else {
              errors.push(`كود المدرس "${rawCode}" مسجل مسبقاً في قاعدة البيانات`);
            }
          }
        }
      }

      if (fullName && phone) {
        const namePhoneKey = `${fullName.toLowerCase()}|${phone}`;
        if (seenInFileNamePhones.has(namePhoneKey)) {
          warnings.push('يوجد صف آخر في نفس الملف بنفس اسم المدرس ورقم الهاتف');
        } else {
          seenInFileNamePhones.add(namePhoneKey);
        }

        if (!isSkipped && existingNamePhones.has(namePhoneKey)) {
          warnings.push('يوجد مدرس مسجل مسبقاً في النظام بنفس الاسم ورقم الهاتف');
        }
      }

      let rowStatus: ExcelImportPreviewRow['status'] = 'valid';
      if (errors.length > 0) {
        rowStatus = 'error';
        errorCount += 1;
      } else if (isSkipped) {
        rowStatus = 'skip';
        skippedCount += 1;
      } else {
        validCount += 1;
      }

      if (warnings.length > 0) {
        warningCount += 1;
      }

      return {
        rowNumber: row.rowNumber,
        status: rowStatus,
        data: {
          teacherCode: rawCode || null,
          fullName,
          phone,
          specialization,
          contractDate,
          employmentStatus,
          notes: rawNotes || null,
        },
        errors,
        warnings,
      };
    });

    return {
      totalRows: previewRows.length,
      validCount,
      skippedCount,
      errorCount,
      warningCount,
      rows: previewRows,
    };
  }
}

