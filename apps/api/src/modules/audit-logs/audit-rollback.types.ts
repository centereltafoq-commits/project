import { PERMISSIONS } from '@edu-center/shared';

export const REVERSIBLE_AUDIT_ACTIONS = [
  'FINANCE_COLLECT_PAYMENT',
  'FINANCE_TEACHER_PAYOUT',
  'FINANCE_ASSISTANT_PAYOUT',
  'FINANCE_EXPENSE_CREATE',
  'FINANCE_EXPENSE_UPDATE',
  'FINANCE_EXPENSE_DELETE',
  'CREATE_ENROLLMENT',
  'UPDATE_ENROLLMENT',
  'UPDATE_STUDENT',
  'ARCHIVE_STUDENT',
  'OVERRIDE_ATTENDANCE',
  'COMPLETE_GROUP_SESSION',
] as const;

export type ReversibleAuditAction = (typeof REVERSIBLE_AUDIT_ACTIONS)[number];

const REVERSIBLE_ACTION_SET = new Set<string>(REVERSIBLE_AUDIT_ACTIONS);

export function isReversibleAuditAction(action: string): boolean {
  return REVERSIBLE_ACTION_SET.has(action);
}

export const ACTION_REQUIRED_PERMISSIONS: Record<ReversibleAuditAction, string> = {
  FINANCE_COLLECT_PAYMENT: PERMISSIONS.FINANCE_COLLECT_PAYMENT,
  FINANCE_TEACHER_PAYOUT: PERMISSIONS.FINANCE_PAYOUTS,
  FINANCE_ASSISTANT_PAYOUT: PERMISSIONS.FINANCE_PAYOUTS,
  FINANCE_EXPENSE_CREATE: PERMISSIONS.FINANCE_EXPENSES,
  FINANCE_EXPENSE_UPDATE: PERMISSIONS.FINANCE_EXPENSES,
  FINANCE_EXPENSE_DELETE: PERMISSIONS.FINANCE_EXPENSES,
  CREATE_ENROLLMENT: PERMISSIONS.ENROLLMENTS_MANAGE,
  UPDATE_ENROLLMENT: PERMISSIONS.ENROLLMENTS_MANAGE,
  UPDATE_STUDENT: PERMISSIONS.STUDENTS_UPDATE,
  ARCHIVE_STUDENT: PERMISSIONS.STUDENTS_UPDATE,
  OVERRIDE_ATTENDANCE: PERMISSIONS.ATTENDANCE_OVERRIDE,
  COMPLETE_GROUP_SESSION: PERMISSIONS.ATTENDANCE_OVERRIDE,
};

export interface RollbackImpactItem {
  area: string;
  summary: string;
  detail: string;
  severity: 'info' | 'warning';
}

export interface AuditRollbackPreviewResult {
  auditLogId: string;
  action: string;
  actionAr: string;
  entityType: string;
  entityTypeAr: string;
  entityId: string | null;
  isReversible: boolean;
  canRollback: boolean;
  alreadyReverted: boolean;
  blockedReason: string | null;
  affectedMonths: string[];
  affectedChanges: RollbackImpactItem[];
  warnings: string[];
}

export interface AuditRollbackExecuteResult {
  success: true;
  revertedAuditLogId: string;
  affectedMonths: string[];
  affectedChanges: RollbackImpactItem[];
  message: string;
}
