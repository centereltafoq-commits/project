import { apiClient } from '@/lib/api-client';

export interface SystemSettings {
  id: string;
  centerName: string;
  centerSubtitle?: string | null;
  logoUrl?: string | null;
  phone?: string | null;
  address?: string | null;
  academicYear?: string | null;
  currencySymbol?: string | null;
  updatedAt: string;
  updatedBy?: string | null;
}

export interface UpdateSettingsPayload {
  centerName?: string;
  centerSubtitle?: string;
  logoUrl?: string;
  phone?: string;
  address?: string;
  academicYear?: string;
  currencySymbol?: string;
}

export interface ResetAcademicYearPayload {
  pin: string;
  purgeStudents?: boolean;
  newAcademicYear?: string;
  notes?: string;
}

export interface ResetAcademicYearResult {
  success: boolean;
  backupId: string;
  purgeStudents: boolean;
  message: string;
}

export const settingsApi = {
  getSettings: async (): Promise<SystemSettings> => {
    const { data } = await apiClient.get<SystemSettings>('/settings');
    return data;
  },

  updateSettings: async (payload: UpdateSettingsPayload): Promise<SystemSettings> => {
    const { data } = await apiClient.put<SystemSettings>('/settings', payload);
    return data;
  },

  resetAcademicYear: async (payload: ResetAcademicYearPayload): Promise<ResetAcademicYearResult> => {
    const { data } = await apiClient.post<ResetAcademicYearResult>(
      '/settings/reset-academic-year',
      payload,
    );
    return data;
  },
};
