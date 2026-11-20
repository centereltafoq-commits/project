import {
  ALARM_VOLUME_MAX,
  ALARM_VOLUME_MIN,
  DEFAULT_QR_ALARM_PREFERENCES,
  QrAlarmPreferences,
} from './qr-alarm-settings.types';

const STORAGE_KEY = 'educenter_qr_alarm_prefs_v1';

export function clampAlarmVolume(value: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return DEFAULT_QR_ALARM_PREFERENCES.volumePercent;
  }
  return Math.min(ALARM_VOLUME_MAX, Math.max(ALARM_VOLUME_MIN, Math.round(value)));
}

export function loadQrAlarmPreferences(): QrAlarmPreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_QR_ALARM_PREFERENCES };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_QR_ALARM_PREFERENCES };
    }

    const parsed = JSON.parse(raw) as Partial<QrAlarmPreferences> | null;
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_QR_ALARM_PREFERENCES };
    }

    const enabled =
      typeof parsed.enabled === 'boolean'
        ? parsed.enabled
        : DEFAULT_QR_ALARM_PREFERENCES.enabled;

    const volumePercent =
      typeof parsed.volumePercent === 'number'
        ? clampAlarmVolume(parsed.volumePercent)
        : DEFAULT_QR_ALARM_PREFERENCES.volumePercent;

    const soundId =
      typeof parsed.soundId === 'string' && parsed.soundId.trim().length > 0
        ? parsed.soundId.trim()
        : DEFAULT_QR_ALARM_PREFERENCES.soundId;

    const customAudioUrl =
      typeof parsed.customAudioUrl === 'string' &&
      parsed.customAudioUrl.startsWith('/api/attendance/alarm-sounds/')
        ? parsed.customAudioUrl
        : null;

    return {
      enabled,
      volumePercent,
      soundId: customAudioUrl ? soundId : soundId,
      customAudioUrl,
    };
  } catch {
    return { ...DEFAULT_QR_ALARM_PREFERENCES };
  }
}

export function saveQrAlarmPreferences(prefs: QrAlarmPreferences): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const sanitized: QrAlarmPreferences = {
      enabled: Boolean(prefs.enabled),
      volumePercent: clampAlarmVolume(prefs.volumePercent),
      soundId:
        typeof prefs.soundId === 'string' && prefs.soundId.trim().length > 0
          ? prefs.soundId.trim()
          : DEFAULT_QR_ALARM_PREFERENCES.soundId,
      customAudioUrl:
        typeof prefs.customAudioUrl === 'string' &&
        prefs.customAudioUrl.startsWith('/api/attendance/alarm-sounds/')
          ? prefs.customAudioUrl
          : null,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}
