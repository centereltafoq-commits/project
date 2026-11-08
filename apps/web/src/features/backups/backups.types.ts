export interface BackupRecord {
  id: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  triggerType: 'MANUAL' | 'SCHEDULED' | 'UPLOADED';
  destinations: string[];
  checksum: string | null;
  status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';
  errorMessage: string | null;
  createdAt: string;
}

export interface BackupSettings {
  id: string;
  autoBackupEnabled: boolean;
  scheduleTime: string;
  retentionCount: number;
  localPath: string | null;
  googleDriveEnabled: boolean;
  googleDriveTokens: {
    userEmail?: string;
    connectedAt?: string;
    folderId?: string;
  } | null;
  dropboxEnabled: boolean;
  dropboxTokens: {
    userEmail?: string;
    connectedAt?: string;
  } | null;
  updatedAt: string;
}

export interface UpdateBackupSettingsPayload {
  autoBackupEnabled?: boolean;
  scheduleTime?: string;
  retentionCount?: number;
  localPath?: string;
  googleDriveEnabled?: boolean;
}

export interface RestoreBackupPayload {
  password: string;
}

