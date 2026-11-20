import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Loader2,
  Minus,
  Music,
  Play,
  Plus,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Badge, Button, Input, Modal, useToast } from '@/design-system';
import { extractErrorMessage } from '@/lib/api-client';
import {
  playQrBlockedAlarmSound,
  stopQrAlarmPreview,
} from '@/lib/qr-sound-effects.util';
import { qrAlarmSoundsApi } from '../qr-alarm-sounds.api';
import { clampAlarmVolume } from '../qr-alarm-settings.storage';
import {
  ALARM_VOLUME_MAX,
  ALARM_VOLUME_MIN,
  ALARM_VOLUME_PRESETS,
  BUILTIN_ALARM_SOUNDS,
  CustomAlarmSoundItem,
  DEFAULT_QR_ALARM_PREFERENCES,
  QrAlarmPreferences,
} from '../qr-alarm-settings.types';

interface QrAlarmSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: QrAlarmPreferences;
  onChangePrefs: (next: QrAlarmPreferences) => void;
  canManageSounds: boolean;
}

const MAX_CLIENT_MP3_SIZE_BYTES = 5 * 1024 * 1024;
const EMPTY_CUSTOM_SOUNDS: CustomAlarmSoundItem[] = [];

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function QrAlarmSettingsModal({
  open,
  onOpenChange,
  prefs,
  onChangePrefs,
  canManageSounds,
}: QrAlarmSettingsModalProps) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [customLabel, setCustomLabel] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      stopQrAlarmPreview();
    }
    return () => {
      stopQrAlarmPreview();
    };
  }, [open]);

  const {
    data: customSounds = EMPTY_CUSTOM_SOUNDS,
    isLoading: isLoadingSounds,
  } = useQuery<CustomAlarmSoundItem[]>({
    queryKey: ['attendance-alarm-sounds'],
    enabled: open,
    queryFn: qrAlarmSoundsApi.list,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, label }: { file: File; label?: string }) =>
      qrAlarmSoundsApi.upload(file, label),
    onSuccess: (uploaded) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-alarm-sounds'] });
      onChangePrefs({
        ...prefs,
        enabled: true,
        soundId: uploaded.id,
        customAudioUrl: uploaded.url,
      });
      setCustomLabel('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      notify(`تم رفع الصوت "${uploaded.label}" وتحديده كصوت الإنذار بنجاح`, 'success');
    },
    onError: (err) => {
      notify(extractErrorMessage(err), 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => qrAlarmSoundsApi.remove(id),
    onSuccess: (_res, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-alarm-sounds'] });
      if (prefs.soundId === deletedId) {
        onChangePrefs({
          ...prefs,
          soundId: DEFAULT_QR_ALARM_PREFERENCES.soundId,
          customAudioUrl: null,
        });
      }
      notify('تم حذف ملف الصوت المخصص', 'success');
    },
    onError: (err) => {
      notify(extractErrorMessage(err), 'error');
    },
  });

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isMp3Name = file.name.toLowerCase().endsWith('.mp3');
    if (!isMp3Name) {
      notify('يرجى اختيار ملف صوتي بصيغة MP3 فقط (.mp3)', 'error');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_CLIENT_MP3_SIZE_BYTES) {
      notify('حجم ملف MP3 يجب ألا يتجاوز 5 ميجابايت', 'error');
      e.target.value = '';
      return;
    }

    uploadMutation.mutate({ file, label: customLabel });
  };

  const setVolume = (nextValue: number) => {
    const clamped = clampAlarmVolume(nextValue);
    onChangePrefs({
      ...prefs,
      volumePercent: clamped,
    });
  };

  const previewSound = (soundId: string, customAudioUrl: string | null) => {
    playQrBlockedAlarmSound({
      soundId,
      customAudioUrl,
      volumePercent: prefs.volumePercent,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="إعدادات صوت إنذار الاشتراكات (QR)"
      description="تحكم في مستوى صوت الإنذار، أو اختر نغمة جاهزة، أو ارفع ملف صوت MP3 مخصص"
    >
      <div className="space-y-5">
        {/* التحكم في التفعيل ومستوى الصوت */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {prefs.enabled && prefs.volumePercent > 0 ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-black text-foreground">مستوى صوت الإنذار</h4>
                <p className="text-[11px] text-muted-foreground">
                  يمكنك خفض الصوت للأماكن الهادئة أو رفعه حتى 150%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={prefs.enabled ? 'success' : 'neutral'} className="font-mono text-xs">
                {prefs.volumePercent}%
              </Badge>
              <Button
                type="button"
                size="sm"
                variant={prefs.enabled ? 'outline' : 'secondary'}
                onClick={() => onChangePrefs({ ...prefs, enabled: !prefs.enabled })}
                className="h-8 gap-1.5 text-xs font-bold"
              >
                {prefs.enabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                <span>{prefs.enabled ? 'الإنذار مفعل' : 'الإنذار مكتوم'}</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setVolume(prefs.volumePercent - 10)}
              disabled={prefs.volumePercent <= ALARM_VOLUME_MIN}
              aria-label="خفض الصوت"
              className="h-8 w-8 shrink-0 p-0"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>

            <input
              type="range"
              aria-label="مستوى صوت الإنذار"
              min={ALARM_VOLUME_MIN}
              max={ALARM_VOLUME_MAX}
              step={5}
              value={prefs.volumePercent}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer accent-primary"
            />

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setVolume(prefs.volumePercent + 10)}
              disabled={prefs.volumePercent >= ALARM_VOLUME_MAX}
              aria-label="رفع الصوت"
              className="h-8 w-8 shrink-0 p-0"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {ALARM_VOLUME_PRESETS.map((preset) => {
                const active = prefs.volumePercent === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setVolume(preset.value)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={prefs.volumePercent === 0}
                onClick={() => previewSound(prefs.soundId, prefs.customAudioUrl)}
                className="h-8 gap-1.5 px-3 text-xs font-bold"
              >
                <Play className="h-3.5 w-3.5" />
                <span>تجربة الصوت</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => stopQrAlarmPreview()}
                className="h-8 gap-1 px-2.5 text-xs font-bold"
              >
                <Square className="h-3 w-3" />
                <span>إيقاف</span>
              </Button>
            </div>
          </div>
        </div>

        {/* الأصوات الجاهزة المدمجة */}
        <div className="space-y-2">
          <h4 className="text-xs font-black text-foreground">الأصوات الجاهزة بالنظام</h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {BUILTIN_ALARM_SOUNDS.map((preset) => {
              const isSelected = !prefs.customAudioUrl && prefs.soundId === preset.id;
              return (
                <div
                  key={preset.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                      : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onChangePrefs({
                        ...prefs,
                        soundId: preset.id,
                        customAudioUrl: null,
                      })
                    }
                    className="flex min-w-0 flex-1 items-start gap-2 text-right"
                  >
                    <CheckCircle2
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        isSelected ? 'text-primary' : 'text-muted-foreground/30'
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="block truncate text-xs font-bold text-foreground">
                        {preset.label}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {preset.description}
                      </span>
                    </div>
                  </button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={prefs.volumePercent === 0}
                    onClick={() => previewSound(preset.id, null)}
                    title={`تشغيل معاينة ${preset.label}`}
                    aria-label={`معاينة ${preset.label}`}
                    className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-primary"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* أصوات MP3 المخصصة */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-black text-foreground">أصوات MP3 المخصصة</h4>
            <Badge variant="neutral" className="text-[10px]">
              MP3 فقط • حد أقصى 5 MB
            </Badge>
          </div>

          {canManageSounds && (
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/15 p-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <Input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="اسم الصوت (اختياري، مثال: سارينة القاعة الرئيسية)"
                  maxLength={80}
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,audio/mpeg"
                onChange={handleFileSelected}
                className="hidden"
                data-testid="alarm-mp3-file-input"
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploadMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 font-bold shrink-0"
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span>رفع ملف MP3</span>
              </Button>
            </div>
          )}

          <div className="max-h-44 overflow-y-auto rounded-xl border border-border bg-card divide-y divide-border">
            {isLoadingSounds ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري تحميل الأصوات المخصصة...</span>
              </div>
            ) : customSounds.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                لا توجد ملفات MP3 مرفوعة حالياً. يمكنك رفع ملف صوتي من جهازك بالأعلى.
              </div>
            ) : (
              customSounds.map((sound) => {
                const isSelected =
                  prefs.soundId === sound.id && prefs.customAudioUrl === sound.url;
                return (
                  <div
                    key={sound.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/30'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onChangePrefs({
                          ...prefs,
                          soundId: sound.id,
                          customAudioUrl: sound.url,
                        })
                      }
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-right"
                    >
                      <Music
                        className={`h-4 w-4 shrink-0 ${
                          isSelected ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />
                      <div className="min-w-0">
                        <span className="block truncate font-bold text-foreground">
                          {sound.label}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {sound.originalName} • {formatFileSize(sound.sizeBytes)}
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {isSelected && (
                        <Badge variant="info" className="text-[10px]">
                          مفعل
                        </Badge>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={prefs.volumePercent === 0}
                        onClick={() => previewSound(sound.id, sound.url)}
                        aria-label={`معاينة ${sound.label}`}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      {canManageSounds && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(sound.id)}
                          aria-label={`حذف ${sound.label}`}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-border pt-3">
          <Button type="button" onClick={() => onOpenChange(false)}>
            تم
          </Button>
        </div>
      </div>
    </Modal>
  );
}
