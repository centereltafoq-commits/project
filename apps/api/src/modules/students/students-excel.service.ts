import { BadRequestException, Injectable } from '@nestjs/common';
import { StudentStatus } from '@edu-center/shared';
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
  StudentExcelCommitDto,
  StudentExcelImportOptionsDto,
  StudentExportQueryDto,
} from './dto/student-excel.dto';
import { StudentsRepository } from './students.repository';

export interface ParsedStudentImportRow {
  studentCode: string | null;
  fullName: string;
  phone: string | null;
  guardianPhone: string | null;
  gradeLevel: string;
  registrationDate: string;
  status: StudentStatus;
  notes: string | null;
}

const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  [StudentStatus.ACTIVE]: 'نشط',
  [StudentStatus.SUSPENDED]: 'موقوف',
  [StudentStatus.ARCHIVED]: 'مؤرشف',
};

const STUDENT_STATUS_PARSE_MAP: Record<string, StudentStatus> = {
  ACTIVE: StudentStatus.ACTIVE,
  نشط: StudentStatus.ACTIVE,
  SUSPENDED: StudentStatus.SUSPENDED,
  موقوف: StudentStatus.SUSPENDED,
  ARCHIVED: StudentStatus.ARCHIVED,
  مؤرشف: StudentStatus.ARCHIVED,
};

const STUDENT_HEADER_ALIASES: Record<keyof ParsedStudentImportRow, string[]> = {
  studentCode: ['كود الطالب (اختياري)', 'كود الطالب', 'studentCode', 'code'],
  fullName: ['اسم الطالب *', 'اسم الطالب', 'الاسم الكامل', 'fullName', 'name'],
  phone: ['هاتف الطالب (اختياري)', 'هاتف الطالب *', 'هاتف الطالب', 'رقم الهاتف', 'phone'],
  guardianPhone: [
    'هاتف ولي الأمر *',
    'هاتف ولي الأمر (اختياري)',
    'هاتف ولي الأمر',
    'رقم ولي الأمر',
    'guardianPhone',
  ],
  gradeLevel: ['الصف الدراسي *', 'الصف الدراسي', 'الصف', 'gradeLevel'],
  registrationDate: ['تاريخ التسجيل (YYYY-MM-DD)', 'تاريخ التسجيل', 'registrationDate'],
  status: ['الحالة', 'حالة الطالب', 'status'],
  notes: ['ملاحظات', 'notes'],
};

@Injectable()
export class StudentsExcelService {
  constructor(
    private readonly excelService: ExcelWorkbookService,
    private readonly repository: StudentsRepository,
    private readonly audit: AuditLogsService,
  ) {}

  async generateTemplate(): Promise<Buffer> {
    const activeGradeLevels = await this.repository.findActiveGradeLevelNames();
    const exampleGrade = activeGradeLevels[0] ?? 'الأول الثانوي';

    return this.excelService.buildWorkbookBuffer({
      sheetName: 'بيانات الطلاب',
      columns: [
        { key: 'studentCode', header: 'كود الطالب (اختياري)', width: 22, numFmt: '@' },
        { key: 'fullName', header: 'اسم الطالب *', width: 28 },
        { key: 'phone', header: 'هاتف الطالب (اختياري)', width: 20, numFmt: '@' },
        { key: 'guardianPhone', header: 'هاتف ولي الأمر (اختياري)', width: 20, numFmt: '@' },
        {
          key: 'gradeLevel',
          header: 'الصف الدراسي *',
          width: 24,
          dropdownValues: activeGradeLevels,
        },
        { key: 'registrationDate', header: 'تاريخ التسجيل (YYYY-MM-DD)', width: 26, numFmt: '@' },
        {
          key: 'status',
          header: 'الحالة',
          width: 16,
          dropdownValues: ['نشط', 'موقوف', 'مؤرشف'],
        },
        { key: 'notes', header: 'ملاحظات', width: 30 },
      ],
      rows: [],
      validationRowCount: 500,
      instructionsSheet: {
        sheetName: 'التعليمات والأمثلة',
        title: 'تعليمات استيراد بيانات الطلاب من Excel',
        lines: [
          'أدخل بيانات الطلاب في الورقة الأولى (بيانات الطلاب) بدءاً من الصف رقم 2 أسفل العناوين مباشرة.',
          'الحقول المميزة بعلامة (*) إجبارية: اسم الطالب والصف الدراسي (وهاتف الطالب وهاتف ولي الأمر اختياريان).',
          'كود الطالب اختياري؛ إذا تُرك فارغاً سيقوم النظام بإنشاء كود فريد تلقائياً بصيغة STU-YYYY-XXXX.',
          'أعمدة الهاتف مضبوطة بصيغة نص (@) للحفاظ على الصفر البادئ (مثل 01012345678).',
          'تاريخ التسجيل اختياري بصيغة YYYY-MM-DD (مثل 2026-09-01)، وإذا تُرك فارغاً يُسجَّل بتاريخ اليوم.',
          'الحالة اختيارية (نشط / موقوف / مؤرشف) وتُعيَّن افتراضياً إلى "نشط" إذا تُركت فارغة.',
          'هذا المثال التوضيحي بالأسفل للقراءة فقط ولن يتم استيراده إلا إذا أُدخل في الورقة الأولى.',
        ],
        sampleHeaders: [
          'كود الطالب (اختياري)',
          'اسم الطالب *',
          'هاتف الطالب (اختياري)',
          'هاتف ولي الأمر (اختياري)',
          'الصف الدراسي *',
          'تاريخ التسجيل (YYYY-MM-DD)',
          'الحالة',
          'ملاحظات',
        ],
        sampleRow: [
          '',
          'أحمد محمد علي',
          '01012345678',
          '01198765432',
          exampleGrade,
          new Date().toISOString().slice(0, 10),
          'نشط',
          'طالب مستجد',
        ],
        referenceLists: [
          {
            title: 'الصفوف الدراسية المفعّلة حالياً في النظام:',
            items:
              activeGradeLevels.length > 0
                ? activeGradeLevels
                : ['لا توجد صفوف مسجلة بعد — يمكن كتابة اسم الصف يدوياً'],
          },
          {
            title: 'قيم الحالة المقبولة:',
            items: ['نشط (ACTIVE)', 'موقوف (SUSPENDED)', 'مؤرشف (ARCHIVED)'],
          },
        ],
      },
    });
  }

  async previewImport(
    file: UploadedMulterFile | undefined,
    dto?: StudentExcelImportOptionsDto,
  ): Promise<ExcelImportPreviewResponse<ParsedStudentImportRow>> {
    const strategy: DuplicateImportStrategy = dto?.duplicateStrategy ?? 'skip';
    return this.parseAndValidate(file, strategy);
  }

  async commitImport(
    file: UploadedMulterFile | undefined,
    dto: StudentExcelCommitDto,
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
      validRows.map((row) => row.data.studentCode),
      `STU-${new Date().getFullYear()}-`,
      async (candidates) => {
        const { existingCodes } = await this.repository.findExistingCodesAndNamePhones(
          candidates,
          [],
        );
        return existingCodes;
      },
    );

    const payload = validRows.map((row, index) => ({
      studentCode: assignedCodes[index],
      fullName: row.data.fullName,
      phone: row.data.phone,
      guardianPhone: row.data.guardianPhone,
      gradeLevel: row.data.gradeLevel,
      registrationDate: row.data.registrationDate,
      status: row.data.status,
      notes: row.data.notes,
    }));

    const inserted = await this.repository.createManyTx(payload);

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'IMPORT_STUDENTS_EXCEL',
      entityType: 'STUDENT',
      entityId: inserted[0]?.id ?? null,
      afterData: {
        importedCount: inserted.length,
        skippedCount: preview.skippedCount,
        failedCount: preview.errorCount,
        filename: file?.originalname ?? null,
      },
    });

    return {
      importedCount: inserted.length,
      skippedCount: preview.skippedCount,
      failedCount: preview.errorCount,
    };
  }

  async exportExcel(
    query: StudentExportQueryDto,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const rows = await this.repository.findAllForExport(query);
    const today = new Date().toISOString().slice(0, 10);

    const buffer = await this.excelService.buildWorkbookBuffer({
      sheetName: 'سجل الطلاب',
      columns: [
        { key: 'studentCode', header: 'كود الطالب', width: 20, numFmt: '@' },
        { key: 'fullName', header: 'اسم الطالب', width: 28 },
        { key: 'gradeLevel', header: 'الصف الدراسي', width: 22 },
        { key: 'phone', header: 'هاتف الطالب', width: 18, numFmt: '@' },
        { key: 'guardianPhone', header: 'هاتف ولي الأمر', width: 18, numFmt: '@' },
        { key: 'activeGroupsCount', header: 'المجموعات النشطة', width: 18 },
        { key: 'registrationDate', header: 'تاريخ التسجيل', width: 18, numFmt: '@' },
        { key: 'status', header: 'الحالة', width: 14 },
        { key: 'notes', header: 'ملاحظات', width: 32 },
      ],
      rows: rows.map((row) => ({
        studentCode: row.studentCode,
        fullName: row.fullName,
        gradeLevel: row.gradeLevel,
        phone: row.phone ?? '',
        guardianPhone: row.guardianPhone ?? '',
        activeGroupsCount: Number(row.activeGroupsCount ?? 0),
        registrationDate: row.registrationDate,
        status: STUDENT_STATUS_LABELS[row.status as StudentStatus] ?? row.status,
        notes: row.notes ?? '',
      })),
    });

    return {
      buffer,
      filename: `students-${today}.xlsx`,
    };
  }

  private async parseAndValidate(
    file: UploadedMulterFile | undefined,
    duplicateStrategy: DuplicateImportStrategy,
  ): Promise<ExcelImportPreviewResponse<ParsedStudentImportRow>> {
    const parsedSheet = await this.excelService.parseUploadedWorkbook(file, { maxRows: 2000 });
    const headerLookup = this.excelService.resolveColumnHeaders(
      parsedSheet.headers,
      STUDENT_HEADER_ALIASES,
    );

    if (!headerLookup.fullName || !headerLookup.gradeLevel) {
      throw new BadRequestException(
        'تنسيق الأعمدة غير مطابق للنموذج المعتمد. تأكد من وجود الأعمدة: اسم الطالب، الصف الدراسي.',
      );
    }

    const gradeLevelRecords = this.repository.findAllGradeLevelRecords
      ? await this.repository.findAllGradeLevelRecords()
      : (await this.repository.findActiveGradeLevelNames()).map((name) => ({
          name,
          isActive: true,
        }));

    const gradeLookup = new Map<string, { name: string; isActive: boolean }>(
      gradeLevelRecords.map((g) => [g.name.trim().toLowerCase(), g]),
    );

    const candidateCodes: string[] = [];
    const candidatePhones: string[] = [];
    const extracted = parsedSheet.rows.map((row) => {
      const code = headerLookup.studentCode
        ? this.excelService.normalizeCellText(row.cells[headerLookup.studentCode])
        : '';
      const phone = headerLookup.phone
        ? this.excelService.normalizePhoneText(row.cells[headerLookup.phone])
        : '';
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

    const previewRows: ExcelImportPreviewRow<ParsedStudentImportRow>[] = extracted.map(({ row }) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      const rawCode = headerLookup.studentCode
        ? this.excelService.normalizeCellText(row.cells[headerLookup.studentCode])
        : '';
      const fullName = this.excelService.normalizeCellText(row.cells[headerLookup.fullName!]);
      const phone = headerLookup.phone
        ? this.excelService.normalizePhoneText(row.cells[headerLookup.phone])
        : '';
      const guardianPhone = headerLookup.guardianPhone
        ? this.excelService.normalizePhoneText(row.cells[headerLookup.guardianPhone])
        : '';
      const rawGradeLevel = this.excelService.normalizeCellText(row.cells[headerLookup.gradeLevel!]);
      const rawRegDate = headerLookup.registrationDate ? row.cells[headerLookup.registrationDate] : null;
      const rawStatus = headerLookup.status
        ? this.excelService.normalizeCellText(row.cells[headerLookup.status])
        : '';
      const rawNotes = headerLookup.notes
        ? this.excelService.normalizeCellText(row.cells[headerLookup.notes])
        : '';

      let isSkipped = false;
      if (rawCode) {
        if (rawCode.length > 40) {
          errors.push('كود الطالب يتجاوز الحد الأقصى (40 حرفاً)');
        } else {
          const upperCode = rawCode.toUpperCase();
          if (seenInFileCodes.has(upperCode)) {
            errors.push(`كود الطالب "${rawCode}" مكرر داخل نفس الملف`);
          } else {
            seenInFileCodes.add(upperCode);
          }

          if (existingCodes.has(upperCode)) {
            if (duplicateStrategy === 'skip') {
              isSkipped = true;
              warnings.push(`كود الطالب "${rawCode}" مسجل مسبقاً — سيتم تخطي هذا الصف`);
            } else {
              errors.push(`كود الطالب "${rawCode}" مسجل مسبقاً في قاعدة البيانات`);
            }
          }
        }
      }

      if (!fullName || fullName.length < 2) {
        errors.push('اسم الطالب مطلوب ويجب ألا يقل عن حرفين');
      } else if (fullName.length > 160) {
        errors.push('اسم الطالب يتجاوز الحد الأقصى (160 حرفاً)');
      }

      if (phone && phone.length < 6) {
        errors.push('هاتف الطالب (إن وُجد) يجب ألا يقل عن 6 أرقام');
      } else if (phone.length > 30) {
        errors.push('هاتف الطالب يتجاوز الحد الأقصى (30 حرفاً)');
      }

      if (guardianPhone && guardianPhone.length < 6) {
        errors.push('هاتف ولي الأمر (إن وُجد) يجب ألا يقل عن 6 أرقام');
      } else if (guardianPhone.length > 30) {
        errors.push('هاتف ولي الأمر يتجاوز الحد الأقصى (30 حرفاً)');
      }

      let resolvedGradeLevel = rawGradeLevel;
      if (!rawGradeLevel) {
        errors.push('الصف الدراسي مطلوب');
      } else if (rawGradeLevel.length > 80) {
        errors.push('اسم الصف الدراسي يتجاوز الحد الأقصى (80 حرفاً)');
      } else if (gradeLookup.size > 0 && !isSkipped) {
        const matched = gradeLookup.get(rawGradeLevel.toLowerCase());
        if (!matched) {
          errors.push(`الصف الدراسي "${rawGradeLevel}" غير مسجل في الصفوف الدراسية المفعّلة`);
        } else {
          resolvedGradeLevel = matched.name;
          if (!matched.isActive) {
            warnings.push(`الصف الدراسي "${matched.name}" معطّل حالياً في إعدادات الصفوف`);
          }
        }
      }

      let registrationDate = today;
      const normalizedRawDateText = this.excelService.normalizeCellText(rawRegDate);
      if (normalizedRawDateText) {
        const parsedDate = this.excelService.normalizeDateCell(rawRegDate);
        if (!parsedDate) {
          errors.push('تاريخ التسجيل غير صالح (الصيغة المطلوبة YYYY-MM-DD)');
        } else {
          registrationDate = parsedDate;
        }
      }

      let status: StudentStatus = StudentStatus.ACTIVE;
      if (rawStatus) {
        const mappedStatus =
          STUDENT_STATUS_PARSE_MAP[rawStatus.toUpperCase()] ??
          STUDENT_STATUS_PARSE_MAP[rawStatus];
        if (!mappedStatus) {
          errors.push('حالة الطالب غير صالحة (المسموح: نشط، موقوف، مؤرشف)');
        } else {
          status = mappedStatus;
        }
      }

      if (rawNotes.length > 2000) {
        errors.push('الملاحظات تتجاوز الحد الأقصى (2000 حرف)');
      }

      if (fullName && phone) {
        const namePhoneKey = `${fullName.toLowerCase()}|${phone}`;
        if (seenInFileNamePhones.has(namePhoneKey)) {
          warnings.push('يوجد صف آخر في نفس الملف بنفس اسم الطالب ورقم الهاتف');
        } else {
          seenInFileNamePhones.add(namePhoneKey);
        }

        if (!isSkipped && existingNamePhones.has(namePhoneKey)) {
          warnings.push('يوجد طالب مسجل مسبقاً في النظام بنفس الاسم ورقم الهاتف');
        }
      }

      let rowStatus: ExcelImportPreviewRow['status'] = 'valid';
      if (isSkipped && errors.length === 0) {
        rowStatus = 'skip';
        skippedCount += 1;
      } else if (errors.length > 0 && !isSkipped) {
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
          studentCode: rawCode || null,
          fullName,
          phone: phone || null,
          guardianPhone: guardianPhone || null,
          gradeLevel: resolvedGradeLevel,
          registrationDate,
          status,
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
