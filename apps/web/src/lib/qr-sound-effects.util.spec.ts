import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  playQrBlockedAlarmSound,
  stopQrAlarmPreview,
} from './qr-sound-effects.util';

describe('qr-sound-effects.util', () => {
  const originalAudio = globalThis.Audio;

  beforeEach(() => {
    stopQrAlarmPreview();
  });

  afterEach(() => {
    stopQrAlarmPreview();
    globalThis.Audio = originalAudio;
    vi.restoreAllMocks();
  });

  it('does not play audio when volumePercent is 0', () => {
    const audioInstances: any[] = [];
    globalThis.Audio = vi.fn().mockImplementation((src?: string) => {
      const instance = {
        src: src ?? '',
        volume: 1,
        currentTime: 0,
        preload: '',
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        onerror: null,
      };
      audioInstances.push(instance);
      return instance;
    }) as any;

    playQrBlockedAlarmSound({
      customAudioUrl: '/api/attendance/alarm-sounds/alarm-zero.mp3',
      volumePercent: 0,
    });

    expect(audioInstances).toHaveLength(0);
  });

  it('plays custom MP3 audio URL at requested volume percentage and stops cleanly on stopQrAlarmPreview', () => {
    const audioInstances: any[] = [];
    globalThis.Audio = vi.fn().mockImplementation((src?: string) => {
      const instance = {
        src: src ?? '',
        volume: 1,
        currentTime: 0,
        preload: '',
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        onerror: null,
      };
      audioInstances.push(instance);
      return instance;
    }) as any;

    playQrBlockedAlarmSound({
      soundId: 'custom-1',
      customAudioUrl: '/api/attendance/alarm-sounds/alarm-custom-1.mp3',
      volumePercent: 60,
    });

    expect(audioInstances).toHaveLength(1);
    const created = audioInstances[0]!;
    expect(created.src).toBe('/api/attendance/alarm-sounds/alarm-custom-1.mp3');
    expect(created.volume).toBeCloseTo(0.6, 4);
    expect(created.play).toHaveBeenCalledTimes(1);

    created.currentTime = 3.2;
    stopQrAlarmPreview();

    expect(created.pause).toHaveBeenCalledTimes(1);
    expect(created.currentTime).toBe(0);
  });
});
