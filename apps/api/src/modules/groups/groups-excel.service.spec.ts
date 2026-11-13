import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FullMonthAbsencePolicy,
  GroupRevenueSplitMethod,
  PERMISSIONS,
  TeacherEmploymentStatus,
} from '@edu-center/shared';
import { ExcelWorkbookService } from '../../common/excel/excel-workbook.service';
import type { UploadedMulterFile } from '../../common/types/multer.types';
import { GroupsExcelService } from './groups-excel.service';

describe('GroupsExcelService', () => {
  const excelService = new ExcelWorkbookService();
  let mockRepo: {
    findActiveGradeLevelNames: ReturnType<typeof vi.fn>;
    findAllGradeLevelRecords: ReturnType<typeof vi.fn>;
    findAllTeachersForExcel: ReturnType<typeof vi.fn>;
    findExistingCodesAndGroupKeys: ReturnType<typeof vi.fn>;
    findAllForExport: ReturnType<typeof vi.fn>;
  };
  let mockMutationRepo: {
    createManyWithRelationsTx: ReturnType<typeof vi.fn>;
  };
  let mockAudit: { record: ReturnType<typeof vi.fn> };
  let mockCache: { invalidatePrefix: ReturnType<typeof vi.fn> };
  let service: GroupsExcelService;

  const ownerActor = {
    id: 'user-1',
    username: 'admin',
    fullName: 'المدير العام',
    roleId: 'role-1',
    roleCode: 'OWNER',
    permissions: [PERMISSIONS.GROUPS_MANAGE, PERMISSIONS.GROUPS_VIEW, PERMISSIONS.REPORTS_EXPORT],
  };

  beforeEach(() => {
    mockRepo = {
      findActiveGradeLevelNames: vi
        .fn()
        .mockResolvedValue(['الصف الأول الثانوي', 'الصف الثالث الثانوي']),
      findAllGradeLevelRecords: vi.fn().mockResolvedValue([
        { name: 'الصف الأول الثانوي', isActive: true },
        { name: 'الصف الثالث الثانوي', isActive: true },
        { name: 'الصف الأول الإعدادي', isActive: false },
      ]),
      findAllTeachersForExcel: vi.fn().mockResolvedValue([
        {
          id: 'teacher-1',
          teacherCode: 'TCH-1001',
          fullName: 'أ. محمود حسن',
          employmentStatus: TeacherEmploymentStatus.ACTIVE,
        },
        {
          id: 'teacher-2',
          teacherCode: 'TCH-1002',
          fullName: 'أ. سارة علي',
          employmentStatus: TeacherEmploymentStatus.INACTIVE,
        },
        {
          id: 'teacher-3',
          teacherCode: 'TCH-1003',
          fullName: 'أ. كريم طارق',
          employmentStatus: TeacherEmploymentStatus.ACTIVE,
        },
        {
          id: 'teacher-4',
          teacherCode: 'TCH-1004',
          fullName: 'أ. كريم طارق',
          employmentStatus: TeacherEmploymentStatus.ACTIVE,
        },
      ]),
      findExistingCodesAndGroupKeys: vi.fn().mockResolvedValue({
        existingCodes: new Set(['GRP-9999']),
        existingGroupKeys: new Set(['مجموعة كيمياء سابقة|الصف الأول الثانوي|teacher-1']),
      }),
      findAllForExport: vi.fn().mockResolvedValue([
        {
          id: 'g1',
          groupCode: 'GRP-1001',
          name: 'مجموعة الفيزياء أ',
          subject: 'الفيزياء',
          gradeLevel: 'الصف الثالث الثانوي',
          primaryTeacherId: 'teacher-1',
          primaryTeacherName: 'أ. محمود حسن',
          primaryTeacherCode: 'TCH-1001',
          defaultClassroomName: 'قاعة النور',
          monthlySessionsCount: 8,
          monthlyPrice: '400.00',
          calculatedSessionPrice: '50.00',
          maxStudents: 40,
          activeStudentsCount: 22,
          revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
          teacherSharePerStudent: '300.00',
          centerSharePerStudent: '100.00',
          teacherPercentage: '0.00',
          fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
          fullAbsenceFixedFee: '0.00',
          chargeExcusedAbsence: false,
          isActive: true,
          notes: 'ملاحظة اختبارية',
        },
      ]),
    };

    mockMutationRepo = {
      createManyWithRelationsTx: vi.fn().mockImplementation(async (items) =>
        items.map((item: { groupData: Record<string, unknown> }, idx: number) => ({
          id: `group-${idx + 1}`,
          ...item.groupData,
        })),
      ),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    mockCache = {
      invalidatePrefix: vi.fn().mockResolvedValue(undefined),
    };

    service = new GroupsExcelService(
      excelService,
      mockRepo as never,
      mockMutationRepo as never,
      mockAudit as never,
      mockCache as never,
    );
  });

  async function buildXlsxUpload(
    rows: Array<Record<string, unknown>>,
    name = 'groups.xlsx',
  ): Promise<UploadedMulterFile> {
    const buffer = await excelService.buildWorkbookBuffer({
      sheetName: 'بيانات المجموعات',
      columns: [
        { key: 'groupCode', header: 'كود المجموعة (اختياري)', numFmt: '@' },
        { key: 'name', header: 'اسم المجموعة *' },
        { key: 'subject', header: 'المادة الدراسية *' },
        { key: 'gradeLevel', header: 'الصف الدراسي *' },
        { key: 'primaryTeacher', header: 'المدرس الأساسي *' },
        { key: 'monthlySessionsCount', header: 'عدد الحصص بالشهر *' },
        { key: 'monthlyPrice', header: 'سعر الشهر (ج.م) *' },
        { key: 'maxStudents', header: 'السعة القصوى' },
        { key: 'revenueSplitMethod', header: 'طريقة توزيع العائد' },
        { key: 'teacherSharePerStudent', header: 'حصة المدرس / طالب' },
        { key: 'centerSharePerStudent', header: 'حصة السنتر / طالب' },
        { key: 'teacherPercentage', header: 'نسبة المدرس (%)' },
        { key: 'fullMonthAbsencePolicy', header: 'سياسة الغياب الكامل' },
        { key: 'fullAbsenceFixedFee', header: 'رسم حجز الغياب الكامل' },
        { key: 'chargeExcusedAbsence', header: 'احتساب الغياب بعذر' },
        { key: 'isActive', header: 'حالة المجموعة' },
        { key: 'notes', header: 'ملاحظات' },
      ],
      rows,
    });

    return {
      fieldname: 'file',
      originalname: name,
      encoding: '7bit',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: buffer.length,
      buffer,
    };
  }

  it('generates a styled RTL template with empty data sheet and Arabic headers', async () => {
    const buffer = await service.generateTemplate();
    const parsed = await excelService.parseUploadedWorkbook(
      {
        fieldname: 'file',
        originalname: 'groups-import-template.xlsx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: buffer.length,
        buffer,
      },
      { maxRows: 2000 },
    );

    expect(parsed.sheetName).toBe('بيانات المجموعات');
    expect(parsed.headers).toContain('اسم المجموعة *');
    expect(parsed.headers).toContain('المدرس الأساسي *');
    expect(parsed.headers).toContain('سعر الشهر (ج.م) *');
    expect(parsed.rows).toHaveLength(0);
  });

  it('validates teacher lookup, Arabic digits, financial policy defaults, and duplicates', async () => {
    const file = await buildXlsxUpload([
      {
        // Valid row using label "Name (CODE)" and Arabic numerals, auto-complementing center share
        name: 'فيزياء متقدمة 1',
        subject: 'الفيزياء',
        gradeLevel: 'الصف الثالث الثانوي',
        primaryTeacher: 'أ. محمود حسن (TCH-1001)',
        monthlySessionsCount: '٨',
        monthlyPrice: '٤٠٠',
        revenueSplitMethod: 'تناسب الحضور الفعلي',
        teacherSharePerStudent: '٣٠٠',
      },
      {
        // Valid row matching teacher by exact name and custom percentage
        name: 'كيمياء تأسيس',
        subject: 'الكيمياء',
        gradeLevel: 'الصف الأول الثانوي',
        primaryTeacher: 'أ. محمود حسن',
        monthlySessionsCount: 4,
        monthlyPrice: 300,
        revenueSplitMethod: 'نسبة مئوية',
        teacherPercentage: 70,
        fullMonthAbsencePolicy: 'تحصيل رسم حجز ثابت',
        fullAbsenceFixedFee: 50,
        chargeExcusedAbsence: 'نعم',
        isActive: 'غير نشطة',
      },
      {
        // Duplicate existing code -> skipped under skip strategy
        groupCode: 'GRP-9999',
        name: 'مجموعة مكررة',
        subject: 'الفيزياء',
        gradeLevel: 'الصف الأول الثانوي',
        primaryTeacher: 'TCH-1001',
        monthlySessionsCount: 8,
        monthlyPrice: 320,
      },
      {
        // Errors: inactive teacher + disabled grade + shares exceed monthlyPrice
        name: 'مجموعة غير صالحة',
        subject: 'رياضيات',
        gradeLevel: 'الصف الأول الإعدادي',
        primaryTeacher: 'TCH-1002',
        monthlySessionsCount: 8,
        monthlyPrice: 200,
        teacherSharePerStudent: 150,
        centerSharePerStudent: 100,
      },
      {
        // Error: ambiguous teacher name without code
        name: 'مجموعة اسم مكرر',
        subject: 'رياضيات',
        gradeLevel: 'الصف الأول الثانوي',
        primaryTeacher: 'أ. كريم طارق',
        monthlySessionsCount: 8,
        monthlyPrice: 200,
      },
    ]);

    const preview = await service.previewImport(file, 'skip');
    expect(preview.totalRows).toBe(5);
    expect(preview.validCount).toBe(2);
    expect(preview.skippedCount).toBe(1);
    expect(preview.errorCount).toBe(2);

    expect(preview.rows[0].data.monthlySessionsCount).toBe(8);
    expect(preview.rows[0].data.monthlyPrice).toBe(400);
    expect(preview.rows[0].data.teacherSharePerStudent).toBe(300);
    expect(preview.rows[0].data.centerSharePerStudent).toBe(100);
    expect(preview.rows[0].data.primaryTeacherId).toBe('teacher-1');

    expect(preview.rows[1].data.revenueSplitMethod).toBe(GroupRevenueSplitMethod.CUSTOM_PERCENTAGE);
    expect(preview.rows[1].data.teacherPercentage).toBe(70);
    expect(preview.rows[1].data.fullMonthAbsencePolicy).toBe(
      FullMonthAbsencePolicy.CHARGE_FIXED_RESERVATION_FEE,
    );
    expect(preview.rows[1].data.fullAbsenceFixedFee).toBe(50);
    expect(preview.rows[1].data.chargeExcusedAbsence).toBe(true);
    expect(preview.rows[1].data.isActive).toBe(false);

    expect(preview.rows[2].status).toBe('skip');
    expect(preview.rows[3].errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('معطّل'),
        expect.stringContaining('غير نشط'),
        expect.stringContaining('لا يمكن أن يتجاوز سعر الاشتراك الشهري'),
      ]),
    );
    expect(preview.rows[4].errors[0]).toContain('أكثر من مدرس');
  });

  it('commits valid rows atomically with GRP- codes, unassigned classrooms, audit log, and cache invalidation', async () => {
    const file = await buildXlsxUpload([
      {
        name: 'مجموعة سريعة 1',
        subject: 'الفيزياء',
        gradeLevel: 'الصف الثالث الثانوي',
        primaryTeacher: 'TCH-1001',
        monthlySessionsCount: 8,
        monthlyPrice: 400,
      },
      {
        groupCode: 'GRP-9999',
        name: 'مجموعة متخطاة',
        subject: 'الفيزياء',
        gradeLevel: 'الصف الأول الثانوي',
        primaryTeacher: 'TCH-1001',
        monthlySessionsCount: 8,
        monthlyPrice: 400,
      },
    ]);

    const result = await service.commitImport(
      file,
      { duplicateStrategy: 'skip', skipInvalidRows: false },
      ownerActor,
    );

    expect(result).toEqual({ importedCount: 1, skippedCount: 1, failedCount: 0 });
    expect(mockMutationRepo.createManyWithRelationsTx).toHaveBeenCalledTimes(1);

    const [[committedItem]] = mockMutationRepo.createManyWithRelationsTx.mock.calls[0];
    expect(committedItem.groupData.groupCode).toMatch(/^GRP-\d+$/);
    expect(committedItem.groupData.defaultClassroomId).toBeNull();
    expect(committedItem.groupData.scheduleSlots).toEqual([]);
    expect(committedItem.groupData.calculatedSessionPrice).toBe('50.00');
    expect(committedItem.policy.teacherSharePerStudent).toBe(400);
    expect(committedItem.policy.centerSharePerStudent).toBe(0);

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IMPORT_GROUPS_EXCEL',
        entityType: 'GROUP',
        afterData: expect.objectContaining({ importedCount: 1, skippedCount: 1 }),
      }),
    );
    expect(mockCache.invalidatePrefix).toHaveBeenCalledWith('dashboard:summary:');
    expect(mockCache.invalidatePrefix).toHaveBeenCalledWith('reports:');
  });

  it('blocks commit when errors exist unless skipInvalidRows is enabled', async () => {
    const file = await buildXlsxUpload([
      {
        name: 'مجموعة صالحة',
        subject: 'الفيزياء',
        gradeLevel: 'الصف الثالث الثانوي',
        primaryTeacher: 'TCH-1001',
        monthlySessionsCount: 8,
        monthlyPrice: 400,
      },
      {
        name: 'مجموعة ناقصة',
        subject: 'الفيزياء',
        gradeLevel: 'الصف الثالث الثانوي',
        primaryTeacher: 'UNKNOWN',
        monthlySessionsCount: 0,
        monthlyPrice: -50,
      },
    ]);

    await expect(
      service.commitImport(file, { duplicateStrategy: 'skip', skipInvalidRows: false }, ownerActor),
    ).rejects.toThrow(BadRequestException);

    const skippedCommit = await service.commitImport(
      file,
      { duplicateStrategy: 'skip', skipInvalidRows: true },
      ownerActor,
    );
    expect(skippedCommit).toEqual({ importedCount: 1, skippedCount: 0, failedCount: 1 });
  });

  it('exports filtered groups and hides financial split shares for non-finance viewers', async () => {
    const { buffer, filename } = await service.exportExcel({ search: 'فيزياء' }, ownerActor);
    expect(filename).toMatch(/^groups-\d{4}-\d{2}-\d{2}\.xlsx$/);

    const parsedFull = await excelService.parseUploadedWorkbook({
      fieldname: 'file',
      originalname: filename,
      encoding: '7bit',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: buffer.length,
      buffer,
    });
    expect(parsedFull.rows).toHaveLength(1);
    expect(parsedFull.rows[0].cells['كود المجموعة']).toBe('GRP-1001');
    expect(parsedFull.rows[0].cells['حصة المدرس / طالب']).toBe(300);

    // Re-importing exported file skips duplicate code cleanly
    const roundTrip = await service.previewImport(
      {
        fieldname: 'file',
        originalname: filename,
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: buffer.length,
        buffer,
      },
      'skip',
    );
    expect(roundTrip.totalRows).toBe(1);
    expect(roundTrip.errorCount).toBe(0);

    // Non-finance viewer gets masked financial share values
    const restrictedActor = {
      ...ownerActor,
      roleCode: 'RECEPTION',
      permissions: [PERMISSIONS.GROUPS_VIEW, PERMISSIONS.REPORTS_EXPORT],
    };
    const restrictedExport = await service.exportExcel({}, restrictedActor);
    const parsedRestricted = await excelService.parseUploadedWorkbook({
      fieldname: 'file',
      originalname: restrictedExport.filename,
      encoding: '7bit',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: restrictedExport.buffer.length,
      buffer: restrictedExport.buffer,
    });
    expect(parsedRestricted.rows[0].cells['حصة المدرس / طالب']).toBe('محجوب');
    expect(parsedRestricted.rows[0].cells['حصة السنتر / طالب']).toBe('محجوب');
  });
});

