import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { IBackupStorageDriver, StorageUploadResult } from './storage-driver.interface';

@Injectable()
export class LocalStorageDriver implements IBackupStorageDriver {
  readonly name = 'LOCAL';
  private readonly logger = new Logger(LocalStorageDriver.name);

  async upload(
    filePath: string,
    fileName: string,
    targetDirectory?: string,
  ): Promise<StorageUploadResult> {
    if (!targetDirectory || targetDirectory.trim() === '') {
      return {
        destination: this.name,
        success: false,
        error: 'لم يتم تحديد مسار المجلد المحلي',
      };
    }

    try {
      const cleanPath = path.resolve(targetDirectory.trim());
      if (!fs.existsSync(cleanPath)) {
        fs.mkdirSync(cleanPath, { recursive: true });
      }

      const destinationFile = path.join(cleanPath, fileName);
      fs.copyFileSync(filePath, destinationFile);

      this.logger.log(`Backup successfully copied to local path: ${destinationFile}`);
      return {
        destination: this.name,
        success: true,
      };
    } catch (err: any) {
      this.logger.error(`Failed to copy backup to local path ${targetDirectory}: ${err.message}`);
      return {
        destination: this.name,
        success: false,
        error: err.message || 'فشل نسخ الملف إلى المسار المحلي',
      };
    }
  }
}

