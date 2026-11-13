import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentStatus } from '@edu-center/shared';
import { ExcelWorkbookService } from '../../common/excel/excel-workbook.service';
import type { UploadedMulterFile } from '../../common/types/multer.types';
import { StudentsExcelService } from './students-excel.service';

describe('StudentsExcelService', () => {
  const excelService = new ExcelWorkbookService();
  let mockRepo: {
    findActiveGradeLevelNames: ReturnType<typeof vi.fn>;
    findExistingCodesAndNamePhones: ReturnType<typeof vi.fn>;
    findAllForExport: ReturnType<typeof vi.fn>;
    createManyTx: ReturnType<typeof vi.fn>;
  };
  let mockAudit: { record: ReturnType<typeof vi.fn> };
  let service: StudentsExcelService;

  const actor = {
    id: 'user-1',
    username: 'admin',
    fullName: 'المدير العام',
    roleId: 'role-1',
    roleCode: 'OWNER',
    permissions: ['STUDENTS_CREATE', 'STUDENTS_VIEW', 'REPORTS_EXPORT'],
  };

  beforeEach(() => {
    mockRepo = {
      findActiveGradeLevelNames: vi
        .fn()
        .mockResolvedValue(['الأول الثانوي', 'الثاني الثانوي']),
      findExistingCodesAndNamePhones: vi.fn().mockResolvedValue({
        existingCodes: new Set(['STU-2026-9999']),
        existingNamePhones: new Set(['عمر خالد|01055555555']),
      }),
      findAllForExport: vi.fn().mockResolvedValue([
        {
          id: 's1',
          studentCode: 'STU-2026-1001',
          fullName: 'سارة أحمد',
          phone: '01012345678',
          guardianPhone: '01198765432',
          gradeLevel: 'الأول الثانوي',
          registrationDate: '2026-09-01',
          status: StudentStatus.ACTIVE,
          notes: 'متفوقة',
          activeGroupsCount: 2,
        },
      ]),
      createManyTx: vi.fn().mockImplementation(async (rows) =>
        rows.map((r: Record<string, unknown>, idx: number) => ({
          id: `created-${idx + 1}`,
          ...r,
        })),
      ),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new StudentsExcelService(
      excelService,
      mockRepo as never,
      mockAudit as never,
    );
  });

  async function buildXlsxUpload(
    rows: Array<Record<string, unknown>>,
    name = 'students.xlsx',
  ): Promise<UploadedMulterFile> {
    const buffer = await excelService.buildWorkbookBuffer({
      sheetName: 'بيانات الطلاب',
      columns: [
        { key: 'studentCode', header: 'كود الطالب (اختياري)', numFmt: '@' },
        { key: 'fullName', header: 'اسم الطالب *' },
        { key: 'phone', header: 'هاتف الطالب *', numFmt: '@' },
        { key: 'guardianPhone', header: 'هاتف ولي الأمر *', numFmt: '@' },
        { key: 'gradeLevel', header: 'الصف الدراسي *' },
        { key: 'registrationDate', header: 'تاريخ التسجيل (YYYY-MM-DD)', numFmt: '@' },
        { key: 'status', header: 'الحالة' },
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

  it('generates a styled template containing active grade levels and empty data rows', async () => {
    const buffer = await service.generateTemplate();
    const parsed = await excelService.parseUploadedWorkbook(
      {
        fieldname: 'file',
        originalname: 'students-import-template.xlsx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: buffer.length,
        buffer,
      },
      { maxRows: 2000 },
    );

    expect(parsed.sheetName).toBe('بيانات الطلاب');
    expect(parsed.headers).toContain('اسم الطالب *');
    expect(parsed.headers).toContain('هاتف الطالب (اختياري)');
    expect(parsed.headers).toContain('الصف الدراسي *');
    expect(parsed.rows).toHaveLength(0);
    expect(mockRepo.findActiveGradeLevelNames).toHaveBeenCalledTimes(1);
  });

  it('allows importing students without a student phone number', async () => {
    const file = await buildXlsxUpload([
      {
        studentCode: '',
        fullName: 'طالب بدون هاتف',
        phone: '',
        guardianPhone: '',
        gradeLevel: 'الأول الثانوي',
      },
    ]);

    const preview = await service.previewImport(file, { duplicateStrategy: 'skip' });
    expect(preview.validCount).toBe(1);
    expect(preview.errorCount).toBe(0);
    expect(preview.rows[0].data.phone).toBeNull();

    const commitRes = await service.commitImport(
      file,
      { duplicateStrategy: 'skip', skipInvalidRows: false },
      actor,
    );
    expect(commitRes.importedCount).toBe(1);
    expect(mockRepo.createManyTx).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          fullName: 'طالب بدون هاتف',
          phone: null,
          guardianPhone: null,
        }),
      ]),
    );
  });

  it('previews rows, normalizes Arabic digits & status, detects errors, duplicates and warnings', async () => {
    const file = await buildXlsxUpload([
      {
        studentCode: '',
        fullName: 'يوسف محمود',
        phone: '٠١٠٢٢٢٢٣٣٣٣',
        guardianPhone: '٠١١٤٤٤٤٥٥٥٥',
        gradeLevel: 'الأول الثانوي',
        registrationDate: '2026-10-01',
        status: 'نشط',
        notes: 'ملاحظة',
      },
      {
        studentCode: 'STU-2026-9999',
        fullName: 'طالب مكرر',
        phone: '01011112222',
        guardianPhone: '01233334444',
        gradeLevel: 'الأول الثانوي',
        status: 'نشط',
      },
      {
        studentCode: '',
        fullName: 'عمر خالد',
        phone: '01055555555',
        guardianPhone: '01066666666',
        gradeLevel: 'الثاني الثانوي',
        status: 'موقوف',
      },
      {
        studentCode: '',
        fullName: 'أ',
        phone: '123',
        guardianPhone: '',
        gradeLevel: 'صف غير موجود',
        registrationDate: 'bad-date',
      },
    ]);

    const preview = await service.previewImport(file, { duplicateStrategy: 'skip' });

    expect(preview.totalRows).toBe(4);
    expect(preview.validCount).toBe(2);
    expect(preview.skippedCount).toBe(1);
    expect(preview.errorCount).toBe(1);
    expect(preview.warningCount).toBe(2);

    expect(preview.rows[0].status).toBe('valid');
    expect(preview.rows[0].data.phone).toBe('01022223333');
    expect(preview.rows[0].data.status).toBe(StudentStatus.ACTIVE);

    expect(preview.rows[1].status).toBe('skip');
    expect(preview.rows[2].status).toBe('valid');
    expect(preview.rows[2].data.status).toBe(StudentStatus.SUSPENDED);
    expect(preview.rows[2].warnings.length).toBeGreaterThan(0);

    expect(preview.rows[3].status).toBe('error');
    expect(preview.rows[3].errors.length).toBeGreaterThanOrEqual(4);
  });

  it('commits valid rows atomically when valid and rejects mixed files unless skipInvalidRows=true', async () => {
    const mixedFile = await buildXlsxUpload([
      {
        fullName: 'طالب صحيح',
        phone: '01012345678',
        guardianPhone: '01112345678',
        gradeLevel: 'الأول الثانوي',
      },
      {
        fullName: '',
        phone: '12',
        guardianPhone: '',
        gradeLevel: 'الأول الثانوي',
      },
    ]);

    await expect(
      service.commitImport(
        mixedFile,
        { duplicateStrategy: 'skip', skipInvalidRows: false },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockRepo.createManyTx).not.toHaveBeenCalled();

    const result = await service.commitImport(
      mixedFile,
      { duplicateStrategy: 'skip', skipInvalidRows: true },
      actor,
    );

    expect(result).toEqual({
      importedCount: 1,
      skippedCount: 0,
      failedCount: 1,
    });
    expect(mockRepo.createManyTx).toHaveBeenCalledTimes(1);
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IMPORT_STUDENTS_EXCEL',
        entityType: 'STUDENT',
      }),
    );
  });

  it('exports filtered students to an xlsx workbook preserving leading-zero phone numbers', async () => {
    const exported = await service.exportExcel({ search: 'سارة', gradeLevel: 'الأول الثانوي' });

    expect(mockRepo.findAllForExport).toHaveBeenCalledWith({
      search: 'سارة',
      gradeLevel: 'الأول الثانوي',
    });
    expect(exported.filename).toMatch(/^students-.*\.xlsx$/);

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
    expect(parsed.rows[0].cells['هاتف الطالب']).toBe('01012345678');
  });
});
