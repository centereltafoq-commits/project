import { apiClient } from '@/lib/api-client';
import { CustomAlarmSoundItem } from './qr-alarm-settings.types';

export const qrAlarmSoundsApi = {
  list: async (): Promise<CustomAlarmSoundItem[]> => {
    const { data } = await apiClient.get<CustomAlarmSoundItem[]>('/attendance/alarm-sounds');
    return Array.isArray(data) ? data : [];
  },

  upload: async (file: File, label?: string): Promise<CustomAlarmSoundItem> => {
    const formData = new FormData();
    formData.append('file', file);
    if (label && label.trim().length > 0) {
      formData.append('label', label.trim());
    }

    const { data } = await apiClient.post<CustomAlarmSoundItem>(
      '/attendance/alarm-sounds',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return data;
  },

  remove: async (id: string): Promise<{ success: boolean; id: string }> => {
    const { data } = await apiClient.delete<{ success: boolean; id: string }>(
      `/attendance/alarm-sounds/${id}`,
    );
    return data;
  },
};
