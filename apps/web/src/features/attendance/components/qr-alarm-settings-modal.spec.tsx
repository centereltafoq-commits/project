import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/design-system';
import * as soundModule from '@/lib/qr-sound-effects.util';
import { qrAlarmSoundsApi } from '../qr-alarm-sounds.api';
import { DEFAULT_QR_ALARM_PREFERENCES, QrAlarmPreferences } from '../qr-alarm-settings.types';
import { QrAlarmSettingsModal } from './qr-alarm-settings-modal';

vi.mock('../qr-alarm-sounds.api', () => ({
  qrAlarmSoundsApi: {
    list: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('@/lib/qr-sound-effects.util', () => ({
  playQrBlockedAlarmSound: vi.fn(),
  stopQrAlarmPreview: vi.fn(),
}));

const CUSTOM_SOUND_1 = {
  id: '550e8400-e29b-41d4-a716-446655440100',
  label: 'إنذار البوابة',
  fileName: 'alarm-550e8400-e29b-41d4-a716-446655440100.mp3',
  originalName: 'gate-alarm.mp3',
  url: '/api/attendance/alarm-sounds/alarm-550e8400-e29b-41d4-a716-446655440100.mp3',
  sizeBytes: 64 * 1024,
  createdAt: '2026-11-20T12:00:00.000Z',
};

function renderControlledModal(
  initialPrefs: QrAlarmPreferences = { ...DEFAULT_QR_ALARM_PREFERENCES },
  canManageSounds = true,
) {
  const onChangeSpy = vi.fn();

  function Wrapper() {
    const [prefs, setPrefs] = React.useState(initialPrefs);
    return (
      <QrAlarmSettingsModal
        open={true}
        onOpenChange={vi.fn()}
        prefs={prefs}
        onChangePrefs={(next) => {
          setPrefs(next);
          onChangeSpy(next);
        }}
        canManageSounds={canManageSounds}
      />
    );
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Wrapper />
      </ToastProvider>
    </QueryClientProvider>,
  );

  return { onChangeSpy };
}

describe('QrAlarmSettingsModal (custom MP3, sound selector & volume control)', () => {
  const listMock = vi.mocked(qrAlarmSoundsApi.list);
  const uploadMock = vi.mocked(qrAlarmSoundsApi.upload);
  const removeMock = vi.mocked(qrAlarmSoundsApi.remove);

  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([CUSTOM_SOUND_1]);
  });

  it('adjusts volume via slider, +/- buttons, and presets and previews selected built-in sound', async () => {
    const { onChangeSpy } = renderControlledModal();

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'خفض الصوت' }));
    expect(onChangeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ volumePercent: 90 }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'رفع الصوت' }));
    expect(onChangeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ volumePercent: 100 }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'هادئ (35%)' }));
    expect(onChangeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ volumePercent: 35 }),
    );

    const slider = screen.getByRole('slider', { name: 'مستوى صوت الإنذار' });
    fireEvent.change(slider, { target: { value: '125' } });
    expect(onChangeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ volumePercent: 125 }),
    );

    fireEvent.click(screen.getByText('رنة رفض مزدوجة'));
    expect(onChangeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ soundId: 'double-buzz', customAudioUrl: null }),
    );

    fireEvent.click(screen.getByRole('button', { name: /تجربة الصوت/i }));
    expect(soundModule.playQrBlockedAlarmSound).toHaveBeenCalledWith({
      soundId: 'double-buzz',
      customAudioUrl: null,
      volumePercent: 125,
    });
  });

  it('uploads an MP3 file, auto-selects it, and falls back to default siren if active MP3 is deleted', async () => {
    const uploadedSound = {
      id: '550e8400-e29b-41d4-a716-446655440200',
      label: 'صوت خاص جديد',
      fileName: 'alarm-550e8400-e29b-41d4-a716-446655440200.mp3',
      originalName: 'my-alarm.mp3',
      url: '/api/attendance/alarm-sounds/alarm-550e8400-e29b-41d4-a716-446655440200.mp3',
      sizeBytes: 32 * 1024,
      createdAt: '2026-11-20T12:10:00.000Z',
    };

    uploadMock.mockResolvedValue(uploadedSound);
    removeMock.mockResolvedValue({ success: true, id: uploadedSound.id });

    const { onChangeSpy } = renderControlledModal();

    await waitFor(() => {
      expect(screen.getByText('إنذار البوابة')).toBeInTheDocument();
    });

    const labelInput = screen.getByPlaceholderText(/اسم الصوت/i);
    fireEvent.change(labelInput, { target: { value: 'صوت خاص جديد' } });

    listMock.mockResolvedValue([uploadedSound, CUSTOM_SOUND_1]);
    const fileInput = screen.getByTestId('alarm-mp3-file-input');
    const mp3File = new File([new Uint8Array([0x49, 0x44, 0x33])], 'my-alarm.mp3', {
      type: 'audio/mpeg',
    });
    fireEvent.change(fileInput, { target: { files: [mp3File] } });

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledWith(mp3File, 'صوت خاص جديد');
    });

    await waitFor(() => {
      expect(onChangeSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          enabled: true,
          soundId: uploadedSound.id,
          customAudioUrl: uploadedSound.url,
        }),
      );
    });

    const deleteBtn = await screen.findByRole('button', { name: 'حذف صوت خاص جديد' });
    listMock.mockResolvedValue([CUSTOM_SOUND_1]);
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(removeMock).toHaveBeenCalledWith(uploadedSound.id);
    });

    await waitFor(() => {
      expect(onChangeSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          soundId: 'siren',
          customAudioUrl: null,
        }),
      );
    });
  });
});
