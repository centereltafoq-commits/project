import * as fs from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import { IBackupStorageDriver, StorageUploadResult } from './storage-driver.interface';

interface GoogleDriveTokens {
  accessToken?: string;
  refreshToken?: string;
  folderId?: string;
}

@Injectable()
export class GoogleDriveDriver implements IBackupStorageDriver {
  readonly name = 'GOOGLE_DRIVE';
  private readonly logger = new Logger(GoogleDriveDriver.name);

  async upload(
    filePath: string,
    fileName: string,
    tokens?: GoogleDriveTokens | null,
  ): Promise<StorageUploadResult> {
    if (!tokens || !tokens.accessToken) {
      return {
        destination: this.name,
        success: false,
        error: 'حساب Google Drive غير متصل أو لم يتم العثور على رمز الوصول',
      };
    }

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const metadata = {
        name: fileName,
        mimeType: 'application/gzip',
        parents: tokens.folderId ? [tokens.folderId] : undefined,
      };

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartRequestBody = Buffer.concat([
        Buffer.from(
          delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/gzip\r\n' +
            'Content-Transfer-Encoding: base64\r\n\r\n',
        ),
        Buffer.from(fileBuffer.toString('base64')),
        Buffer.from(closeDelimiter),
      ]);

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
            'Content-Length': String(multipartRequestBody.length),
          },
          body: multipartRequestBody,
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google API error (${response.status}): ${errText}`);
      }

      const data = (await response.json()) as { id: string };
      this.logger.log(`Backup successfully uploaded to Google Drive. Remote File ID: ${data.id}`);

      return {
        destination: this.name,
        success: true,
        remoteId: data.id,
      };
    } catch (err: any) {
      this.logger.error(`Google Drive upload failed: ${err.message}`);
      return {
        destination: this.name,
        success: false,
        error: err.message || 'فشل رفع النسخة إلى Google Drive',
      };
    }
  }
}

