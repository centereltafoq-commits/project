import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeacherEmploymentStatus } from '@edu-center/shared';
import { ExcelWorkbookService } from '../../common/excel/excel-workbook.service';
import type { UploadedMulterFile } from '../../common/types/multer.types';
import { TeachersExcelService } from './teachers-excel.service';

describe('TeachersExcelService', () => {
  const excelService = new ExcelWorkbookService();
  let mockRepo: {
    findExistingCodesAndNamePhones: ReturnType<typeof vi.fn>;
    findAllForExport: ReturnType<typeof vi.fn>;
    createManyTx: ReturnType<typeof vi.fn>;
  };
  let mockAudit: { record: ReturnType<typeof vi.fn> };
  let service: TeachersExcelService;

  const actor = {
    id: 'user-1',
    username: 'admin',
    fullName: 'المدير العام',
    roleId: 'role-1',
    roleCode: 'OWNER',
    permissions: ['TEACHERS_MANAGE', 'TEACHERS_VIEW', 'REPORTS_EXPORT'],
  };

  beforeEach(() => {
    mockRepo = {
      findExistingCodesAndNamePhones: vi.fn().mockResolvedValue({
        existingCodes: new Set(['TCH-9999']),
        existingNamePhones: new Set(['أحمد علي|01099998888']),
      }),
      findAllForExport: vi.fn().mockResolvedValue([
        {
          id: 't1',
          teacherCode: 'TCH-1001',
          fullName: 'أ. محمود حسن',
          phone: '01033334444',
          specialization: 'الرياضيات',
          contractDate: '2026-09-01',
          employmentStatus: TeacherEmploymentStatus.ACTIVE,
          canApproveBookings: true,
          notes: 'خبرة 10 سنوات',
          assignedGroupsCount: 4,
        },
      ]),
      createManyTx: vi.fn().mockImplementation(async (rows) =>
        rows.map((r: Record<string, unknown>, idx: number) => ({
          id: `teacher-${idx + 1}`,
          ...r,
        })),
      ),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new TeachersExcelService(
      excelService,
      mockRepo as never,
      mockAudit as never,
    );
  });

  async function buildXlsxUpload(
    rows: Array<Record<string, unknown>>,
    name = 'teachers.xlsx',
  ): Promise<UploadedMulterFile> {
    const buffer = await excelService.buildWorkbookBuffer({
      sheetName: 'بيانات المدرسين',
      columns: [
        { key: 'teacherCode', header: 'كود المدرس (اختياري)', numFmt: '@' },
        { key: 'fullName', header: 'اسم المدرس *' },
        { key: 'phone', header: 'رقم الهاتف *', numFmt: '@' },
        { key: 'specialization', header: 'التخصص *' },
        { key: 'contractDate', header: 'تاريخ التعاقد (YYYY-MM-DD)', numFmt: '@' },
        { key: 'employmentStatus', header: 'حالة التعاقد' },
        { key: 'canApproveBookings', header: 'الموافقة على الحجوزات' },
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
        originalname: 'teachers-import-template.xlsx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: buffer.length,
        buffer,
      },
      { maxRows: 2000 },
    );

    expect(parsed.sheetName).toBe('بيانات المدرسين');
    expect(parsed.headers).toContain('اسم المدرس *');
    expect(parsed.headers).toContain('التخصص *');
    expect(parsed.rows).toHaveLength(0);
  });

  it('previews rows, normalizes digits, statuses and booking flag, and detects errors & duplicates', async () => {
    const file = await buildXlsxUpload([
      {
        teacherCode: '',
        fullName: 'د. سليم فاروق',
        phone: '٠١٢١١١١٢٢٢٢',
        specialization: 'الفيزياء',
        contractDate: '2026-10-15',
        employmentStatus: 'نشط',
        canApproveBookings: 'نعم',
      },
      {
        teacherCode: 'TCH-9999',
        fullName: 'مدرس مكرر',
        phone: '01122223333',
        specialization: 'الكيمياء',
      },
      {
        teacherCode: '',
        fullName: 'أحمد علي',
        phone: '01099998888',
        specialization: 'اللغة العربية',
        employmentStatus: 'في إجازة',
        canApproveBookings: 'لا',
      },
      {
        teacherCode: '',
        fullName: 'م',
        phone: '123',
        specialization: '',
        contractDate: 'not-a-date',
        employmentStatus: 'قيمة خطأ',
        canApproveBookings: 'ربما',
      },
    ]);

    const preview = await service.previewImport(file, { duplicateStrategy: 'skip' });

    expect(preview.totalRows).toBe(4);
    expect(preview.validCount).toBe(2);
    expect(preview.skippedCount).toBe(1);
    expect(preview.errorCount).toBe(1);

    expect(preview.rows[0].status).toBe('valid');
    expect(preview.rows[0].data.phone).toBe('01211112222');
    expect(preview.rows[0].data.employmentStatus).toBe(TeacherEmploymentStatus.ACTIVE);
    expect(preview.rows[0].data.canApproveBookings).toBe(true);

    expect(preview.rows[1].status).toBe('skip');

    expect(preview.rows[2].status).toBe('valid');
    expect(preview.rows[2].data.employmentStatus).toBe(TeacherEmploymentStatus.ON_LEAVE);
    expect(preview.rows[2].data.canApproveBookings).toBe(false);
    expect(preview.rows[2].warnings.length).toBeGreaterThan(0);

    expect(preview.rows[3].status).toBe('error');
    expect(preview.rows[3].errors.length).toBeGreaterThanOrEqual(5);
  });

  it('commits valid teacher rows atomically and records audit log', async () => {
    const file = await buildXlsxUpload([
      {
        fullName: 'أ. كريم نبيل',
        phone: '01511112222',
        specialization: 'الأحياء',
      },
    ]);

    const result = await service.commitImport(
      file,
      { duplicateStrategy: 'skip', skipInvalidRows: false },
      actor,
    );

    expect(result).toEqual({
      importedCount: 1,
      skippedCount: 0,
      failedCount: 0,
    });
    expect(mockRepo.createManyTx).toHaveBeenCalledTimes(1);
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IMPORT_TEACHERS_EXCEL',
        entityType: 'TEACHER',
      }),
    );

    const invalidFile = await buildXlsxUpload([
      { fullName: '', phone: '12', specialization: '' },
    ]);
    await expect(
      service.commitImport(
        invalidFile,
        { duplicateStrategy: 'error', skipInvalidRows: false },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('exports filtered teachers preserving phone leading zeros', async () => {
    const exported = await service.exportExcel({
      search: 'محمود',
      employmentStatus: TeacherEmploymentStatus.ACTIVE,
      specialization: 'الرياضيات',
    });

    expect(mockRepo.findAllForExport).toHaveBeenCalledWith({
      search: 'محمود',
      employmentStatus: TeacherEmploymentStatus.ACTIVE,
      specialization: 'الرياضيات',
    });
    expect(exported.filename).toMatch(/^teachers-.*\.xlsx$/);

    const parsed = await excelService.parseUploadedWorkbook(
      {
        fieldname: 'file',
        originalname: exported.filename,
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: exported.buffer.length,
        buffer: exported.buffer,
      },
      { maxRows: 100 },
    );

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].cells['رقم الهاتف']).toBe('01033334444');
    expect(parsed.rows[0].cells['الموافقة على الحجوزات']).toBe('نعم');
  });
});

