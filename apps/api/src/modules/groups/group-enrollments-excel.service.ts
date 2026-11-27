import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EnrollmentStatus, PERMISSIONS, SystemRole } from '@edu-center/shared';
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
import { MonthlySettlementService } from '../finance/monthly-settlement.service';
import {
  EnrollmentExcelCommitDto,
  EnrollmentExcelImportOptionsDto,
  EnrollmentExportQueryDto,
} from './dto/enrollment-excel.dto';
import { EnrollmentsRepository } from './enrollments.repository';
import { GroupsRepository } from './groups.repository';

type EnrollmentHeaderField =
  | 'studentCode'
  | 'studentName'
  | 'studentPhone'
  | 'startDate'
  | 'agreedMonthlyPrice'
  | 'agreedSessionsCount'
  | 'notes';

interface ParsedEnrollmentRow {
  studentId: string;
  studentCode: string;
  studentName: string;
  studentPhone: string;
  startDate: string;
  agreedMonthlyPrice: number;
  agreedSessionsCount: number;
  agreedSessionPrice: number;
  notes: string | null;
}

const ENROLLMENT_HEADER_ALIASES: Record<EnrollmentHeaderField, string[]> = {
  studentCode: ['كود الطالب *', 'كود الطالب', 'كود الطالب (اختياري)', 'studentCode', 'code'],
  studentName: ['اسم الطالب *', 'اسم الطالب', 'الاسم الكامل', 'studentName', 'fullName', 'name'],
  studentPhone: ['هاتف الطالب', 'رقم الهاتف', 'الهاتف', 'studentPhone', 'phone'],
  startDate: ['تاريخ البدء (YYYY-MM-DD)', 'تاريخ بدء الاشتراك', 'تاريخ البدء', 'startDate'],
  agreedMonthlyPrice: [
    'الاشتراك الشهري',
    'الاشتراك الشهري المتفق عليه',
    'السعر الشهري',
    'agreedMonthlyPrice',
  ],
  agreedSessionsCount: ['عدد الحصص الشهرية', 'عدد الحصص', 'agreedSessionsCount'],
  notes: ['ملاحظات', 'notes'],
};

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  [EnrollmentStatus.ACTIVE]: 'نشط',
  [EnrollmentStatus.PAUSED]: 'موقوف مؤقتاً',
  [EnrollmentStatus.CANCELLED]: 'متوقف',
  [EnrollmentStatus.COMPLETED]: 'مكتمل',
};

const MAX_IMPORT_ROWS = 1000;

@Injectable()
export class GroupEnrollmentsExcelService {
  constructor(
    private readonly excelService: ExcelWorkbookService,
    private readonly groupsRepository: GroupsRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly audit: AuditLogsService,
    @Optional() private readonly settlementService?: MonthlySettlementService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  private canViewFinance(actor?: AuthenticatedUser): boolean {
    if (!actor) return true;
    return (
      actor.roleCode === SystemRole.OWNER ||
      Boolean(actor.permissions?.includes(PERMISSIONS.FINANCE_VIEW))
    );
  }

  private getTodayIsoDate(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private sanitizeFormulaCell(value: string | null | undefined): string {
    if (!value) return '';
    return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  }

  async generateTemplate(groupId: string): Promise<Buffer> {
    const group = await this.groupsRepository.findDetailById(groupId);
    if (!group) throw new NotFoundException('المجموعة غير موجودة');

    const activeStudents = await this.enrollmentsRepository.findAllStudentsForEnrollmentExcel();
    const sampleStudent = activeStudents[0];
    const today = this.getTodayIsoDate();
    const referenceStudents = activeStudents
      .slice(0, 200)
      .map((s) => `${s.studentCode} — ${s.fullName}${s.phone ? ` (${s.phone})` : ''}`);

    return this.excelService.buildWorkbookBuffer({
      sheetName: 'تسجيل_طلاب_المجموعة',
      columns: [
        { key: 'studentCode', header: 'كود الطالب', width: 20, numFmt: '@' },
        { key: 'studentName', header: 'اسم الطالب', width: 28 },
        { key: 'studentPhone', header: 'هاتف الطالب', width: 20, numFmt: '@' },
        { key: 'startDate', header: 'تاريخ البدء (YYYY-MM-DD)', width: 22, numFmt: '@' },
        { key: 'agreedMonthlyPrice', header: 'الاشتراك الشهري', width: 18 },
        { key: 'agreedSessionsCount', header: 'عدد الحصص الشهرية', width: 18 },
        { key: 'notes', header: 'ملاحظات', width: 28 },
      ],
      rows: [],
      instructionsSheet: {
        sheetName: 'التعليمات ومرجع الطلاب',
        title: `نموذج إضافة أو نقل طلاب إلى مجموعة: ${group.name} (${group.groupCode})`,
        lines: [
          'أدخل كود الطالب (الأدق) أو هاتف الطالب أو اسمه الكامل في الورقة الأولى لربطه بالمجموعة.',
          'عند ترك تاريخ البدء أو الاشتراك الشهري أو عدد الحصص فارغاً يتم تطبيق القيم الافتراضية للمجموعة تلقائياً.',
          'لنقل طلاب من مجموعة أخرى: صدّر طلاب المجموعة القديمة أولاً إلى Excel، ثم ارفع نفس الملف هنا مع اختيار «المجموعة المنقول منها» في نافذة الاستيراد.',
          'صيغة التاريخ الموصى بها: YYYY-MM-DD مثل 2026-11-01.',
        ],
        sampleHeaders: [
          'كود الطالب',
          'اسم الطالب',
          'هاتف الطالب',
          'تاريخ البدء (YYYY-MM-DD)',
          'الاشتراك الشهري',
          'عدد الحصص الشهرية',
          'ملاحظات',
        ],
        sampleRow: [
          sampleStudent?.studentCode ?? 'STU-1001',
          sampleStudent?.fullName ?? 'أحمد محمد علي',
          sampleStudent?.phone ?? '01012345678',
          today,
          String(group.monthlyPrice),
          String(group.monthlySessionsCount),
          'مثال استرشادي',
        ],
        referenceLists:
          referenceStudents.length > 0
            ? [{ title: 'دليل أكواد الطلاب النشطين (للمرجعية):', items: referenceStudents }]
            : undefined,
      },
    });
  }

  async exportExcel(
    groupId: string,
    query: EnrollmentExportQueryDto,
    actor?: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const group = await this.groupsRepository.findDetailById(groupId);
    if (!group) throw new NotFoundException('المجموعة غير موجودة');

    const rows = await this.enrollmentsRepository.findAllByGroupForExport(groupId, query);
    const showFinance = this.canViewFinance(actor);
    const dateStamp = this.getTodayIsoDate();

    const buffer = await this.excelService.buildWorkbookBuffer({
      sheetName: 'طلاب المجموعة',
      columns: [
        { key: 'studentCode', header: 'كود الطالب', width: 18, numFmt: '@' },
        { key: 'studentName', header: 'اسم الطالب', width: 28 },
        { key: 'studentPhone', header: 'هاتف الطالب', width: 18, numFmt: '@' },
        { key: 'guardianPhone', header: 'هاتف ولي الأمر', width: 18, numFmt: '@' },
        { key: 'gradeLevel', header: 'الصف الدراسي', width: 22 },
        { key: 'startDate', header: 'تاريخ البدء (YYYY-MM-DD)', width: 20, numFmt: '@' },
        { key: 'agreedMonthlyPrice', header: 'الاشتراك الشهري', width: 18 },
        { key: 'agreedSessionsCount', header: 'عدد الحصص الشهرية', width: 18 },
        { key: 'agreedSessionPrice', header: 'سعر الحصة', width: 14 },
        { key: 'status', header: 'حالة الاشتراك', width: 16 },
        { key: 'endDate', header: 'تاريخ الإيقاف', width: 16, numFmt: '@' },
        { key: 'notes', header: 'ملاحظات', width: 28 },
      ],
      rows: rows.map((row) => ({
        studentCode: this.sanitizeFormulaCell(row.studentCode),
        studentName: this.sanitizeFormulaCell(row.studentName),
        studentPhone: this.sanitizeFormulaCell(row.studentPhone ?? ''),
        guardianPhone: this.sanitizeFormulaCell(row.guardianPhone ?? ''),
        gradeLevel: this.sanitizeFormulaCell(row.gradeLevel),
        startDate: row.startDate ?? '',
        agreedMonthlyPrice: showFinance ? Number(row.agreedMonthlyPrice ?? 0) : 'محجوب',
        agreedSessionsCount: Number(row.agreedSessionsCount ?? 0),
        agreedSessionPrice: showFinance ? Number(row.agreedSessionPrice ?? 0) : 'محجوب',
        status: ENROLLMENT_STATUS_LABELS[row.status] ?? row.status,
        endDate: row.endDate ?? '',
        notes: this.sanitizeFormulaCell(row.notes ?? ''),
      })),
    });

    const safeCode = group.groupCode.replace(/[^a-zA-Z0-9_-]/g, '');
    return {
      buffer,
      filename: `group-${safeCode || 'students'}-${dateStamp}.xlsx`,
    };
  }

  async previewImport(
    groupId: string,
    file: UploadedMulterFile | undefined,
    options: EnrollmentExcelImportOptionsDto,
  ): Promise<ExcelImportPreviewResponse> {
    const analyzed = await this.analyzeImportFile(groupId, file, options);
    return analyzed.preview;
  }

  async commitImport(
    groupId: string,
    file: UploadedMulterFile | undefined,
    dto: EnrollmentExcelCommitDto,
    actor: AuthenticatedUser,
  ): Promise<ExcelImportCommitResponse & { transferredCount: number }> {
    const analyzed = await this.analyzeImportFile(groupId, file, dto);
    const { preview, validParsedRows, group, sourceGroup } = analyzed;

    if (preview.errorCount > 0 && !dto.skipInvalidRows) {
      throw new BadRequestException(
        `يوجد ${preview.errorCount} صفاً بها أخطاء. أصلح الأخطاء أو فعّل خيار تخطي الصفوف غير الصالحة قبل الحفظ.`,
      );
    }

    if (validParsedRows.length === 0) {
      return {
        importedCount: 0,
        skippedCount: preview.skippedCount,
        failedCount: preview.errorCount,
        transferredCount: 0,
      };
    }

    const dbResult = await this.enrollmentsRepository.createBulkWithOptionalTransfer({
      groupId,
      skipAlreadyEnrolled: (dto.duplicateStrategy ?? 'skip') === 'skip',
      sourceGroupId: sourceGroup?.id ?? null,
      rows: validParsedRows.map((row) => ({
        studentId: row.studentId,
        startDate: row.startDate,
        endDate: null,
        agreedMonthlyPrice: row.agreedMonthlyPrice.toFixed(2),
        agreedSessionsCount: row.agreedSessionsCount,
        agreedSessionPrice: row.agreedSessionPrice.toFixed(2),
        notes: row.notes,
      })),
    });

    const affectedMonths = Array.from(
      new Set([
        this.getTodayIsoDate().slice(0, 7),
        ...validParsedRows.map((r) => r.startDate.slice(0, 7)),
      ]),
    );

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: sourceGroup ? 'TRANSFER_GROUP_ENROLLMENTS' : 'IMPORT_GROUP_ENROLLMENTS',
      entityType: 'ENROLLMENT',
      entityId: groupId,
      afterData: {
        groupId,
        groupName: group.name,
        sourceGroupId: sourceGroup?.id ?? null,
        sourceGroupName: sourceGroup?.name ?? null,
        importedCount: dbResult.created.length,
        transferredCount: dbResult.transferredCount,
        skippedCount: preview.skippedCount + dbResult.skippedAlreadyEnrolledCount,
        failedCount: preview.errorCount,
      },
    });

    if (this.settlementService && (dbResult.created.length > 0 || dbResult.transferredCount > 0)) {
      for (const ym of affectedMonths) {
        await this.settlementService.recalculateMonth(ym);
      }
      try {
        await Promise.all([
          this.cache?.invalidatePrefix('dashboard:summary:'),
          this.cache?.invalidatePrefix('reports:'),
        ]);
      } catch {}
    }

    return {
      importedCount: dbResult.created.length,
      skippedCount: preview.skippedCount + dbResult.skippedAlreadyEnrolledCount,
      failedCount: dto.skipInvalidRows ? preview.errorCount : 0,
      transferredCount: dbResult.transferredCount,
    };
  }

  private async analyzeImportFile(
    groupId: string,
    file: UploadedMulterFile | undefined,
    options: EnrollmentExcelImportOptionsDto,
  ) {
    const duplicateStrategy: DuplicateImportStrategy = options.duplicateStrategy ?? 'skip';
    const sourceGroupId = options.sourceGroupId?.trim() || undefined;

    if (sourceGroupId && sourceGroupId === groupId) {
      throw new BadRequestException('لا يمكن اختيار نفس المجموعة كمجموعة منقول منها وإليها');
    }

    const group = await this.groupsRepository.findDetailById(groupId);
    if (!group) throw new NotFoundException('المجموعة غير موجودة');
    if (!group.isActive) {
      throw new BadRequestException('لا يمكن تسجيل اشتراكات جديدة في مجموعة متوقفة');
    }

    const sourceGroup = sourceGroupId
      ? await this.groupsRepository.findDetailById(sourceGroupId)
      : null;
    if (sourceGroupId && !sourceGroup) {
      throw new NotFoundException('المجموعة المنقول منها غير موجودة');
    }

    const parsedSheet = await this.excelService.parseUploadedWorkbook(file, {
      maxRows: MAX_IMPORT_ROWS,
    });
    const headerMap = this.excelService.resolveColumnHeaders<EnrollmentHeaderField>(
      parsedSheet.headers,
      ENROLLMENT_HEADER_ALIASES,
    );

    if (!headerMap.studentCode && !headerMap.studentPhone && !headerMap.studentName) {
      throw new BadRequestException(
        'ملف Excel لا يحتوي على أي عمود تعريفي للطالب (كود الطالب أو هاتف الطالب أو اسم الطالب).',
      );
    }

    const [allStudents, targetActiveIds, sourceActiveIds] = await Promise.all([
      this.enrollmentsRepository.findAllStudentsForEnrollmentExcel(),
      this.enrollmentsRepository.findActiveStudentIdsByGroup(groupId),
      sourceGroupId
        ? this.enrollmentsRepository.findActiveStudentIdsByGroup(sourceGroupId)
        : Promise.resolve([]),
    ]);

    const byCode = new Map<string, (typeof allStudents)[number]>();
    const byPhone = new Map<string, Array<(typeof allStudents)[number]>>();
    const byName = new Map<string, Array<(typeof allStudents)[number]>>();

    for (const s of allStudents) {
      if (s.studentCode) {
        byCode.set(s.studentCode.trim().toUpperCase(), s);
      }
      if (s.phone) {
        const normPhone = this.excelService.normalizePhoneText(s.phone);
        if (normPhone) {
          const list = byPhone.get(normPhone) ?? [];
          list.push(s);
          byPhone.set(normPhone, list);
        }
      }
      if (s.fullName) {
        const normName = s.fullName.trim().toLowerCase();
        const list = byName.get(normName) ?? [];
        list.push(s);
        byName.set(normName, list);
      }
    }

    const targetActiveSet = new Set(targetActiveIds);
    const sourceActiveSet = new Set(sourceActiveIds);
    const seenStudentIdsInFile = new Set<string>();
    const today = this.getTodayIsoDate();
    const defaultMonthlyPrice = Number(group.monthlyPrice);
    const defaultSessionsCount = Math.max(1, group.monthlySessionsCount);
    const remainingSeats = Math.max(0, group.maxStudents - targetActiveSet.size);

    const previewRows: ExcelImportPreviewRow[] = [];
    const validParsedRows: ParsedEnrollmentRow[] = [];

    for (const rawRow of parsedSheet.rows) {
      const getVal = (field: EnrollmentHeaderField) => {
        const header = headerMap[field];
        return header ? rawRow.cells[header] : undefined;
      };

      const rawCode = this.excelService.normalizeCellText(getVal('studentCode'));
      const rawName = this.excelService.normalizeCellText(getVal('studentName'));
      const rawPhone = this.excelService.normalizePhoneText(getVal('studentPhone'));
      const rawStartDate = getVal('startDate');
      const rawMonthlyPrice = this.excelService.normalizeCellText(getVal('agreedMonthlyPrice'));
      const rawSessionsCount = this.excelService.normalizeCellText(getVal('agreedSessionsCount'));
      const rawNotes = this.excelService.normalizeCellText(getVal('notes'));

      const errors: string[] = [];
      const warnings: string[] = [];

      // Resolve student identity cleanly by priority: code -> phone -> unique name
      let matchedStudent: (typeof allStudents)[number] | null = null;
      if (rawCode) {
        matchedStudent = byCode.get(rawCode.toUpperCase()) ?? null;
        if (!matchedStudent) {
          errors.push(`لم يتم العثور على طالب بالكود: ${rawCode}`);
        }
      } else if (rawPhone) {
        const matches = byPhone.get(rawPhone) ?? [];
        if (matches.length === 1) {
          matchedStudent = matches[0];
        } else if (matches.length > 1) {
          errors.push('يوجد أكثر من طالب بنفس رقم الهاتف؛ يرجى تحديد كود الطالب');
        } else {
          errors.push(`لم يتم العثور على طالب برقم الهاتف: ${rawPhone}`);
        }
      } else if (rawName) {
        const matches = byName.get(rawName.toLowerCase()) ?? [];
        if (matches.length === 1) {
          matchedStudent = matches[0];
        } else if (matches.length > 1) {
          errors.push('يوجد أكثر من طالب بنفس الاسم؛ يرجى تحديد كود الطالب أو رقم الهاتف');
        } else {
          errors.push(`الطالب "${rawName}" غير مسجل بالنظام — أضفه من شاشة الطلاب أولاً`);
        }
      } else {
        errors.push('يرجى إدخال كود الطالب أو رقم الهاتف أو اسم الطالب');
      }

      let startDate = today;
      if (rawStartDate !== undefined && rawStartDate !== null && String(rawStartDate).trim() !== '') {
        const parsedDate = this.excelService.normalizeDateCell(rawStartDate);
        if (!parsedDate) {
          errors.push('صيغة تاريخ البدء غير صالحة (استخدم YYYY-MM-DD)');
        } else {
          startDate = parsedDate;
        }
      }

      let agreedMonthlyPrice = defaultMonthlyPrice;
      if (rawMonthlyPrice && rawMonthlyPrice !== 'محجوب') {
        const parsedPrice = Number(this.excelService.normalizeArabicDigits(rawMonthlyPrice));
        if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
          errors.push('الاشتراك الشهري يجب أن يكون رقماً غير سالب');
        } else {
          agreedMonthlyPrice = Number(parsedPrice.toFixed(2));
        }
      }

      let agreedSessionsCount = defaultSessionsCount;
      if (rawSessionsCount) {
        const parsedSessions = Number(this.excelService.normalizeArabicDigits(rawSessionsCount));
        if (!Number.isInteger(parsedSessions) || parsedSessions < 1) {
          errors.push('عدد الحصص الشهرية يجب أن يكون رقماً صحيحاً أكبر من 0');
        } else {
          agreedSessionsCount = parsedSessions;
        }
      }

      let status: 'valid' | 'skip' | 'error' = errors.length > 0 ? 'error' : 'valid';

      if (status === 'valid' && matchedStudent) {
        if (seenStudentIdsInFile.has(matchedStudent.id)) {
          if (duplicateStrategy === 'skip') {
            status = 'skip';
            warnings.push('تكرار لنفس الطالب داخل الملف — تم تخطيه');
          } else {
            status = 'error';
            errors.push('تكرار لنفس الطالب داخل ملف Excel');
          }
        } else if (targetActiveSet.has(matchedStudent.id)) {
          if (duplicateStrategy === 'skip') {
            status = 'skip';
            warnings.push('الطالب مشترك بالفعل باشتراك نشط في هذه المجموعة');
          } else {
            status = 'error';
            errors.push('الطالب مشترك بالفعل باشتراك نشط في هذه المجموعة');
          }
        }
      }

      if (status === 'valid' && validParsedRows.length >= remainingSeats) {
        status = 'error';
        errors.push(
          `تجاوز السعة القصوى للمجموعة (المتاح ${remainingSeats} مقعداً فقط من أصل ${group.maxStudents})`,
        );
      }

      if (status === 'valid' && matchedStudent) {
        seenStudentIdsInFile.add(matchedStudent.id);
        if (sourceGroup && !sourceActiveSet.has(matchedStudent.id)) {
          warnings.push(
            `الطالب غير مشترك حالياً في "${sourceGroup.name}" — سيُضاف لهذه المجموعة فقط`,
          );
        }
        const agreedSessionPrice = Number(
          (agreedMonthlyPrice / Math.max(1, agreedSessionsCount)).toFixed(2),
        );
        validParsedRows.push({
          studentId: matchedStudent.id,
          studentCode: matchedStudent.studentCode,
          studentName: matchedStudent.fullName,
          studentPhone: matchedStudent.phone ?? rawPhone,
          startDate,
          agreedMonthlyPrice,
          agreedSessionsCount,
          agreedSessionPrice,
          notes: rawNotes || null,
        });
      }

      previewRows.push({
        rowNumber: rawRow.rowNumber,
        status,
        data: {
          studentCode: matchedStudent?.studentCode ?? (rawCode || '—'),
          studentName: matchedStudent?.fullName ?? (rawName || '—'),
          studentPhone: matchedStudent?.phone ?? (rawPhone || '—'),
          startDate,
          agreedMonthlyPrice,
          agreedSessionsCount,
        },
        errors,
        warnings,
      });
    }

    const preview: ExcelImportPreviewResponse = {
      totalRows: previewRows.length,
      validCount: previewRows.filter((r) => r.status === 'valid').length,
      skippedCount: previewRows.filter((r) => r.status === 'skip').length,
      errorCount: previewRows.filter((r) => r.status === 'error').length,
      warningCount: previewRows.reduce((sum, r) => sum + r.warnings.length, 0),
      rows: previewRows,
    };

    return {
      preview,
      validParsedRows,
      group,
      sourceGroup,
    };
  }
}
