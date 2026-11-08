import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpenseCategory, PaymentMethod, SystemRole } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ExpensesService } from './expenses.service';
import { MonthlySettlementService } from './monthly-settlement.service';
import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';

describe('Finance Closed-Month Lock Enforcement', () => {
  const actor: AuthenticatedUser = {
    id: 'acc-1',
    email: 'accountant@center.com',
    fullName: 'المحاسب',
    roleCode: SystemRole.ACCOUNTANT,
    permissions: [],
  };

  let overviewRepo: any;
  let readRepo: any;
  let studentRecordsRepo: any;
  let staffRecordsRepo: any;
  let writeRepo: any;
  let auditLogsService: any;
  let cache: any;
  let settlementService: MonthlySettlementService;
  let paymentsService: PaymentsService;
  let payoutsService: PayoutsService;
  let expensesService: ExpensesService;
  let paymentsQueryRepo: any;
  let paymentsWriteRepo: any;
  let teacherPayoutRepo: any;
  let assistantPayoutRepo: any;
  let expensesRepo: any;

  beforeEach(() => {
    overviewRepo = {
      fetchMonthExecutiveSummary: vi.fn().mockResolvedValue({
        yearMonth: '2026-10',
        isMonthClosed: true,
        students: { totalDue: 1000, totalPaid: 1000, remainingBalance: 0 },
        teachers: { totalDues: 600, totalPaidOut: 600, remainingBalance: 0 },
        assistants: { totalDues: 100, totalPaidOut: 100, remainingBalance: 0 },
        expenses: { totalAmount: 100 },
        netCenterProfit: 200,
        netCashFlow: 200,
      }),
    };
    readRepo = { fetchMonthSettlementSnapshot: vi.fn() };
    studentRecordsRepo = {};
    staffRecordsRepo = {};
    writeRepo = { persistRecalculationBatch: vi.fn(), lockMonthRecords: vi.fn() };
    auditLogsService = { record: vi.fn().mockResolvedValue(undefined) };
    cache = { invalidatePrefix: vi.fn().mockResolvedValue(undefined) };

    settlementService = new MonthlySettlementService(
      overviewRepo,
      readRepo,
      studentRecordsRepo,
      staffRecordsRepo,
      writeRepo,
      auditLogsService,
      cache,
    );

    paymentsQueryRepo = {};
    paymentsWriteRepo = { createPaymentWithAllocations: vi.fn() };
    paymentsService = new PaymentsService(
      paymentsQueryRepo,
      paymentsWriteRepo,
      settlementService,
      auditLogsService,
      cache,
    );

    teacherPayoutRepo = { createTx: vi.fn() };
    assistantPayoutRepo = { createTx: vi.fn() };
    payoutsService = new PayoutsService(
      teacherPayoutRepo,
      assistantPayoutRepo,
      settlementService,
      auditLogsService,
      cache,
    );

    expensesRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'exp-1',
        yearMonth: '2026-10',
        amount: '150.00',
      }),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    expensesService = new ExpensesService(
      expensesRepo,
      settlementService,
      auditLogsService,
      cache,
    );
  });

  it('rejects recalculation and closing an already closed month', async () => {
    await expect(settlementService.recalculateMonth('2026-10', actor)).rejects.toThrow(
      ConflictException,
    );
    await expect(settlementService.closeMonth('2026-10', actor)).rejects.toThrow(
      ConflictException,
    );
    expect(readRepo.fetchMonthSettlementSnapshot).not.toHaveBeenCalled();
    expect(writeRepo.lockMonthRecords).not.toHaveBeenCalled();
  });

  it('skips silent background recalculation when month is already closed', async () => {
    const res = await settlementService.recalculateMonth('2026-10');
    expect(res).toEqual({
      yearMonth: '2026-10',
      updatedStudentRecords: 0,
      updatedTeacherRecords: 0,
      updatedAssistantRecords: 0,
    });
    expect(readRepo.fetchMonthSettlementSnapshot).not.toHaveBeenCalled();
  });

  it('rejects student payment collection on a closed month', async () => {
    await expect(
      paymentsService.collectPayment(
        {
          studentId: 'std-1',
          yearMonth: '2026-10',
          amount: 100,
          paymentMethod: PaymentMethod.CASH,
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
    expect(paymentsWriteRepo.createPaymentWithAllocations).not.toHaveBeenCalled();
  });

  it('rejects teacher and assistant payouts on a closed month', async () => {
    await expect(
      payoutsService.recordTeacherPayout(
        {
          teacherId: 'tch-1',
          yearMonth: '2026-10',
          amount: 100,
          paymentMethod: PaymentMethod.CASH,
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    await expect(
      payoutsService.recordAssistantPayout(
        {
          assistantId: 'ast-1',
          yearMonth: '2026-10',
          amount: 50,
          paymentMethod: PaymentMethod.CASH,
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    expect(teacherPayoutRepo.createTx).not.toHaveBeenCalled();
    expect(assistantPayoutRepo.createTx).not.toHaveBeenCalled();
  });

  it('rejects expense create, update, and delete on a closed month', async () => {
    await expect(
      expensesService.create(
        {
          category: ExpenseCategory.RENT,
          title: 'إيجار',
          amount: 100,
          expenseDate: '2026-10-15',
          yearMonth: '2026-10',
          paymentMethod: PaymentMethod.CASH,
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    await expect(
      expensesService.update('exp-1', { title: 'تعديل' }, actor),
    ).rejects.toThrow(ConflictException);

    await expect(expensesService.remove('exp-1', actor)).rejects.toThrow(ConflictException);

    expect(expensesRepo.create).not.toHaveBeenCalled();
    expect(expensesRepo.update).not.toHaveBeenCalled();
    expect(expensesRepo.delete).not.toHaveBeenCalled();
  });
});
