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

  restore: async (id: string, password: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post<{ success: boolean; message: string }>(`/backups/${id}/restore`, { password });
    return data;
  },

  disconnectGoogle: async (): Promise<BackupSettings> => {
    const { data } = await apiClient.delete<BackupSettings>('/backups/google/disconnect');
    return data;
  },

  downloadUrl: (id: string) => `/api/backups/${id}/download`,
};
