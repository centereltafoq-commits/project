import blockedAlarmAudioUrl from '@/assets/sounds/emergency_siren_short_burst.ogg';
import successBeepAudioUrl from '@/assets/sounds/beep_short.ogg';
import errorAlertAudioUrl from '@/assets/sounds/beeper_emergency_call.ogg';

type ToneStep = {
  freq: number;
  durationSec: number;
  delaySec: number;
  type: OscillatorType;
  gain?: number;
};

interface CachedAudioEntry {
  audio: HTMLAudioElement;
  gainNode: GainNode | null;
}

const audioCache = new Map<string, CachedAudioEntry>();
let sharedAudioContext: AudioContext | null = null;

function getAudioContextClass(): (typeof AudioContext) | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext || win.webkitAudioContext || null;
}

function getOrCreateSharedContext(): AudioContext | null {
  const AudioCtx = getAudioContextClass();
  if (!AudioCtx) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioCtx();
  }
  if (sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume().catch(() => undefined);
  }
  return sharedAudioContext;
}

function playToneSequence(steps: ToneStep[]): void {
  try {
    const AudioCtx = getAudioContextClass();
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    let maxEnd = 0;

    for (const step of steps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = step.type;
      osc.frequency.setValueAtTime(step.freq, now + step.delaySec);

      const volume = step.gain ?? 0.5;
      gain.gain.setValueAtTime(0.001, now + step.delaySec);
      gain.gain.exponentialRampToValueAtTime(volume, now + step.delaySec + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + step.delaySec + step.durationSec,
      );

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + step.delaySec);
      osc.stop(now + step.delaySec + step.durationSec);

      maxEnd = Math.max(maxEnd, step.delaySec + step.durationSec);
    }

    setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, Math.ceil((maxEnd + 0.2) * 1000));
  } catch {
    // Ignore Web Audio failures in headless/test environments
  }
}

function attachGainBooster(
  audio: HTMLAudioElement,
  boostGain: number,
): GainNode | null {
  try {
    const ctx = getOrCreateSharedContext();
    if (
      !ctx ||
      typeof ctx.createMediaElementSource !== 'function' ||
      typeof ctx.createGain !== 'function'
    ) {
      return null;
    }

    const source = ctx.createMediaElementSource(audio);
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(boostGain, ctx.currentTime);

    if (typeof ctx.createDynamicsCompressor === 'function') {
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.setValueAtTime(-3, ctx.currentTime);
      limiter.knee.setValueAtTime(6, ctx.currentTime);
      limiter.ratio.setValueAtTime(12, ctx.currentTime);
      limiter.attack.setValueAtTime(0.003, ctx.currentTime);
      limiter.release.setValueAtTime(0.1, ctx.currentTime);
      source.connect(gainNode);
      gainNode.connect(limiter);
      limiter.connect(ctx.destination);
    } else {
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
    }

    return gainNode;
  } catch {
    return null;
  }
}

function getOrCreateAudio(
  src: string,
  volume: number,
  boostGain: number,
): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  let entry = audioCache.get(src);
  if (!entry) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    const gainNode = attachGainBooster(audio, boostGain);
    entry = { audio, gainNode };
    audioCache.set(src, entry);
  } else if (entry.gainNode && sharedAudioContext) {
    entry.gainNode.gain.setValueAtTime(boostGain, sharedAudioContext.currentTime);
  }
  entry.audio.volume = volume;
  return entry.audio;
}

function playOfflineAudioAsset(
  src: string,
  volume: number,
  boostGain: number,
  fallbackSteps: ToneStep[],
): void {
  try {
    const ctx = getOrCreateSharedContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }

    const audio = getOrCreateAudio(src, volume, boostGain);
    if (!audio || typeof audio.play !== 'function') {
      playToneSequence(fallbackSteps);
      return;
    }

    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        playToneSequence(fallbackSteps);
      });
    }
  } catch {
    playToneSequence(fallbackSteps);
  }
}

/**
 * Loud urgent siren alert (bundled offline audio asset + Web Audio gain boost)
 * when a scanned student has unpaid dues.
 */
export function playQrBlockedAlarmSound(): void {
  playOfflineAudioAsset(blockedAlarmAudioUrl, 1.0, 4.5, [
    { freq: 880, durationSec: 0.2, delaySec: 0, type: 'sawtooth', gain: 0.75 },
    { freq: 587, durationSec: 0.2, delaySec: 0.22, type: 'sawtooth', gain: 0.75 },
    { freq: 880, durationSec: 0.2, delaySec: 0.44, type: 'sawtooth', gain: 0.75 },
    { freq: 587, durationSec: 0.3, delaySec: 0.66, type: 'sawtooth', gain: 0.75 },
  ]);
}

/**
 * Crisp confirmation beep (bundled offline audio asset) when a cleared
 * student checks in.
 */
export function playQrSuccessBeep(): void {
  playOfflineAudioAsset(successBeepAudioUrl, 1.0, 2.0, [
    { freq: 784, durationSec: 0.1, delaySec: 0, type: 'sine', gain: 0.45 },
    { freq: 1175, durationSec: 0.18, delaySec: 0.11, type: 'sine', gain: 0.5 },
  ]);
}

/**
 * Alert tone (bundled offline audio asset) when QR code is unknown or invalid.
 */
export function playQrErrorTone(): void {
  playOfflineAudioAsset(errorAlertAudioUrl, 1.0, 2.5, [
    { freq: 260, durationSec: 0.28, delaySec: 0, type: 'triangle', gain: 0.55 },
  ]);
}
