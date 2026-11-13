import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsRepository } from './settings.repository';
import {
  systemSettings,
  attendance,
  paymentAllocations,
  payments,
  studentMonthlyRecords,
  teacherDues,
  assistantDues,
  teacherPayouts,
  assistantPayouts,
  teacherMonthlyRecords,
  assistantMonthlyRecords,
  expenses,
  enrollments,
  sessions,
  groupTeachers,
  groupAssistants,
  financialPolicies,
  groups,
  students,
} from '../../database/schemas';

describe('SettingsRepository', () => {
  let repository: SettingsRepository;
  let mockDb: any;
  let mockTx: any;

  beforeEach(() => {
    mockTx = {
      delete: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      transaction: vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockTx);
      }),
    };

    repository = new SettingsRepository(mockDb);
  });

  describe('getSettings', () => {
    it('returns existing singleton row when found', async () => {
      const mockRow = {
        id: 'default',
        centerName: 'سنتر النخبة التعليمي',
        academicYear: '2026 / 2027',
      };

      const mockLimit = vi.fn().mockResolvedValue([mockRow]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await repository.getSettings();

      expect(result).toEqual(mockRow);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('inserts default singleton row when no record exists', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const createdRow = {
        id: 'default',
        centerName: 'سنتر النخبة التعليمي',
      };
      const mockReturning = vi.fn().mockResolvedValue([createdRow]);
      const mockOnConflict = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const result = await repository.getSettings();

      expect(result).toEqual(createdRow);
      expect(mockDb.insert).toHaveBeenCalledWith(systemSettings);
    });
  });

  describe('upsertSettings', () => {
    it('upserts branding fields and trims nullable strings to null when cleared', async () => {
      const updatedRow = {
        id: 'default',
        centerName: 'أكاديمية المستقبل',
        phone: null,
        logoUrl: null,
      };
      const mockReturning = vi.fn().mockResolvedValue([updatedRow]);
      const mockOnConflict = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const result = await repository.upsertSettings(
        {
          centerName: 'أكاديمية المستقبل',
          phone: '',
          logoUrl: null,
        },
        'user-123',
      );

      expect(result).toEqual(updatedRow);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'default',
          centerName: 'أكاديمية المستقبل',
          phone: null,
          logoUrl: null,
          updatedBy: 'user-123',
        }),
      );
    });
  });

  describe('clearOperationalData', () => {
    it('executes atomic transaction purging all operational tables in safe dependency order without purging students master', async () => {
      const result = await repository.clearOperationalData(false);

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(result).toEqual({ success: true, purgedStudents: false });

      // Verify attendance is purged
      expect(mockTx.delete).toHaveBeenCalledWith(attendance);

      // Verify financial transactions are purged
      expect(mockTx.delete).toHaveBeenCalledWith(paymentAllocations);
      expect(mockTx.delete).toHaveBeenCalledWith(payments);
      expect(mockTx.delete).toHaveBeenCalledWith(studentMonthlyRecords);
      expect(mockTx.delete).toHaveBeenCalledWith(teacherDues);
      expect(mockTx.delete).toHaveBeenCalledWith(assistantDues);
      expect(mockTx.delete).toHaveBeenCalledWith(teacherPayouts);
      expect(mockTx.delete).toHaveBeenCalledWith(assistantPayouts);
      expect(mockTx.delete).toHaveBeenCalledWith(teacherMonthlyRecords);
      expect(mockTx.delete).toHaveBeenCalledWith(assistantMonthlyRecords);
      expect(mockTx.delete).toHaveBeenCalledWith(expenses);

      // Verify enrollments and sessions are purged
      expect(mockTx.delete).toHaveBeenCalledWith(enrollments);
      expect(mockTx.delete).toHaveBeenCalledWith(sessions);

      // When purgeStudents is false, student profiles and groups MUST NOT be deleted
      expect(mockTx.delete).not.toHaveBeenCalledWith(students);
      expect(mockTx.delete).not.toHaveBeenCalledWith(groups);
      expect(mockTx.delete).not.toHaveBeenCalledWith(financialPolicies);
      expect(mockTx.delete).not.toHaveBeenCalledWith(groupTeachers);
      expect(mockTx.delete).not.toHaveBeenCalledWith(groupAssistants);
    });

    it('purges student profiles and group definitions when purgeStudents is true', async () => {
      const result = await repository.clearOperationalData(true);

      expect(result).toEqual({ success: true, purgedStudents: true });

      // Student profiles and groups MUST be deleted
      expect(mockTx.delete).toHaveBeenCalledWith(groupTeachers);
      expect(mockTx.delete).toHaveBeenCalledWith(groupAssistants);
      expect(mockTx.delete).toHaveBeenCalledWith(financialPolicies);
      expect(mockTx.delete).toHaveBeenCalledWith(groups);
      expect(mockTx.delete).toHaveBeenCalledWith(students);
    });
  });
});
