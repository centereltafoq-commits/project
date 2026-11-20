import { apiClient } from '@/lib/api-client';

export interface RollbackImpactItem {
  area: string;
  summary: string;
  detail: string;
  severity: 'info' | 'warning';
}

export interface AuditRollbackPreview {
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

export const auditLogsApi = {
  getRollbackPreview: async (id: string): Promise<AuditRollbackPreview> => {
    const { data } = await apiClient.get<AuditRollbackPreview>(
      `/audit-logs/${id}/rollback-preview`,
    );
    return data;
  },

  executeRollback: async (
    id: string,
    reason?: string,
  ): Promise<AuditRollbackExecuteResult> => {
    const { data } = await apiClient.post<AuditRollbackExecuteResult>(
      `/audit-logs/${id}/rollback`,
      reason && reason.trim() ? { reason: reason.trim() } : {},
    );
    return data;
  },
};
