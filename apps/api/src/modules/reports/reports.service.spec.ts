import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';

describe('ReportsService - Access Control and Permissions Enforcement', () => {
  const mockAcademicRepo = {
    getFilterOptions: vi.fn(),
    getStudentsReport: vi.fn(),
    getAttendanceReport: vi.fn(),
  };
  const mockOperationsRepo = {
    getClassroomsReport: vi.fn(),
  };
  const mockFinanceStatementsRepo = {
    getStudentStatementReport: vi.fn(),
    getGroupsRevenueReport: vi.fn(),
  };
  const mockStaffStatementsRepo = {
    getTeacherStatementReport: vi.fn(),
    getAssistantStatementReport: vi.fn(),
  };
  const mockCashflowRepo = {
    getCollectionsReport: vi.fn(),
    getExpensesReport: vi.fn(),
  };
  const mockFinancialSummaryRepo = {
    getFinancialSummaryReport: vi.fn(),
  };
  const mockCache = {
    get: vi.fn(),
    set: vi.fn(),
  };

  const service = new ReportsService(
    mockAcademicRepo as any,
    mockOperationsRepo as any,
    mockFinanceStatementsRepo as any,
    mockStaffStatementsRepo as any,
    mockCashflowRepo as any,
    mockFinancialSummaryRepo as any,
    mockCache as any,
  );

  it('rejects unknown report types with BadRequestException', async () => {
    const actor: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@test.com',
      fullName: 'User',
      roleCode: SystemRole.MANAGER,
      permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.FINANCE_VIEW],
    };

    await expect(service.generateReport('non-existent-report', {}, actor)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('blocks users lacking FINANCE_VIEW from financial reports', async () => {
    const actorWithoutFinance: AuthenticatedUser = {
      id: 'employee-1',
      email: 'emp@test.com',
      fullName: 'Employee',
      roleCode: SystemRole.ATTENDANCE_EMPLOYEE,
      permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.STUDENTS_VIEW, PERMISSIONS.ATTENDANCE_VIEW],
    };

    // Financial summary
    await expect(
      service.generateReport('financial-summary', {}, actorWithoutFinance),
    ).rejects.toThrow(ForbiddenException);

    // Groups revenue
    await expect(
      service.generateReport('groups-revenue', {}, actorWithoutFinance),
    ).rejects.toThrow(ForbiddenException);

    // Collections
    await expect(
      service.generateReport('collections', {}, actorWithoutFinance),
    ).rejects.toThrow(ForbiddenException);

    // Expenses
    await expect(
      service.generateReport('expenses', {}, actorWithoutFinance),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks users lacking ATTENDANCE_VIEW from attendance report', async () => {
    const actorWithoutAttendance: AuthenticatedUser = {
      id: 'acc-1',
      email: 'acc@test.com',
      fullName: 'Accountant',
      roleCode: SystemRole.ACCOUNTANT,
      permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.FINANCE_VIEW],
    };

    await expect(
      service.generateReport('attendance', {}, actorWithoutAttendance),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks users lacking CLASSROOMS_VIEW from classrooms report', async () => {
    const actorWithoutClassrooms: AuthenticatedUser = {
      id: 'acc-1',
      email: 'acc@test.com',
      fullName: 'Accountant',
      roleCode: SystemRole.ACCOUNTANT,
      permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.FINANCE_VIEW],
    };

    await expect(
      service.generateReport('classrooms', {}, actorWithoutClassrooms),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks exportAll if user lacks REPORTS_EXPORT', async () => {
    const actorWithoutExport: AuthenticatedUser = {
      id: 'sec-1',
      email: 'sec@test.com',
      fullName: 'Secretary',
      roleCode: SystemRole.SECRETARY,
      permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.STUDENTS_VIEW],
    };

    await expect(
      service.generateReport('students', { exportAll: 'true' }, actorWithoutExport),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows OWNER to access any report without explicit permissions', async () => {
    mockFinancialSummaryRepo.getFinancialSummaryReport.mockResolvedValueOnce({
      totalRevenue: 1000,
    });

    const owner: AuthenticatedUser = {
      id: 'owner-1',
      email: 'owner@test.com',
      fullName: 'Owner',
      roleCode: SystemRole.OWNER,
      permissions: [],
    };

    const result = await service.generateReport('financial-summary', {}, owner);
    expect(result.reportType).toBe('financial-summary');
  });

  it('filters getFilterOptions arrays according to actor permissions', async () => {
    mockAcademicRepo.getFilterOptions.mockResolvedValueOnce({
      groups: [{ id: 'g-1', label: 'Group 1' }],
      teachers: [{ id: 't-1', label: 'Teacher 1' }],
      students: [{ id: 's-1', label: 'Student 1' }],
    });

    const restrictedActor: AuthenticatedUser = {
      id: 'emp-1',
      email: 'emp@test.com',
      fullName: 'Employee',
      roleCode: SystemRole.ATTENDANCE_EMPLOYEE,
      permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.STUDENTS_VIEW],
    };

    const filtered = await service.getFilterOptions(restrictedActor);
    expect(filtered.students).toHaveLength(1);
    expect(filtered.groups).toHaveLength(0);
    expect(filtered.teachers).toHaveLength(0);
  });

  it('forwards date filter to financial summary and derives yearMonth when date is provided', async () => {
    mockFinancialSummaryRepo.getFinancialSummaryReport.mockResolvedValueOnce({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 1 },
      summary: [],
    });

    const owner: AuthenticatedUser = {
      id: 'owner-1',
      email: 'owner@test.com',
      fullName: 'Owner',
      roleCode: SystemRole.OWNER,
      permissions: [],
    };

    const result = await service.generateReport(
      'financial-summary',
      { date: '2026-11-14' },
      owner,
    );

    expect(result.yearMonth).toBe('2026-11');
    expect(mockFinancialSummaryRepo.getFinancialSummaryReport).toHaveBeenCalledWith(
      '2026-11',
      '2026-11-14',
    );
  });

  it('blocks profit, teacher, group-revenue, and expense reports for assistant with FINANCE_COLLECT_PAYMENT only', async () => {
    const assistant: AuthenticatedUser = {
      id: 'ast-1',
      email: '01011223344@assistant.local',
      fullName: 'Assistant',
      roleCode: SystemRole.ASSISTANT,
      permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.FINANCE_COLLECT_PAYMENT],
    };

    for (const restrictedReport of [
      'financial-summary',
      'teacher-statement',
      'groups-revenue',
      'assistant-statement',
      'expenses',
    ]) {
      await expect(
        service.generateReport(restrictedReport, { yearMonth: '2026-11' }, assistant),
      ).rejects.toThrow(ForbiddenException);
    }
  });
});
