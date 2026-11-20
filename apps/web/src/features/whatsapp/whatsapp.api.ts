import { apiClient } from '@/lib/api-client';
import {
  CreateWhatsappTemplatePayload,
  UpdateWhatsappTemplatePayload,
  WhatsappTemplateItem,
} from './whatsapp.types';

export const whatsappTemplatesApi = {
  list: async (): Promise<WhatsappTemplateItem[]> => {
    const { data } = await apiClient.get<WhatsappTemplateItem[]>('/whatsapp/templates');
    return Array.isArray(data) ? data : [];
  },

  create: async (payload: CreateWhatsappTemplatePayload): Promise<WhatsappTemplateItem> => {
    const { data } = await apiClient.post<WhatsappTemplateItem>('/whatsapp/templates', payload);
    return data;
  },

  update: async (
    id: string,
    payload: UpdateWhatsappTemplatePayload,
  ): Promise<WhatsappTemplateItem> => {
    const { data } = await apiClient.patch<WhatsappTemplateItem>(
      `/whatsapp/templates/${id}`,
      payload,
    );
    return data;
  },

  remove: async (id: string): Promise<{ success: boolean; id: string }> => {
    const { data } = await apiClient.delete<{ success: boolean; id: string }>(
      `/whatsapp/templates/${id}`,
    );
    return data;
  },

  resetDefaults: async (): Promise<WhatsappTemplateItem[]> => {
    const { data } = await apiClient.post<WhatsappTemplateItem[]>(
      '/whatsapp/templates/reset-defaults',
    );
    return Array.isArray(data) ? data : [];
  },
};
