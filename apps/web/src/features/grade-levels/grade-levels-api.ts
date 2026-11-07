import { apiClient } from '../../lib/api-client';
import {
  CreateGradeLevelPayload,
  GradeLevel,
  UpdateGradeLevelPayload,
} from './grade-levels.types';

export const gradeLevelsApi = {
  list: async (activeOnly?: boolean): Promise<GradeLevel[]> => {
    const { data } = await apiClient.get<GradeLevel[]>('/grade-levels', {
      params: activeOnly !== undefined ? { activeOnly } : undefined,
    });
    return data;
  },

  getById: async (id: string): Promise<GradeLevel> => {
    const { data } = await apiClient.get<GradeLevel>(`/grade-levels/${id}`);
    return data;
  },

  create: async (payload: CreateGradeLevelPayload): Promise<GradeLevel> => {
    const { data } = await apiClient.post<GradeLevel>('/grade-levels', payload);
    return data;
  },

  update: async (id: string, payload: UpdateGradeLevelPayload): Promise<GradeLevel> => {
    const { data } = await apiClient.patch<GradeLevel>(`/grade-levels/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<GradeLevel> => {
    const { data } = await apiClient.delete<GradeLevel>(`/grade-levels/${id}`);
    return data;
  },
};
