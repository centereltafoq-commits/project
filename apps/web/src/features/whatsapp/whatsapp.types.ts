export type WhatsappTemplateCategory =
  | 'SUBSCRIPTION'
  | 'ABSENCE'
  | 'ATTENDANCE'
  | 'SCHEDULE'
  | 'GENERAL';

export const WHATSAPP_CATEGORY_LABELS: Record<WhatsappTemplateCategory, string> = {
  SUBSCRIPTION: 'الاشتراكات والمصروفات',
  ABSENCE: 'تنبيهات الغياب',
  ATTENDANCE: 'تأكيد الحضور',
  SCHEDULE: 'المواعيد والحصص',
  GENERAL: 'رسائل عامة',
};

export const WHATSAPP_CATEGORY_OPTIONS: Array<{
  value: WhatsappTemplateCategory;
  label: string;
}> = (Object.keys(WHATSAPP_CATEGORY_LABELS) as WhatsappTemplateCategory[]).map((key) => ({
  value: key,
  label: WHATSAPP_CATEGORY_LABELS[key],
}));

export interface WhatsappTemplateItem {
  id: string;
  title: string;
  category: WhatsappTemplateCategory;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWhatsappTemplatePayload {
  title: string;
  category?: WhatsappTemplateCategory;
  content: string;
  isDefault?: boolean;
}

export interface UpdateWhatsappTemplatePayload {
  title?: string;
  category?: WhatsappTemplateCategory;
  content?: string;
  isDefault?: boolean;
}

export type WhatsappMessageMode = 'template' | 'one-time';
export type WhatsappTargetMode = 'single' | 'group';
export type WhatsappPhonePreference = 'guardian' | 'student' | 'auto';
