export interface StorageUploadResult {
  destination: string;
  success: boolean;
  error?: string;
  remoteId?: string;
}

export interface IBackupStorageDriver {
  readonly name: string;
  upload(filePath: string, fileName: string): Promise<StorageUploadResult>;
}

