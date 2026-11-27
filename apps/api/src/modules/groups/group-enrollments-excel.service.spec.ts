import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import { ExcelWorkbookService } from '../../common/excel/excel-workbook.service';
import type { UploadedMulterFile } from '../../common/types/multer.types';
import { GroupEnrollmentsExcelService } from './group-enrollments-excel.service';

async function buildXlsxUpload(
  headers: string[],
  rows: Array<Array<string | number>>,
): Promise<UploadedMulterFile> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(headers);
  for (const r of rows) {
    ws.addRow(r);
  }
  const out = await wb.xlsx.writeBuffer();
  const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);
  return {
    fieldname: 'file',
    originalname: 'enrollments.xlsx',
    encoding: '7bit',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: buffer.length,
    buffer,
  };
}

describe('GroupEnrollmentsExcelService', () => {
  let service: GroupEnrollmentsExcelService;
  let excelService: ExcelWorkbookService;
  let mockGroupsRepo: any;
  let mockEnrollmentsRepo: any;
  let mockAudit: any;
  let mockSettlement: any;
  let mockCache: any;

  const ownerActor: any = {
    id: 'owner-1',
    fullName: 'المالك',
    roleCode: SystemRole.OWNER,
    permissions: [],
  };

  beforeEach(() => {
    excelService = new ExcelWorkbookService();
    mockGroupsRepo = {
      findDetailById: vi.fn().mockImplementation(async (id: string) => {
        if (id === 'grp-target') {
          return {
            id: 'grp-target',
            groupCode: 'GRP-202',
            name: 'فيزياء متقدمة',
            isActive: true,
            monthlyPrice: '500.00',
            monthlySessionsCount: 4,
            maxStudents: 5,
          };
        }
        if (id === 'grp-source') {
          return {
            id: 'grp-source',
            groupCode: 'GRP-101',
            name: 'فيزياء تمهيدية',
            isActive: true,
            monthlyPrice: '400.00',
            monthlySessionsCount: 4,
            maxStudents: 20,
          };
        }
        return null;
      }),
    };

    mockEnrollmentsRepo = {
      findAllStudentsForEnrollmentExcel: vi.fn().mockResolvedValue([
        {
          id: 'stu-1',
          studentCode: 'STU-101',
          fullName: 'أحمد سامي',
          phone: '01011112222',
          guardianPhone: '01099998888',
          gradeLevel: 'الثالث الثانوي',
          status: 'ACTIVE',
        },
        {
          id: 'stu-2',
          studentCode: 'STU-102',
          fullName: 'سارة علي',
          phone: '01033334444',
          guardianPhone: '01077776666',
          gradeLevel: 'الثالث الثانوي',
          status: 'ACTIVE',
        },
        {
          id: 'stu-3',
          studentCode: 'STU-103',
          fullName: 'سارة علي',
          phone: '01055556666',
          guardianPhone: '01066667777',
          gradeLevel: 'الثالث الثانوي',
          status: 'ACTIVE',
        },
      ]),
      findActiveStudentIdsByGroup: vi.fn().mockImplementation(async (gid: string) => {
        if (gid === 'grp-target') return [];
        if (gid === 'grp-source') return ['stu-1'];
        return [];
      }),
      findAllByGroupForExport: vi.fn().mockResolvedValue([
        {
          id: 'enr-1',
          studentId: 'stu-1',
          studentCode: 'STU-101',
          studentName: 'أحمد سامي',
          studentPhone: '01011112222',
          guardianPhone: '01099998888',
          gradeLevel: 'الثالث الثانوي',
          startDate: '2026-11-01',
          endDate: null,
          agreedMonthlyPrice: '500.00',
          agreedSessionsCount: 4,
          agreedSessionPrice: '125.00',
          status: 'ACTIVE',
          notes: null,
        },
      ]),
      createBulkWithOptionalTransfer: vi.fn().mockResolvedValue({
        created: [{ id: 'enr-new-1', studentId: 'stu-1' }],
        skippedAlreadyEnrolledCount: 0,
        transferredCount: 1,
      }),
    };

    mockAudit = { record: vi.fn().mockResolvedValue(undefined) };
    mockSettlement = { recalculateMonth: vi.fn().mockResolvedValue(undefined) };
    mockCache = { invalidatePrefix: vi.fn().mockResolvedValue(undefined) };

    service = new GroupEnrollmentsExcelService(
      excelService,
      mockGroupsRepo,
      mockEnrollmentsRepo,
      mockAudit,
      mockSettlement,
      mockCache,
    );
  });

  it('masks financial prices on export when actor lacks FINANCE_VIEW', async () => {
    const restrictedActor: any = {
      id: 'sec-1',
      fullName: 'سكرتير',
      roleCode: SystemRole.SECRETARY,
      permissions: [PERMISSIONS.ENROLLMENTS_VIEW, PERMISSIONS.REPORTS_EXPORT],
    };

    const { buffer, filename } = await service.exportExcel('grp-target', {}, restrictedActor);
    expect(filename).toContain('group-GRP-202-');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const row2 = ws.getRow(2);
    expect(row2.getCell(1).value).toBe('STU-101');
    expect(row2.getCell(7).value).toBe('محجوب');
    expect(row2.getCell(9).value).toBe('محجوب');
  });

  it('matches students by code and phone, rejects ambiguous names, and enforces capacity in preview', async () => {
    const file = await buildXlsxUpload(
      ['كود الطالب', 'اسم الطالب', 'هاتف الطالب', 'تاريخ البدء (YYYY-MM-DD)'],
      [
        ['STU-101', 'أحمد سامي', '', '2026-11-05'],
        ['', '', '٠١٠٣٣٣٣٤٤٤٤', '2026-11-05'], // Arabic digits phone match -> stu-2
        ['', 'سارة علي', '', '2026-11-05'], // Ambiguous name without code/phone -> error
        ['STU-999', 'غير موجود', '', '2026-11-05'], // Unknown student -> error
      ],
    );

    const preview = await service.previewImport('grp-target', file, {
      duplicateStrategy: 'skip',
      sourceGroupId: 'grp-source',
    });

    expect(preview.totalRows).toBe(4);
    expect(preview.validCount).toBe(2);
    expect(preview.errorCount).toBe(2);
    expect(preview.rows[1].data.studentCode).toBe('STU-102');
    expect(preview.rows[1].warnings.some((w) => w.includes('غير مشترك حالياً'))).toBe(true);
    expect(preview.rows[2].errors[0]).toContain('أكثر من طالب بنفس الاسم');
    expect(preview.rows[3].errors[0]).toContain('STU-999');
  });

  it('commits valid rows in transfer mode atomically and triggers settlement recalculation', async () => {
    const file = await buildXlsxUpload(
      ['كود الطالب', 'تاريخ البدء (YYYY-MM-DD)', 'الاشتراك الشهري'],
      [['STU-101', '2026-11-10', 450]],
    );

    const result = await service.commitImport(
      'grp-target',
      file,
      { duplicateStrategy: 'skip', sourceGroupId: 'grp-source' },
      ownerActor,
    );

    expect(mockEnrollmentsRepo.createBulkWithOptionalTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'grp-target',
        sourceGroupId: 'grp-source',
        rows: [
          expect.objectContaining({
            studentId: 'stu-1',
            startDate: '2026-11-10',
            agreedMonthlyPrice: '450.00',
          }),
        ],
      }),
    );
    expect(result).toEqual({
      importedCount: 1,
      skippedCount: 0,
      failedCount: 0,
      transferredCount: 1,
    });
    expect(mockSettlement.recalculateMonth).toHaveBeenCalledWith('2026-11');
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TRANSFER_GROUP_ENROLLMENTS' }),
    );
  });

  it('rejects self-transfer where sourceGroupId equals target groupId', async () => {
    const file = await buildXlsxUpload(['كود الطالب'], [['STU-101']]);
    await expect(
      service.previewImport('grp-target', file, { sourceGroupId: 'grp-target' }),
    ).rejects.toThrow(BadRequestException);
  });
});
