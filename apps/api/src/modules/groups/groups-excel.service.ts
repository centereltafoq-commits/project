import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import {
  FullMonthAbsencePolicy,
  GroupRevenueSplitMethod,
  PERMISSIONS,
  SystemRole,
  TeacherEmploymentStatus,
} from '@edu-center/shared';
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
import { GroupExcelCommitDto, GroupExportQueryDto } from './dto/group-excel.dto';
import { GroupsMutationRepository } from './groups-mutation.repository';
import { GroupsRepository } from './groups.repository';

export interface ParsedGroupImportRow {
  groupCode: string | null;
  name: string;
  subject: string;
  gradeLevel: string;
  primaryTeacherId: string;
  primaryTeacherName: string;
  primaryTeacherCode: string;
  monthlySessionsCount: number;
  monthlyPrice: number;
  maxStudents: number;
  revenueSplitMethod: GroupRevenueSplitMethod;
  revenueSplitMethodLabel: string;
  teacherSharePerStudent: number;
  centerSharePerStudent: number;
  teacherPercentage: number;
  fullMonthAbsencePolicy: FullMonthAbsencePolicy;
  fullMonthAbsencePolicyLabel: string;
  fullAbsenceFixedFee: number;
  chargeExcusedAbsence: boolean;
  isActive: boolean;
  notes: string | null;
}

type GroupHeaderField =
  | 'groupCode'
  | 'name'
  | 'subject'
  | 'gradeLevel'
  | 'primaryTeacher'
  | 'primaryTeacherCode'
  | 'monthlySessionsCount'
  | 'monthlyPrice'
  | 'maxStudents'
  | 'revenueSplitMethod'
  | 'teacherSharePerStudent'
  | 'centerSharePerStudent'
  | 'teacherPercentage'
  | 'fullMonthAbsencePolicy'
  | 'fullAbsenceFixedFee'
  | 'chargeExcusedAbsence'
  | 'isActive'
  | 'notes';

type TeacherLookupRecord = {
  id: string;
  teacherCode: string;
  fullName: string;
  employmentStatus: string;
};

const SPLIT_METHOD_LABELS: Record<GroupRevenueSplitMethod, string> = {
  [GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO]: 'تناسب الحضور الفعلي',
  [GroupRevenueSplitMethod.FIXED_PER_STUDENT]: 'ثابت لكل طالب',
  [GroupRevenueSplitMethod.FIXED_PER_SESSION]: 'مبلغ ثابت للحصة',
  [GroupRevenueSplitMethod.CUSTOM_PERCENTAGE]: 'نسبة مئوية',
};

const SPLIT_METHOD_PARSE_MAP: Record<string, GroupRevenueSplitMethod> = {
  ACTUAL_ATTENDANCE_RATIO: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
  'تناسب الحضور الفعلي': GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
  'حسب نسبة الحضور الفعلي للحصص': GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
  'تناسب الحضور': GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
  FIXED_PER_STUDENT: GroupRevenueSplitMethod.FIXED_PER_STUDENT,
  'ثابت لكل طالب': GroupRevenueSplitMethod.FIXED_PER_STUDENT,
  'حصة ثابتة عن كل طالب مشترك': GroupRevenueSplitMethod.FIXED_PER_STUDENT,
  FIXED_PER_SESSION: GroupRevenueSplitMethod.FIXED_PER_SESSION,
  'مبلغ ثابت للحصة': GroupRevenueSplitMethod.FIXED_PER_SESSION,
  'مبلغ ثابت للمدرس عن كل حصة منفذة': GroupRevenueSplitMethod.FIXED_PER_SESSION,
  CUSTOM_PERCENTAGE: GroupRevenueSplitMethod.CUSTOM_PERCENTAGE,
  'نسبة مئوية': GroupRevenueSplitMethod.CUSTOM_PERCENTAGE,
  'نسبة مئوية للمدرس من الإيراد (%)': GroupRevenueSplitMethod.CUSTOM_PERCENTAGE,
};

const ABSENCE_POLICY_LABELS: Record<FullMonthAbsencePolicy, string> = {
  [FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE]: 'إعفاء كامل من الرسوم',
  [FullMonthAbsencePolicy.CHARGE_FULL_SUBSCRIPTION]: 'تحصيل الاشتراك كاملاً',
  [FullMonthAbsencePolicy.CHARGE_FIXED_RESERVATION_FEE]: 'تحصيل رسم حجز ثابت',
};

const ABSENCE_POLICY_PARSE_MAP: Record<string, FullMonthAbsencePolicy> = {
  EXEMPT_FULL_ABSENCE: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
  'إعفاء كامل من الرسوم': FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
  'اعفاء كامل من الرسوم': FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
  'إعفاء كامل عند الغياب طوال الشهر': FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
  'إعفاء كامل': FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
  CHARGE_FULL_SUBSCRIPTION: FullMonthAbsencePolicy.CHARGE_FULL_SUBSCRIPTION,
  'تحصيل الاشتراك كاملاً': FullMonthAbsencePolicy.CHARGE_FULL_SUBSCRIPTION,
  'تحصيل الاشتراك الشهري كاملاً': FullMonthAbsencePolicy.CHARGE_FULL_SUBSCRIPTION,
  'تحصيل الرسوم كاملة': FullMonthAbsencePolicy.CHARGE_FULL_SUBSCRIPTION,
  'تحصيل كامل': FullMonthAbsencePolicy.CHARGE_FULL_SUBSCRIPTION,
  CHARGE_FIXED_RESERVATION_FEE: FullMonthAbsencePolicy.CHARGE_FIXED_RESERVATION_FEE,
  'تحصيل رسم حجز ثابت': FullMonthAbsencePolicy.CHARGE_FIXED_RESERVATION_FEE,
  'تحصيل رسوم حجز مقعد ثابتة': FullMonthAbsencePolicy.CHARGE_FIXED_RESERVATION_FEE,
  'رسم حجز ثابت': FullMonthAbsencePolicy.CHARGE_FIXED_RESERVATION_FEE,
};

const GROUP_HEADER_ALIASES: Record<GroupHeaderField, string[]> = {
  groupCode: ['كود المجموعة (اختياري)', 'كود المجموعة', 'groupCode', 'code'],
  name: ['اسم المجموعة *', 'اسم المجموعة', 'groupName', 'name'],
  subject: ['المادة الدراسية *', 'المادة الدراسية', 'المادة', 'subject'],
  gradeLevel: ['الصف الدراسي *', 'الصف الدراسي', 'الصف', 'gradeLevel'],
  primaryTeacher: ['المدرس الأساسي *', 'المدرس الأساسي', 'المدرس', 'primaryTeacher'],
  primaryTeacherCode: ['كود المدرس الأساسي', 'كود المدرس', 'primaryTeacherCode'],
  monthlySessionsCount: ['عدد الحصص بالشهر *', 'عدد الحصص بالشهر', 'عدد الحصص', 'monthlySessionsCount'],
  monthlyPrice: ['سعر الشهر (ج.م) *', 'سعر الشهر (ج.م)', 'سعر الشهر', 'monthlyPrice'],
  maxStudents: ['السعة القصوى', 'السعة', 'maxStudents'],
  revenueSplitMethod: ['طريقة توزيع العائد', 'توزيع العائد', 'revenueSplitMethod'],
  teacherSharePerStudent: ['حصة المدرس / طالب', 'حصة المدرس', 'teacherSharePerStudent'],
  centerSharePerStudent: ['حصة السنتر / طالب', 'حصة السنتر', 'centerSharePerStudent'],
  teacherPercentage: ['نسبة المدرس (%)', 'نسبة المدرس', 'teacherPercentage'],
  fullMonthAbsencePolicy: ['سياسة الغياب الكامل', 'سياسة الغياب', 'fullMonthAbsencePolicy'],
  fullAbsenceFixedFee: ['رسم حجز الغياب الكامل', 'رسم الحجز', 'fullAbsenceFixedFee'],
  chargeExcusedAbsence: ['احتساب الغياب بعذر', 'chargeExcusedAbsence'],
  isActive: ['حالة المجموعة', 'الحالة', 'isActive'],
  notes: ['ملاحظات', 'notes'],
};

@Injectable()
export class GroupsExcelService {
  constructor(
    private readonly excelService: ExcelWorkbookService,
    private readonly repository: GroupsRepository,
    private readonly mutationRepository: GroupsMutationRepository,
    private readonly audit: AuditLogsService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  private canViewSplitFinance(actor?: AuthenticatedUser): boolean {
    if (!actor) return true;
    return (
      actor.roleCode === SystemRole.OWNER ||
      Boolean(actor.permissions?.includes(PERMISSIONS.FINANCE_VIEW)) ||
      Boolean(actor.permissions?.includes(PERMISSIONS.GROUPS_MANAGE))
    );
  }

  async generateTemplate(): Promise<Buffer> {
    const [gradeNames, allTeachers] = await Promise.all([
      this.repository.findActiveGradeLevelNames(),
      this.repository.findAllTeachersForExcel(),
    ]);

    const activeTeachers = allTeachers.filter(
      (t) => t.employmentStatus === TeacherEmploymentStatus.ACTIVE,
    );
    const teacherOptions = activeTeachers.map((t) => `${t.fullName} (${t.teacherCode})`);
    const sampleGrade = gradeNames[0] ?? 'الصف الثالث الثانوي';
    const sampleTeacher = teacherOptions[0] ?? 'أ. محمود حسن (TCH-1001)';

    return this.excelService.buildWorkbookBuffer({
      sheetName: 'بيانات المجموعات',
      columns: [
        { key: 'groupCode', header: 'كود المجموعة (اختياري)', width: 20, numFmt: '@' },
        { key: 'name', header: 'اسم المجموعة *', width: 28 },
        { key: 'subject', header: 'المادة الدراسية *', width: 22 },
        {
          key: 'gradeLevel',
          header: 'الصف الدراسي *',
          width: 24,
          dropdownValues: gradeNames,
        },
        {
          key: 'primaryTeacher',
          header: 'المدرس الأساسي *',
          width: 30,
          dropdownValues: teacherOptions,
        },
        { key: 'monthlySessionsCount', header: 'عدد الحصص بالشهر *', width: 18 },
        { key: 'monthlyPrice', header: 'سعر الشهر (ج.م) *', width: 18 },
        { key: 'maxStudents', header: 'السعة القصوى', width: 16 },
        {
          key: 'revenueSplitMethod',
          header: 'طريقة توزيع العائد',
          width: 24,
          dropdownValues: Object.values(SPLIT_METHOD_LABELS),
        },
        { key: 'teacherSharePerStudent', header: 'حصة المدرس / طالب', width: 18 },
        { key: 'centerSharePerStudent', header: 'حصة السنتر / طالب', width: 18 },
        { key: 'teacherPercentage', header: 'نسبة المدرس (%)', width: 18 },
        {
          key: 'fullMonthAbsencePolicy',
          header: 'سياسة الغياب الكامل',
          width: 24,
          dropdownValues: Object.values(ABSENCE_POLICY_LABELS),
        },
        { key: 'fullAbsenceFixedFee', header: 'رسم حجز الغياب الكامل', width: 20 },
        {
          key: 'chargeExcusedAbsence',
          header: 'احتساب الغياب بعذر',
          width: 18,
          dropdownValues: ['لا', 'نعم'],
        },
        {
          key: 'isActive',
          header: 'حالة المجموعة',
          width: 16,
          dropdownValues: ['نشطة', 'غير نشطة'],
        },
        { key: 'notes', header: 'ملاحظات', width: 30 },
      ],
      rows: [],
      validationRowCount: 500,
      instructionsSheet: {
        sheetName: 'التعليمات والأمثلة',
        title: 'تعليمات استيراد المجموعات الدراسية والسياسات المالية من Excel',
        lines: [
          'أدخل بيانات المجموعات في الورقة الأولى (بيانات المجموعات) بدءاً من الصف رقم 2 أسفل العناوين مباشرة.',
          'الحقول المميزة بعلامة (*) إجبارية: اسم المجموعة، المادة الدراسية، الصف الدراسي، المدرس الأساسي، عدد الحصص بالشهر، وسعر الشهر.',
          'كود المجموعة اختياري؛ إذا تُرك فارغاً سيقوم النظام بإنشاء كود فريد تلقائياً بصيغة GRP-XXXX.',
          'يمكن اختيار المدرس الأساسي من القائمة المنسدلة أو كتابة كود المدرس (مثل TCH-1001) أو اسمه الكامل.',
          'في طرق التوزيع بالحصة/الثابت: يجب ألا يتجاوز مجموع حصة المدرس وحصة السنتر سعر الشهر؛ وإذا تُركا فارغين تُحتسب حصة المدرس مساوية لسعر الشهر.',
          'تُنشأ المجموعات المستوردة بدون قاعة أو مواعيد مسندة، ويتم إسناد القاعة والمواعيد لاحقاً من صفحة إدارة القاعات.',
          'المثال التوضيحي بالأسفل للقراءة فقط ولن يتم استيراده إلا إذا أُدخل في الورقة الأولى.',
        ],
        sampleHeaders: [
          'كود المجموعة (اختياري)',
          'اسم المجموعة *',
          'المادة الدراسية *',
          'الصف الدراسي *',
          'المدرس الأساسي *',
          'عدد الحصص بالشهر *',
          'سعر الشهر (ج.م) *',
          'السعة القصوى',
          'طريقة توزيع العائد',
          'حصة المدرس / طالب',
          'حصة السنتر / طالب',
          'نسبة المدرس (%)',
          'سياسة الغياب الكامل',
          'رسم حجز الغياب الكامل',
          'احتساب الغياب بعذر',
          'حالة المجموعة',
          'ملاحظات',
        ],
        sampleRow: [
          '',
          'مجموعة الفيزياء المتقدمة أ',
          'الفيزياء',
          sampleGrade,
          sampleTeacher,
          8,
          400,
          50,
          'تناسب الحضور الفعلي',
          300,
          100,
          0,
          'إعفاء كامل من الرسوم',
          0,
          'لا',
          'نشطة',
          'مجموعة مسائية',
        ],
        referenceLists: [
          {
            title: 'الصفوف الدراسية المفعّلة في النظام',
            items: gradeNames,
          },
          {
            title: 'المدرسون النشطون في النظام',
            items: teacherOptions,
          },
        ],
      },
    });
  }

  async previewImport(
    file: UploadedMulterFile | undefined,
    duplicateStrategy: DuplicateImportStrategy = 'skip',
  ): Promise<ExcelImportPreviewResponse<ParsedGroupImportRow>> {
    return this.parseAndValidate(file, duplicateStrategy);
  }

  async commitImport(
    file: UploadedMulterFile | undefined,
    dto: GroupExcelCommitDto,
    actor: AuthenticatedUser,
  ): Promise<ExcelImportCommitResponse> {
    const duplicateStrategy = dto.duplicateStrategy ?? 'skip';
    const skipInvalidRows = dto.skipInvalidRows ?? false;
    const preview = await this.parseAndValidate(file, duplicateStrategy);

    if (preview.errorCount > 0 && !skipInvalidRows) {
      throw new BadRequestException(
        `يوجد ${preview.errorCount} صف يحتوي على أخطاء. صحّح الأخطاء أو فعّل خيار تجاهل الصفوف غير الصالحة للمتابعة.`,
      );
    }

    const validRows = preview.rows.filter((row) => row.status === 'valid');
    if (validRows.length === 0) {
      throw new BadRequestException('لا توجد صفوف صالحة للاستيراد بعد التحقق.');
    }

    const assignedCodes = await this.excelService.allocateUniqueCodes(
      validRows.map((row) => row.data.groupCode),
      'GRP-',
      async (candidates) => {
        const { existingCodes } = await this.repository.findExistingCodesAndGroupKeys(candidates, []);
        return existingCodes;
      },
    );

    const payload = validRows.map((row, index) => {
      const data = row.data;
      const calculatedSessionPrice = (data.monthlyPrice / data.monthlySessionsCount).toFixed(2);
      return {
        groupData: {
          groupCode: assignedCodes[index],
          name: data.name,
          subject: data.subject,
          gradeLevel: data.gradeLevel,
          primaryTeacherId: data.primaryTeacherId,
          defaultClassroomId: null,
          monthlySessionsCount: data.monthlySessionsCount,
          monthlyPrice: data.monthlyPrice.toFixed(2),
          calculatedSessionPrice,
          scheduleSlots: [],
          maxStudents: data.maxStudents,
          isActive: data.isActive,
          notes: data.notes,
        },
        policy: {
          revenueSplitMethod: data.revenueSplitMethod,
          teacherSharePerStudent: data.teacherSharePerStudent,
          centerSharePerStudent: data.centerSharePerStudent,
          teacherPercentage: data.teacherPercentage,
          fullMonthAbsencePolicy: data.fullMonthAbsencePolicy,
          fullAbsenceFixedFee: data.fullAbsenceFixedFee,
          chargeExcusedAbsence: data.chargeExcusedAbsence,
        },
        coTeacherIds: [],
        assistants: [],
      };
    });

    const inserted = await this.mutationRepository.createManyWithRelationsTx(payload);

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'IMPORT_GROUPS_EXCEL',
      entityType: 'GROUP',
      entityId: inserted[0]?.id ?? null,
      afterData: {
        importedCount: inserted.length,
        skippedCount: preview.skippedCount,
        failedCount: preview.errorCount,
        filename: file?.originalname ?? null,
      },
    });

    try {
      await Promise.all([
        this.cache?.invalidatePrefix('dashboard:summary:'),
        this.cache?.invalidatePrefix('reports:'),
      ]);
    } catch {}

    return {
      importedCount: inserted.length,
      skippedCount: preview.skippedCount,
      failedCount: preview.errorCount,
    };
  }

  async exportExcel(
    query: GroupExportQueryDto,
    actor?: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const rows = await this.repository.findAllForExport(query);
    const today = new Date().toISOString().slice(0, 10);
    const showFinance = this.canViewSplitFinance(actor);

    const buffer = await this.excelService.buildWorkbookBuffer({
      sheetName: 'سجل المجموعات',
      columns: [
        { key: 'groupCode', header: 'كود المجموعة', width: 18, numFmt: '@' },
        { key: 'name', header: 'اسم المجموعة', width: 28 },
        { key: 'subject', header: 'المادة الدراسية', width: 20 },
        { key: 'gradeLevel', header: 'الصف الدراسي', width: 22 },
        { key: 'primaryTeacherCode', header: 'كود المدرس الأساسي', width: 18, numFmt: '@' },
        { key: 'primaryTeacherName', header: 'المدرس الأساسي', width: 26 },
        { key: 'defaultClassroomName', header: 'القاعة الافتراضية', width: 20 },
        { key: 'activeStudentsCount', header: 'الطلاب النشطون', width: 16 },
        { key: 'maxStudents', header: 'السعة القصوى', width: 14 },
        { key: 'monthlySessionsCount', header: 'عدد الحصص بالشهر', width: 18 },
        { key: 'monthlyPrice', header: 'سعر الشهر (ج.م)', width: 16 },
        { key: 'calculatedSessionPrice', header: 'سعر الحصة (ج.م)', width: 16 },
        { key: 'revenueSplitMethod', header: 'طريقة توزيع العائد', width: 24 },
        { key: 'teacherSharePerStudent', header: 'حصة المدرس / طالب', width: 18 },
        { key: 'centerSharePerStudent', header: 'حصة السنتر / طالب', width: 18 },
        { key: 'teacherPercentage', header: 'نسبة المدرس (%)', width: 16 },
        { key: 'fullMonthAbsencePolicy', header: 'سياسة الغياب الكامل', width: 24 },
        { key: 'fullAbsenceFixedFee', header: 'رسم حجز الغياب الكامل', width: 20 },
        { key: 'chargeExcusedAbsence', header: 'احتساب الغياب بعذر', width: 18 },
        { key: 'isActive', header: 'حالة المجموعة', width: 16 },
        { key: 'notes', header: 'ملاحظات', width: 30 },
      ],
      rows: rows.map((row) => {
        const splitMethod = row.revenueSplitMethod as GroupRevenueSplitMethod | null;
        const absencePolicy = row.fullMonthAbsencePolicy as FullMonthAbsencePolicy | null;
        return {
          groupCode: row.groupCode,
          name: row.name,
          subject: row.subject,
          gradeLevel: row.gradeLevel,
          primaryTeacherCode: row.primaryTeacherCode,
          primaryTeacherName: row.primaryTeacherName,
          defaultClassroomName: row.defaultClassroomName ?? 'غير مسندة',
          activeStudentsCount: Number(row.activeStudentsCount ?? 0),
          maxStudents: Number(row.maxStudents ?? 50),
          monthlySessionsCount: Number(row.monthlySessionsCount),
          monthlyPrice: Number(row.monthlyPrice),
          calculatedSessionPrice: Number(row.calculatedSessionPrice),
          revenueSplitMethod:
            (splitMethod ? SPLIT_METHOD_LABELS[splitMethod] : null) ?? 'تناسب الحضور الفعلي',
          teacherSharePerStudent: showFinance ? Number(row.teacherSharePerStudent ?? 0) : 'محجوب',
          centerSharePerStudent: showFinance ? Number(row.centerSharePerStudent ?? 0) : 'محجوب',
          teacherPercentage: showFinance ? Number(row.teacherPercentage ?? 0) : 'محجوب',
          fullMonthAbsencePolicy:
            (absencePolicy ? ABSENCE_POLICY_LABELS[absencePolicy] : null) ??
            'إعفاء كامل من الرسوم',
          fullAbsenceFixedFee: showFinance ? Number(row.fullAbsenceFixedFee ?? 0) : 'محجوب',
          chargeExcusedAbsence: row.chargeExcusedAbsence ? 'نعم' : 'لا',
          isActive: row.isActive ? 'نشطة' : 'غير نشطة',
          notes: row.notes ?? '',
        };
      }),
    });

    return {
      buffer,
      filename: `groups-${today}.xlsx`,
    };
  }

  private async parseAndValidate(
    file: UploadedMulterFile | undefined,
    duplicateStrategy: DuplicateImportStrategy,
  ): Promise<ExcelImportPreviewResponse<ParsedGroupImportRow>> {
    const parsedSheet = await this.excelService.parseUploadedWorkbook(file, { maxRows: 2000 });
    const headerLookup = this.excelService.resolveColumnHeaders(
      parsedSheet.headers,
      GROUP_HEADER_ALIASES,
    );

    if (
      !headerLookup.name ||
      !headerLookup.subject ||
      !headerLookup.gradeLevel ||
      (!headerLookup.primaryTeacher && !headerLookup.primaryTeacherCode) ||
      !headerLookup.monthlySessionsCount ||
      !headerLookup.monthlyPrice
    ) {
      throw new BadRequestException(
        'تنسيق الأعمدة غير مطابق للنموذج المعتمد. تأكد من وجود الأعمدة الإلزامية: اسم المجموعة، المادة الدراسية، الصف الدراسي، المدرس الأساسي، عدد الحصص بالشهر، وسعر الشهر.',
      );
    }

    const [gradeRecords, teacherRecords] = await Promise.all([
      this.repository.findAllGradeLevelRecords(),
      this.repository.findAllTeachersForExcel(),
    ]);

    const gradeMap = new Map<string, { name: string; isActive: boolean }>();
    for (const record of gradeRecords) {
      gradeMap.set(record.name.trim().toLowerCase(), record);
    }

    const teacherByCode = new Map<string, TeacherLookupRecord>();
    const teachersByName = new Map<string, TeacherLookupRecord[]>();
    for (const teacher of teacherRecords) {
      teacherByCode.set(teacher.teacherCode.trim().toUpperCase(), teacher);
      const nameKey = teacher.fullName.trim().toLowerCase();
      const bucket = teachersByName.get(nameKey) ?? [];
      bucket.push(teacher);
      teachersByName.set(nameKey, bucket);
    }

    const candidateCodes: string[] = [];
    const candidateTeacherIds = new Set<string>();
    const preResolvedRows = parsedSheet.rows.map((row) => {
      const code = headerLookup.groupCode
        ? this.excelService.normalizeCellText(row.cells[headerLookup.groupCode])
        : '';
      if (code) candidateCodes.push(code);

      const rawTeacher = headerLookup.primaryTeacher
        ? this.excelService.normalizeCellText(row.cells[headerLookup.primaryTeacher])
        : '';
      const rawTeacherCode = headerLookup.primaryTeacherCode
        ? this.excelService.normalizeCellText(row.cells[headerLookup.primaryTeacherCode])
        : '';
      const teacherMatch = this.resolveTeacher(rawTeacher, rawTeacherCode, teacherByCode, teachersByName);
      if (teacherMatch.teacher) {
        candidateTeacherIds.add(teacherMatch.teacher.id);
      }

      return { row, code, rawTeacher, rawTeacherCode, teacherMatch };
    });

    const { existingCodes, existingGroupKeys } =
      await this.repository.findExistingCodesAndGroupKeys(
        candidateCodes,
        Array.from(candidateTeacherIds),
      );

    const seenInFileCodes = new Set<string>();
    const seenInFileGroupKeys = new Set<string>();

    let validCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let warningCount = 0;

    const previewRows: ExcelImportPreviewRow<ParsedGroupImportRow>[] = preResolvedRows.map(
      ({ row, code: rawCode, teacherMatch }) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        const getCell = (field: GroupHeaderField): string =>
          headerLookup[field]
            ? this.excelService.normalizeCellText(row.cells[headerLookup[field]!])
            : '';

        const name = getCell('name');
        const subject = getCell('subject');
        const rawGradeLevel = getCell('gradeLevel');
        const rawSessions = getCell('monthlySessionsCount');
        const rawPrice = getCell('monthlyPrice');
        const rawMaxStudents = getCell('maxStudents');
        const rawSplitMethod = getCell('revenueSplitMethod');
        const rawTeacherShare = getCell('teacherSharePerStudent');
        const rawCenterShare = getCell('centerSharePerStudent');
        const rawTeacherPercentage = getCell('teacherPercentage');
        const rawAbsencePolicy = getCell('fullMonthAbsencePolicy');
        const rawAbsenceFee = getCell('fullAbsenceFixedFee');
        const rawChargeExcused = getCell('chargeExcusedAbsence');
        const rawIsActive = getCell('isActive');
        const rawNotes = getCell('notes');

        if (!name || name.length < 2) {
          errors.push('اسم المجموعة مطلوب (حرفان على الأقل)');
        } else if (name.length > 160) {
          errors.push('اسم المجموعة يتجاوز الحد الأقصى (160 حرفاً)');
        }

        if (!subject) {
          errors.push('المادة الدراسية مطلوبة');
        } else if (subject.length > 100) {
          errors.push('المادة الدراسية تتجاوز الحد الأقصى (100 حرف)');
        }

        let gradeLevel = rawGradeLevel;
        if (!rawGradeLevel) {
          errors.push('الصف الدراسي مطلوب');
        } else if (rawGradeLevel.length > 80) {
          errors.push('الصف الدراسي يتجاوز الحد الأقصى (80 حرفاً)');
        } else if (gradeRecords.length > 0) {
          const matchedGrade = gradeMap.get(rawGradeLevel.trim().toLowerCase());
          if (!matchedGrade) {
            errors.push(`الصف الدراسي "${rawGradeLevel}" غير مسجل في النظام`);
          } else if (!matchedGrade.isActive) {
            errors.push(`الصف الدراسي "${matchedGrade.name}" معطّل حالياً`);
          } else {
            gradeLevel = matchedGrade.name;
          }
        }

        const resolvedTeacher = teacherMatch.teacher;
        if (teacherMatch.error) {
          errors.push(teacherMatch.error);
        } else if (resolvedTeacher && resolvedTeacher.employmentStatus !== TeacherEmploymentStatus.ACTIVE) {
          errors.push(`المدرس "${resolvedTeacher.fullName}" غير نشط حالياً`);
        }

        const monthlySessionsCount = this.parsePositiveIntCell(
          rawSessions,
          'عدد الحصص بالشهر',
          1,
          60,
          errors,
        );
        const monthlyPrice = this.parseNonNegativeNumberCell(
          rawPrice,
          'سعر الشهر (ج.م)',
          true,
          errors,
        );

        let maxStudents = 50;
        if (rawMaxStudents) {
          const parsedMax = this.parsePositiveIntCell(
            rawMaxStudents,
            'السعة القصوى',
            1,
            500,
            errors,
          );
          if (parsedMax !== null) {
            maxStudents = parsedMax;
          }
        }

        const policyResult = this.parseFinancialPolicy({
          rawSplitMethod,
          rawTeacherShare,
          rawCenterShare,
          rawTeacherPercentage,
          rawAbsencePolicy,
          rawAbsenceFee,
          rawChargeExcused,
          monthlyPrice: monthlyPrice ?? 0,
          hasValidMonthlyPrice: monthlyPrice !== null,
          errors,
        });

        let isActive = true;
        if (rawIsActive) {
          const parsedActive = this.parseBooleanOrStatus(rawIsActive, [
            'نشطة',
            'نشط',
            'active',
            'true',
            '1',
            'نعم',
          ], [
            'غير نشطة',
            'غير نشط',
            'inactive',
            'false',
            '0',
            'لا',
          ]);
          if (parsedActive === null) {
            errors.push('حالة المجموعة غير صالحة (المسموح: نشطة أو غير نشطة)');
          } else {
            isActive = parsedActive;
          }
        }

        if (rawNotes.length > 2000) {
          errors.push('الملاحظات تتجاوز الحد الأقصى (2000 حرف)');
        }

        let isSkipped = false;
        if (rawCode) {
          if (rawCode.length > 40) {
            errors.push('كود المجموعة يتجاوز الحد الأقصى (40 حرفاً)');
          } else {
            const upperCode = rawCode.toUpperCase();
            if (seenInFileCodes.has(upperCode)) {
              errors.push(`كود المجموعة "${rawCode}" مكرر داخل نفس الملف`);
            } else {
              seenInFileCodes.add(upperCode);
            }

            if (existingCodes.has(upperCode)) {
              if (duplicateStrategy === 'skip') {
                isSkipped = true;
                warnings.push(`كود المجموعة "${rawCode}" مسجل مسبقاً — سيتم تخطي هذا الصف`);
              } else {
                errors.push(`كود المجموعة "${rawCode}" مسجل مسبقاً في قاعدة البيانات`);
              }
            }
          }
        }

        if (name && gradeLevel && resolvedTeacher) {
          const groupKey = `${name.trim().toLowerCase()}|${gradeLevel.trim().toLowerCase()}|${resolvedTeacher.id}`;
          if (seenInFileGroupKeys.has(groupKey)) {
            warnings.push('يوجد صف آخر في نفس الملف بنفس اسم المجموعة والصف والمدرس');
          } else {
            seenInFileGroupKeys.add(groupKey);
          }

          if (!isSkipped && existingGroupKeys.has(groupKey)) {
            warnings.push('توجد مجموعة مسجلة مسبقاً في النظام بنفس الاسم والصف والمدرس');
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
            groupCode: rawCode || null,
            name,
            subject,
            gradeLevel,
            primaryTeacherId: resolvedTeacher?.id ?? '',
            primaryTeacherName: resolvedTeacher?.fullName ?? '',
            primaryTeacherCode: resolvedTeacher?.teacherCode ?? '',
            monthlySessionsCount: monthlySessionsCount ?? 0,
            monthlyPrice: monthlyPrice ?? 0,
            maxStudents,
            revenueSplitMethod: policyResult.revenueSplitMethod,
            revenueSplitMethodLabel: SPLIT_METHOD_LABELS[policyResult.revenueSplitMethod],
            teacherSharePerStudent: policyResult.teacherSharePerStudent,
            centerSharePerStudent: policyResult.centerSharePerStudent,
            teacherPercentage: policyResult.teacherPercentage,
            fullMonthAbsencePolicy: policyResult.fullMonthAbsencePolicy,
            fullMonthAbsencePolicyLabel: ABSENCE_POLICY_LABELS[policyResult.fullMonthAbsencePolicy],
            fullAbsenceFixedFee: policyResult.fullAbsenceFixedFee,
            chargeExcusedAbsence: policyResult.chargeExcusedAbsence,
            isActive,
            notes: rawNotes || null,
          },
          errors,
          warnings,
        };
      },
    );

    return {
      totalRows: previewRows.length,
      validCount,
      skippedCount,
      errorCount,
      warningCount,
      rows: previewRows,
    };
  }

  private resolveTeacher(
    rawTeacher: string,
    rawTeacherCode: string,
    teacherByCode: Map<string, TeacherLookupRecord>,
    teachersByName: Map<string, TeacherLookupRecord[]>,
  ): { teacher: TeacherLookupRecord | null; error: string | null } {
    const cleanCode = rawTeacherCode.trim();
    if (cleanCode) {
      const matched = teacherByCode.get(cleanCode.toUpperCase());
      if (matched) return { teacher: matched, error: null };
    }

    const cleanRaw = rawTeacher.trim();
    if (!cleanRaw && !cleanCode) {
      return { teacher: null, error: 'المدرس الأساسي مطلوب' };
    }

    if (cleanRaw) {
      // Match "Name (CODE)" format generated in dropdowns or direct code
      const parenMatch = cleanRaw.match(/\(([^()]+)\)\s*$/);
      if (parenMatch) {
        const extractedCode = parenMatch[1].trim().toUpperCase();
        const byExtracted = teacherByCode.get(extractedCode);
        if (byExtracted) return { teacher: byExtracted, error: null };
      }

      const directByCode = teacherByCode.get(cleanRaw.toUpperCase());
      if (directByCode) return { teacher: directByCode, error: null };

      const byNameMatches = teachersByName.get(cleanRaw.toLowerCase()) ?? [];
      if (byNameMatches.length === 1) {
        return { teacher: byNameMatches[0], error: null };
      }
      if (byNameMatches.length > 1) {
        return {
          teacher: null,
          error: `يوجد أكثر من مدرس باسم "${cleanRaw}" — يرجى اختيار المدرس مع الكود من القائمة أو إدخال كوده`,
        };
      }
    }

    return {
      teacher: null,
      error: `المدرس "${cleanRaw || cleanCode}" غير مسجل في النظام`,
    };
  }

  private parsePositiveIntCell(
    raw: string,
    label: string,
    min: number,
    max: number,
    errors: string[],
  ): number | null {
    if (!raw) {
      errors.push(`${label} مطلوب`);
      return null;
    }

    const normalized = this.excelService.normalizeArabicDigits(raw).replace(/,/g, '');
    if (!/^-?\d+$/.test(normalized)) {
      errors.push(`${label} يجب أن يكون رقماً صحيحاً`);
      return null;
    }

    const value = Number.parseInt(normalized, 10);
    if (value < min || value > max) {
      errors.push(`${label} يجب أن يكون بين ${min} و ${max}`);
      return null;
    }
    return value;
  }

  private parseNonNegativeNumberCell(
    raw: string,
    label: string,
    required: boolean,
    errors: string[],
  ): number | null {
    if (!raw) {
      if (required) {
        errors.push(`${label} مطلوب`);
      }
      return null;
    }

    const normalized = this.excelService.normalizeArabicDigits(raw).replace(/,/g, '');
    const value = Number(normalized);
    if (!Number.isFinite(value) || value < 0) {
      errors.push(`${label} يجب أن يكون رقماً غير سالب`);
      return null;
    }
    return Number(value.toFixed(2));
  }

  private parseBooleanOrStatus(
    raw: string,
    truthyTokens: string[],
    falsyTokens: string[],
  ): boolean | null {
    const normalized = this.excelService.normalizeArabicDigits(raw).trim().toLowerCase();
    if (truthyTokens.some((token) => token.toLowerCase() === normalized)) return true;
    if (falsyTokens.some((token) => token.toLowerCase() === normalized)) return false;
    return null;
  }

  private parseFinancialPolicy(input: {
    rawSplitMethod: string;
    rawTeacherShare: string;
    rawCenterShare: string;
    rawTeacherPercentage: string;
    rawAbsencePolicy: string;
    rawAbsenceFee: string;
    rawChargeExcused: string;
    monthlyPrice: number;
    hasValidMonthlyPrice: boolean;
    errors: string[];
  }) {
    let revenueSplitMethod = GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO;
    if (input.rawSplitMethod) {
      const mapped =
        SPLIT_METHOD_PARSE_MAP[input.rawSplitMethod.toUpperCase()] ??
        SPLIT_METHOD_PARSE_MAP[input.rawSplitMethod];
      if (!mapped) {
        input.errors.push(
          'طريقة توزيع العائد غير صالحة (تناسب الحضور الفعلي / ثابت لكل طالب / مبلغ ثابت للحصة / نسبة مئوية)',
        );
      } else {
        revenueSplitMethod = mapped;
      }
    }

    const parsedTeacherShare = this.parseNonNegativeNumberCell(
      input.rawTeacherShare,
      'حصة المدرس / طالب',
      false,
      input.errors,
    );
    const parsedCenterShare = this.parseNonNegativeNumberCell(
      input.rawCenterShare,
      'حصة السنتر / طالب',
      false,
      input.errors,
    );
    const parsedTeacherPct = this.parseNonNegativeNumberCell(
      input.rawTeacherPercentage,
      'نسبة المدرس (%)',
      false,
      input.errors,
    );

    let teacherSharePerStudent = 0;
    let centerSharePerStudent = 0;
    let teacherPercentage = 0;

    if (revenueSplitMethod === GroupRevenueSplitMethod.CUSTOM_PERCENTAGE) {
      if (parsedTeacherPct === null) {
        input.errors.push('نسبة المدرس (%) مطلوبة عند اختيار طريقة النسبة المئوية');
      } else if (parsedTeacherPct > 100) {
        input.errors.push('نسبة المدرس المئوية يجب أن تكون بين 0 و 100');
      } else {
        teacherPercentage = parsedTeacherPct;
      }
    } else if (revenueSplitMethod === GroupRevenueSplitMethod.FIXED_PER_SESSION) {
      if (parsedTeacherShare === null) {
        input.errors.push('حصة المدرس مطلوبة عند اختيار طريقة مبلغ ثابت للحصة');
      } else {
        teacherSharePerStudent = parsedTeacherShare;
      }
      centerSharePerStudent = parsedCenterShare ?? 0;
    } else if (input.hasValidMonthlyPrice) {
      if (parsedTeacherShare === null && parsedCenterShare === null) {
        teacherSharePerStudent = input.monthlyPrice;
        centerSharePerStudent = 0;
      } else if (parsedTeacherShare !== null && parsedCenterShare === null) {
        teacherSharePerStudent = parsedTeacherShare;
        if (teacherSharePerStudent > input.monthlyPrice + 0.001) {
          input.errors.push('حصة المدرس لا يمكن أن تتجاوز سعر الشهر');
        } else {
          centerSharePerStudent = Number(
            Math.max(0, input.monthlyPrice - teacherSharePerStudent).toFixed(2),
          );
        }
      } else if (parsedTeacherShare === null && parsedCenterShare !== null) {
        centerSharePerStudent = parsedCenterShare;
        if (centerSharePerStudent > input.monthlyPrice + 0.001) {
          input.errors.push('حصة السنتر لا يمكن أن تتجاوز سعر الشهر');
        } else {
          teacherSharePerStudent = Number(
            Math.max(0, input.monthlyPrice - centerSharePerStudent).toFixed(2),
          );
        }
      } else {
        teacherSharePerStudent = parsedTeacherShare ?? 0;
        centerSharePerStudent = parsedCenterShare ?? 0;
        if (teacherSharePerStudent + centerSharePerStudent > input.monthlyPrice + 0.001) {
          input.errors.push('مجموع حصة المدرس وحصة السنتر لا يمكن أن يتجاوز سعر الاشتراك الشهري');
        }
      }
    }

    let fullMonthAbsencePolicy = FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE;
    if (input.rawAbsencePolicy) {
      const mappedPolicy =
        ABSENCE_POLICY_PARSE_MAP[input.rawAbsencePolicy.toUpperCase()] ??
        ABSENCE_POLICY_PARSE_MAP[input.rawAbsencePolicy];
      if (!mappedPolicy) {
        input.errors.push(
          'سياسة الغياب الكامل غير صالحة (إعفاء كامل من الرسوم / تحصيل الاشتراك كاملاً / تحصيل رسم حجز ثابت)',
        );
      } else {
        fullMonthAbsencePolicy = mappedPolicy;
      }
    }

    let fullAbsenceFixedFee = 0;
    const parsedFee = this.parseNonNegativeNumberCell(
      input.rawAbsenceFee,
      'رسم حجز الغياب الكامل',
      false,
      input.errors,
    );
    if (parsedFee !== null) {
      fullAbsenceFixedFee = parsedFee;
    }

    if (
      fullMonthAbsencePolicy === FullMonthAbsencePolicy.CHARGE_FIXED_RESERVATION_FEE &&
      input.hasValidMonthlyPrice &&
      fullAbsenceFixedFee > input.monthlyPrice + 0.001
    ) {
      input.errors.push('رسم حجز الغياب الكامل لا يمكن أن يتجاوز سعر الشهر');
    }

    let chargeExcusedAbsence = false;
    if (input.rawChargeExcused) {
      const parsedExcused = this.parseBooleanOrStatus(
        input.rawChargeExcused,
        ['نعم', 'yes', 'true', '1'],
        ['لا', 'no', 'false', '0'],
      );
      if (parsedExcused === null) {
        input.errors.push('قيمة احتساب الغياب بعذر غير صالحة (المسموح: نعم أو لا)');
      } else {
        chargeExcusedAbsence = parsedExcused;
      }
    }

    return {
      revenueSplitMethod,
      teacherSharePerStudent,
      centerSharePerStudent,
      teacherPercentage,
      fullMonthAbsencePolicy,
      fullAbsenceFixedFee,
      chargeExcusedAbsence,
    };
  }
}
