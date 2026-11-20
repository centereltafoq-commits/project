import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EnrollmentStatus, PERMISSIONS, SystemRole } from '@edu-center/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditRollbackService } from './audit-rollback.service';

describe('AuditRollbackService', () => {
  const ownerActor: any = {
    id: 'usr-owner',
    fullName: 'صاحب السنتر',
    roleCode: SystemRole.OWNER,
    permissions: [],
  };

  let rollbackRepo: Record<string, ReturnType<typeof vi.fn>>;
  let auditLogsService: { record: ReturnType<typeof vi.fn> };
  let settlementService: {
    isMonthClosed: ReturnType<typeof vi.fn>;
    recalculateMonth: ReturnType<typeof vi.fn>;
  };
  let cache: {
    invalidatePrefix: ReturnType<typeof vi.fn>;
    invalidateRosterViews: ReturnType<typeof vi.fn>;
  };
  let service: AuditRollbackService;

  beforeEach(() => {
    rollbackRepo = {
      findAuditLogById: vi.fn(),
      findExistingRollbackForLog: vi.fn().mockResolvedValue(null),
      findLaterEntityLogs: vi.fn().mockResolvedValue([]),
      getPaymentWithDetails: vi.fn(),
      getTeacherPayoutWithDetails: vi.fn(),
      getAssistantPayoutWithDetails: vi.fn(),
      getExpenseById: vi.fn(),
      getEnrollmentWithDetails: vi.fn(),
      countEnrollmentDependencies: vi.fn(),
      hasOtherActiveEnrollment: vi.fn(),
      getStudentById: vi.fn(),
      getSessionById: vi.fn(),
      countSessionAttendanceRows: vi.fn().mockResolvedValue(0),
      rollbackPaymentTx: vi.fn(),
      rollbackTeacherPayoutTx: vi.fn(),
      rollbackAssistantPayoutTx: vi.fn(),
      rollbackExpenseCreateTx: vi.fn(),
      rollbackExpenseUpdateTx: vi.fn(),
      rollbackExpenseDeleteTx: vi.fn(),
      rollbackCreateEnrollmentTx: vi.fn(),
      rollbackUpdateEnrollmentTx: vi.fn(),
      rollbackStudentUpdateTx: vi.fn(),
      rollbackAttendanceOverrideTx: vi.fn(),
      rollbackCompleteGroupSessionTx: vi.fn(),
    };
    auditLogsService = {
      record: vi.fn().mockResolvedValue(undefined),
    };
    settlementService = {
      isMonthClosed: vi.fn().mockResolvedValue(false),
      recalculateMonth: vi.fn().mockResolvedValue(undefined),
    };
    cache = {
      invalidatePrefix: vi.fn().mockResolvedValue(undefined),
      invalidateRosterViews: vi.fn().mockResolvedValue(undefined),
    };

    service = new AuditRollbackService(
      rollbackRepo as any,
      auditLogsService as any,
      settlementService as any,
      cache as any,
    );
  });

  it('previews exact payment impact and executes transactional rollback + recalculation + AUDIT_ROLLBACK entry', async () => {
    const logId = '550e8400-e29b-41d4-a716-446655440001';
    const paymentId = '550e8400-e29b-41d4-a716-446655440100';

    rollbackRepo.findAuditLogById.mockResolvedValue({
      id: logId,
      action: 'FINANCE_COLLECT_PAYMENT',
      entityType: 'payment',
      entityId: paymentId,
      createdAt: new Date('2026-11-15T10:00:00Z'),
    });

    rollbackRepo.getPaymentWithDetails.mockResolvedValue({
      id: paymentId,
      receiptNumber: 'RCP-202611-0001',
      studentId: 'stu-1',
      studentName: 'أحمد علي',
      studentCode: 'STU-1001',
      yearMonth: '2026-11',
      amountNum: 300,
      allocations: [
        { id: 'al-1', groupId: 'grp-1', groupName: 'فيزياء', allocatedNum: 300 },
      ],
      monthlyRows: [
        {
          id: 'smr-1',
          totalDue: '400.00',
          totalPaid: '300.00',
          remainingBalance: '100.00',
          isClosed: false,
        },
      ],
    });

    const preview = await service.previewRollback(logId, ownerActor);
    expect(preview.canRollback).toBe(true);
    expect(preview.affectedMonths).toEqual(['2026-11']);
    expect(preview.affectedChanges.some((c) => c.detail.includes('من 100 ج.م إلى 400 ج.م'))).toBe(
      true,
    );

    rollbackRepo.rollbackPaymentTx.mockResolvedValue({
      beforeData: { id: paymentId, amount: '300.00' },
      afterData: { deletedPaymentId: paymentId },
      affectedMonths: ['2026-11'],
    });

    const res = await service.executeRollback(logId, 'تم التحصيل لطالب بالخطأ', ownerActor);
    expect(res.success).toBe(true);
    expect(rollbackRepo.rollbackPaymentTx).toHaveBeenCalledWith(paymentId, logId);
    expect(settlementService.recalculateMonth).toHaveBeenCalledWith('2026-11');
    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUDIT_ROLLBACK',
        entityId: paymentId,
        metadata: expect.objectContaining({
          revertedAuditLogId: logId,
          revertedAction: 'FINANCE_COLLECT_PAYMENT',
          reason: 'تم التحصيل لطالب بالخطأ',
          affectedMonths: ['2026-11'],
        }),
      }),
    );
  });

  it('prevents double rollback cleanly when audit log is already reverted', async () => {
    const logId = '550e8400-e29b-41d4-a716-446655440002';
    rollbackRepo.findAuditLogById.mockResolvedValue({
      id: logId,
      action: 'FINANCE_COLLECT_PAYMENT',
      entityType: 'payment',
      entityId: 'pay-1',
      createdAt: new Date(),
    });
    rollbackRepo.findExistingRollbackForLog.mockResolvedValue({
      rollbackAuditLogId: 'rb-1',
      revertedAt: new Date(),
      revertedByName: 'المدير',
    });

    const preview = await service.previewRollback(logId, ownerActor);
    expect(preview.canRollback).toBe(false);
    expect(preview.alreadyReverted).toBe(true);

    await expect(service.executeRollback(logId, undefined, ownerActor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('handles teacher and assistant payout rollbacks and blocks when month is closed', async () => {
    const logId = '550e8400-e29b-41d4-a716-446655440003';
    rollbackRepo.findAuditLogById.mockResolvedValue({
      id: logId,
      action: 'FINANCE_TEACHER_PAYOUT',
      entityType: 'teacher_payout',
      entityId: 'tpy-1',
      createdAt: new Date(),
    });
    rollbackRepo.getTeacherPayoutWithDetails.mockResolvedValue({
      id: 'tpy-1',
      referenceNumber: 'TPY-202611-0001',
      teacherId: 'tch-1',
      teacherName: 'أ. محمود',
      teacherCode: 'TCH-1',
      yearMonth: '2026-11',
      amountNum: 1500,
      monthly: {
        totalDues: '2000.00',
        totalPaidOut: '1500.00',
        remainingBalance: '500.00',
        isClosed: true,
      },
    });

    const closedPreview = await service.previewRollback(logId, ownerActor);
    expect(closedPreview.canRollback).toBe(false);
    expect(closedPreview.blockedReason).toContain('مغلق');

    rollbackRepo.getTeacherPayoutWithDetails.mockResolvedValue({
      id: 'tpy-1',
      referenceNumber: 'TPY-202611-0001',
      teacherId: 'tch-1',
      teacherName: 'أ. محمود',
      teacherCode: 'TCH-1',
      yearMonth: '2026-11',
      amountNum: 1500,
      monthly: {
        totalDues: '2000.00',
        totalPaidOut: '1500.00',
        remainingBalance: '500.00',
        isClosed: false,
      },
    });
    rollbackRepo.rollbackTeacherPayoutTx.mockResolvedValue({
      beforeData: { id: 'tpy-1' },
      afterData: { deletedTeacherPayoutId: 'tpy-1' },
      affectedMonths: ['2026-11'],
    });

    const res = await service.executeRollback(logId, 'صرف مكرر', ownerActor);
    expect(res.success).toBe(true);
    expect(rollbackRepo.rollbackTeacherPayoutTx).toHaveBeenCalledWith('tpy-1', logId);
    expect(settlementService.recalculateMonth).toHaveBeenCalledWith('2026-11');
  });

  it('blocks CREATE_ENROLLMENT rollback when linked student payments still exist', async () => {
    const logId = '550e8400-e29b-41d4-a716-446655440004';
    rollbackRepo.findAuditLogById.mockResolvedValue({
      id: logId,
      action: 'CREATE_ENROLLMENT',
      entityType: 'ENROLLMENT',
      entityId: 'enr-1',
      createdAt: new Date(),
    });
    rollbackRepo.getEnrollmentWithDetails.mockResolvedValue({
      id: 'enr-1',
      studentId: 'stu-1',
      studentName: 'سارة',
      groupId: 'grp-1',
      groupName: 'رياضيات',
      startDate: '2026-11-01',
      endDate: null,
      status: EnrollmentStatus.ACTIVE,
    });
    rollbackRepo.countEnrollmentDependencies.mockResolvedValue({
      paymentAllocationsCount: 1,
      paymentAllocatedTotal: 250,
      attendanceCount: 0,
    });

    const preview = await service.previewRollback(logId, ownerActor);
    expect(preview.canRollback).toBe(false);
    expect(preview.blockedReason).toContain('التراجع عن التحصيل أولاً');
  });

  it('enforces domain permission for non-owner users', async () => {
    const logId = '550e8400-e29b-41d4-a716-446655440005';
    rollbackRepo.findAuditLogById.mockResolvedValue({
      id: logId,
      action: 'FINANCE_COLLECT_PAYMENT',
      entityType: 'payment',
      entityId: 'pay-1',
      createdAt: new Date(),
    });

    const viewerActor: any = {
      id: 'usr-viewer',
      fullName: 'مراجع',
      roleCode: SystemRole.ATTENDANCE_EMPLOYEE,
      permissions: [PERMISSIONS.AUDIT_VIEW],
    };

    await expect(service.previewRollback(logId, viewerActor)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('previews and executes rollback of COMPLETE_GROUP_SESSION when session is COMPLETED without individual attendance rows', async () => {
    const logId = '550e8400-e29b-41d4-a716-446655440006';
    rollbackRepo.findAuditLogById.mockResolvedValue({
      id: logId,
      action: 'COMPLETE_GROUP_SESSION',
      entityType: 'SESSION',
      entityId: 'ses-1',
      createdAt: new Date(),
    });
    rollbackRepo.getSessionById.mockResolvedValue({
      id: 'ses-1',
      groupId: 'grp-1',
      groupName: 'فيزياء ثالثة ثانوي',
      sessionDate: '2026-11-12',
      yearMonth: '2026-11',
      status: 'COMPLETED',
    });
    rollbackRepo.countSessionAttendanceRows.mockResolvedValue(0);

    const preview = await service.previewRollback(logId, ownerActor);
    expect(preview.canRollback).toBe(true);
    expect(preview.affectedMonths).toEqual(['2026-11']);
    expect(preview.affectedChanges.some((c) => c.summary.includes('مجدولة'))).toBe(true);

    rollbackRepo.rollbackCompleteGroupSessionTx.mockResolvedValue({
      beforeData: { id: 'ses-1', status: 'COMPLETED' },
      afterData: { id: 'ses-1', status: 'SCHEDULED' },
      affectedMonths: ['2026-11'],
    });

    const res = await service.executeRollback(logId, 'تم تحضير المجموعة بالخطأ', ownerActor);
    expect(res.success).toBe(true);
    expect(rollbackRepo.rollbackCompleteGroupSessionTx).toHaveBeenCalledWith('ses-1', logId);
    expect(settlementService.recalculateMonth).toHaveBeenCalledWith('2026-11');
    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUDIT_ROLLBACK',
        entityId: 'ses-1',
        metadata: expect.objectContaining({
          revertedAuditLogId: logId,
          revertedAction: 'COMPLETE_GROUP_SESSION',
        }),
      }),
    );
  });

  it('blocks rollback of COMPLETE_GROUP_SESSION when individual student attendance rows exist', async () => {
    const logId = '550e8400-e29b-41d4-a716-446655440007';
    rollbackRepo.findAuditLogById.mockResolvedValue({
      id: logId,
      action: 'COMPLETE_GROUP_SESSION',
      entityType: 'SESSION',
      entityId: 'ses-1',
      createdAt: new Date(),
    });
    rollbackRepo.getSessionById.mockResolvedValue({
      id: 'ses-1',
      groupId: 'grp-1',
      groupName: 'فيزياء ثالثة ثانوي',
      sessionDate: '2026-11-12',
      yearMonth: '2026-11',
      status: 'COMPLETED',
    });
    rollbackRepo.countSessionAttendanceRows.mockResolvedValue(3);

    const preview = await service.previewRollback(logId, ownerActor);
    expect(preview.canRollback).toBe(false);
    expect(preview.blockedReason).toContain('سجل حضور فردي');
  });
});
