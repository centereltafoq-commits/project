import { apiClient } from '@/lib/api-client';

export interface CloudSyncDatabaseStats {
  studentsCount: number;
  teachersCount: number;
  groupsCount: number;
  sessionsCount: number;
  attendanceCount: number;
  paymentsCount: number;
  expensesCount: number;
  auditCount: number;
  lastMutationAt: string | null;
  fingerprint: string;
}

export interface CloudSyncVersionEntry {
  version: number;
  snapshotPath: string;
  fileName: string;
  checksum: string;
  fileSizeBytes: number;
  pushedAt: string;
  pushedByName: string;
  pushedByRole: string;
  deviceName: string;
  deviceId: string;
  centerName: string;
  note?: string | null;
  stats: CloudSyncDatabaseStats;
}

export type CloudSyncStateCode =
  | 'NOT_CONFIGURED'
  | 'IN_SYNC'
  | 'REMOTE_NEWER'
  | 'LOCAL_AHEAD'
  | 'CONFLICT'
  | 'REMOTE_EMPTY'
  | 'CONNECTION_ERROR';

export interface CloudSyncStatusResponse {
  configured: boolean;
  enabled: boolean;
  state: CloudSyncStateCode;
  stateMessageAr: string;
  deviceId: string;
  deviceName: string;
  supabaseUrl: string;
  supabaseKeyMasked: string | null;
  hasSupabaseKey: boolean;
  bucketName: string;
  lastSyncedVersion: number;
  lastSyncedAt: string | null;
  lastPushedAt: string | null;
  lastPulledAt: string | null;
  hasLocalUnsyncedChanges: boolean;
  localStats: CloudSyncDatabaseStats;
  remoteLatest: CloudSyncVersionEntry | null;
  remoteHistory: CloudSyncVersionEntry[];
  connectionError?: string | null;
  checkedAt: string;
}

export interface UpdateCloudSyncConfigPayload {
  supabaseUrl: string;
  supabaseKey?: string;
  bucketName?: string;
  deviceName: string;
  enabled?: boolean;
}

export interface TestCloudSyncPayload {
  supabaseUrl: string;
  supabaseKey?: string;
  bucketName?: string;
}

export interface CloudSyncPushResult {
  success: boolean;
  message: string;
  pushedVersion: CloudSyncVersionEntry;
  status: CloudSyncStatusResponse;
}

export interface CloudSyncPullResult {
  success: boolean;
  message: string;
  pulledVersion: CloudSyncVersionEntry;
  safetyBackupFileName: string;
  status: CloudSyncStatusResponse;
}

export const cloudSyncApi = {
  getStatus: async (): Promise<CloudSyncStatusResponse> => {
    const { data } = await apiClient.get<CloudSyncStatusResponse>('/backups/cloud-sync/status');
    return data;
  },

  testConnection: async (
    payload: TestCloudSyncPayload,
  ): Promise<{ ok: boolean; bucketCreated: boolean; message: string }> => {
    const { data } = await apiClient.post<{
      ok: boolean;
      bucketCreated: boolean;
      message: string;
    }>('/backups/cloud-sync/test', payload);
    return data;
  },

  saveConfig: async (
    payload: UpdateCloudSyncConfigPayload,
  ): Promise<{
    success: boolean;
    bucketCreated: boolean;
    message: string;
    status: CloudSyncStatusResponse;
  }> => {
    const { data } = await apiClient.patch<{
      success: boolean;
      bucketCreated: boolean;
      message: string;
      status: CloudSyncStatusResponse;
    }>('/backups/cloud-sync/config', payload);
    return data;
  },

  push: async (payload: { note?: string; force?: boolean }): Promise<CloudSyncPushResult> => {
    const { data } = await apiClient.post<CloudSyncPushResult>(
      '/backups/cloud-sync/push',
      payload,
      { timeout: 120000 },
    );
    return data;
  },

  pull: async (payload: {
    targetVersion?: number;
    confirmOverwriteLocalChanges?: boolean;
  }): Promise<CloudSyncPullResult> => {
    const { data } = await apiClient.post<CloudSyncPullResult>(
      '/backups/cloud-sync/pull',
      payload,
      { timeout: 120000 },
    );
    return data;
  },
};
