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

export interface CloudSyncManifest {
  schemaVersion: 1;
  latest: CloudSyncVersionEntry;
  history: CloudSyncVersionEntry[];
  whatsappTemplates?: unknown[] | null;
  updatedAt: string;
}

export interface CloudSyncLocalConfig {
  enabled: boolean;
  supabaseUrl: string;
  supabaseKey: string;
  bucketName: string;
  deviceId: string;
  deviceName: string;
  lastSyncedVersion: number;
  lastSyncedChecksum: string | null;
  lastSyncedFingerprint: string | null;
  lastSyncedAt: string | null;
  lastPushedAt: string | null;
  lastPulledAt: string | null;
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
