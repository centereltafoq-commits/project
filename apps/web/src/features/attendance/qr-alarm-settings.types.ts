export type BuiltinAlarmSoundId =
  | 'siren'
  | 'beeper'
  | 'double-buzz'
  | 'urgent-pulse'
  | 'soft-chime';

export interface QrAlarmSoundPreset {
  id: BuiltinAlarmSoundId;
  label: string;
  description: string;
}

export interface CustomAlarmSoundItem {
  id: string;
  label: string;
  fileName: string;
  originalName: string;
  url: string;
  sizeBytes: number;
  createdAt: string;
}

export interface QrAlarmPreferences {
  enabled: boolean;
  volumePercent: number;
  soundId: string;
  customAudioUrl: string | null;
}

export const ALARM_VOLUME_MIN = 0;
export const ALARM_VOLUME_MAX = 150;

export const DEFAULT_QR_ALARM_PREFERENCES: QrAlarmPreferences = {
  enabled: true,
  volumePercent: 100,
  soundId: 'siren',
  customAudioUrl: null,
};

export const ALARM_VOLUME_PRESETS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 35, label: 'هادئ (35%)' },
  { value: 75, label: 'متوسط (75%)' },
  { value: 100, label: 'عالي (100%)' },
  { value: 150, label: 'قوي جداً (150%)' },
];

export const BUILTIN_ALARM_SOUNDS: ReadonlyArray<QrAlarmSoundPreset> = [
  {
    id: 'siren',
    label: 'سارينة إنذار عالية',
    description: 'نغمة طوارئ واضحة لتنبيه الريسبشن عند وجود متأخرات',
  },
  {
    id: 'beeper',
    label: 'بيبر تنبيه متقطع',
    description: 'صفارة تنبيه متكررة حادة ومباشرة',
  },
  {
    id: 'double-buzz',
    label: 'رنة رفض مزدوجة',
    description: 'نغمتان حاسمتان سريعتان تشيران لرفض المرور',
  },
  {
    id: 'urgent-pulse',
    label: 'نبض سريع متتابع',
    description: 'إيقاع رباعي سريع لجذب الانتباه في الأماكن المزدحمة',
  },
  {
    id: 'soft-chime',
    label: 'تنبيه هادئ مهذب',
    description: 'نغمة خفيفة مريحة مناسبة للهدوء أمام الطلاب',
  },
];
