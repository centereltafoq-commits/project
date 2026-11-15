import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  playQrBlockedAlarmSound,
  playQrErrorTone,
  playQrSuccessBeep,
} from './qr-sound-effects.util';

describe('qr-sound-effects.util (offline bundled audio assets)', () => {
  const originalAudio = globalThis.Audio;

  afterEach(() => {
    globalThis.Audio = originalAudio;
    vi.restoreAllMocks();
  });

  it('plays bundled offline audio files for blocked alarm, success beep, and error tone', () => {
    const playSpy = vi.fn().mockResolvedValue(undefined);
    const audioInstances: Array<{ src: string; volume: number; currentTime: number }> = [];

    class MockAudio {
      src: string;
      volume = 1;
      preload = '';
      currentTime = 5;
      play = playSpy;

      constructor(src: string) {
        this.src = src;
        audioInstances.push(this);
      }
    }

    globalThis.Audio = MockAudio as unknown as typeof Audio;

    playQrBlockedAlarmSound();
    playQrSuccessBeep();
    playQrErrorTone();

    expect(playSpy).toHaveBeenCalledTimes(3);
    expect(audioInstances.map((a) => a.src)).toEqual([
      expect.stringContaining('emergency_siren_short_burst.ogg'),
      expect.stringContaining('beep_short.ogg'),
      expect.stringContaining('beeper_emergency_call.ogg'),
    ]);
    expect(audioInstances.every((a) => a.currentTime === 0)).toBe(true);
  });
});
