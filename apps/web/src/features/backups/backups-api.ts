import { PaginatedResult } from '@edu-center/shared';
import { apiClient } from '../../lib/api-client';
import {
  BackupRecord,
  BackupSettings,
  UpdateBackupSettingsPayload,
} from './backups.types';

export const backupsApi = {
  list: async (params?: { page?: number; limit?: number; status?: string }): Promise<PaginatedResult<BackupRecord>> => {
    const { data } = await apiClient.get<PaginatedResult<BackupRecord>>('/backups', { params });
    return data;
  },

  getSettings: async (): Promise<BackupSettings> => {
    const { data } = await apiClient.get<BackupSettings>('/backups/settings');
    return data;
  },

  updateSettings: async (payload: UpdateBackupSettingsPayload): Promise<BackupSettings> => {
    const { data } = await apiClient.patch<BackupSettings>('/backups/settings', payload);
    return data;
  },

  triggerManual: async (): Promise<BackupRecord> => {
    const { data } = await apiClient.post<BackupRecord>('/backups/trigger');
    return data;
  },

  upload: async (file: File): Promise<BackupRecord> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post<BackupRecord>('/backups/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  restore: async (id: string, password: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post<{ success: boolean; message: string }>(`/backups/${id}/restore`, { password });
    return data;
  },

  disconnectGoogle: async (): Promise<BackupSettings> => {
    const { data } = await apiClient.delete<BackupSettings>('/backups/google/disconnect');
    return data;
  },

  downloadUrl: (id: string) => `/api/backups/${id}/download`,

  download: async (id: string, fileName: string): Promise<void> => {
    try {
      const res = await apiClient.get<Blob>(`/backups/${id}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/gzip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed.message) {
            err.message = parsed.message;
            if (!err.response.data.message) {
              err.response.data = parsed;
            }
          }
        } catch {}
      }
      throw err;
    }
  },
};

