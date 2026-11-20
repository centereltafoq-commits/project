import blockedAlarmAudioUrl from '@/assets/sounds/emergency_siren_short_burst.ogg';
import successBeepAudioUrl from '@/assets/sounds/beep_short.ogg';
import errorAlertAudioUrl from '@/assets/sounds/beeper_emergency_call.ogg';

export interface QrBlockedAlarmPlaybackOptions {
  soundId?: string;
  customAudioUrl?: string | null;
  volumePercent?: number;
}

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
let activePreviewAudio: HTMLAudioElement | null = null;
let activeToneContext: AudioContext | null = null;
let activeToneTimer: ReturnType<typeof setTimeout> | null = null;

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

function normalizeVolumeScale(volumePercent?: number): {
  shouldPlay: boolean;
  level: number;
  elementVolume: number;
  boostGain: number;
} {
  const clamped =
    typeof volumePercent === 'number' && !Number.isNaN(volumePercent)
      ? Math.min(150, Math.max(0, volumePercent))
      : 100;

  if (clamped <= 0) {
    return { shouldPlay: false, level: 0, elementVolume: 0, boostGain: 0 };
  }

  const level = clamped / 100;
  const elementVolume = Math.min(1, level);
  const boostGain =
    level <= 1 ? level * 1.2 : 1.2 + ((level - 1) / 0.5) * 2.3;

  return { shouldPlay: true, level, elementVolume, boostGain };
}

/**
 * Stops any currently playing QR alarm sound or preview immediately so sounds never overlap.
 */
export function stopQrAlarmPreview(): void {
  if (activePreviewAudio) {
    try {
      activePreviewAudio.pause();
      activePreviewAudio.currentTime = 0;
    } catch {
      // Ignore cleanup errors
    }
    activePreviewAudio = null;
  }

  if (activeToneTimer) {
    clearTimeout(activeToneTimer);
    activeToneTimer = null;
  }

  if (activeToneContext) {
    try {
      void activeToneContext.close().catch(() => undefined);
    } catch {
      // Ignore cleanup errors
    }
    activeToneContext = null;
  }
}

function playToneSequence(steps: ToneStep[], volumeScale = 1): void {
  try {
    if (volumeScale <= 0) return;

    const AudioCtx = getAudioContextClass();
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    activeToneContext = ctx;
    const now = ctx.currentTime;
    let maxEnd = 0;

    for (const step of steps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = step.type;
      osc.frequency.setValueAtTime(step.freq, now + step.delaySec);

      const rawGain = (step.gain ?? 0.5) * Math.min(1.5, volumeScale);
      const volume = Math.min(1.0, Math.max(0.01, rawGain));
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

    activeToneTimer = setTimeout(() => {
      activeToneTimer = null;
      if (activeToneContext === ctx) {
        activeToneContext = null;
      }
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
  elementVolume: number,
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

  entry.audio.volume = entry.gainNode ? 1 : elementVolume;
  return entry.audio;
}

function playAudioAsset(
  src: string,
  volumePercent: number | undefined,
  fallbackSteps: ToneStep[],
  onAssetFailure?: () => void,
): void {
  const { shouldPlay, level, elementVolume, boostGain } = normalizeVolumeScale(volumePercent);
  if (!shouldPlay) return;

  try {
    const ctx = getOrCreateSharedContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }

    const audio = getOrCreateAudio(src, elementVolume, boostGain);
    if (!audio || typeof audio.play !== 'function') {
      if (onAssetFailure) {
        onAssetFailure();
      } else {
        playToneSequence(fallbackSteps, level);
      }
      return;
    }

    let handledFailure = false;
    const handleFailure = () => {
      if (handledFailure) return;
      handledFailure = true;
      if (onAssetFailure) {
        onAssetFailure();
      } else {
        playToneSequence(fallbackSteps, level);
      }
    };

    audio.onerror = handleFailure;
    audio.currentTime = 0;
    activePreviewAudio = audio;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(handleFailure);
    }
  } catch {
    if (onAssetFailure) {
      onAssetFailure();
    } else {
      playToneSequence(fallbackSteps, level);
    }
  }
}

const SIREN_FALLBACK_STEPS: ToneStep[] = [
  { freq: 880, durationSec: 0.2, delaySec: 0, type: 'sawtooth', gain: 0.75 },
  { freq: 587, durationSec: 0.2, delaySec: 0.22, type: 'sawtooth', gain: 0.75 },
  { freq: 880, durationSec: 0.2, delaySec: 0.44, type: 'sawtooth', gain: 0.75 },
  { freq: 587, durationSec: 0.3, delaySec: 0.66, type: 'sawtooth', gain: 0.75 },
];

const DOUBLE_BUZZ_STEPS: ToneStep[] = [
  { freq: 240, durationSec: 0.16, delaySec: 0, type: 'sawtooth', gain: 0.65 },
  { freq: 190, durationSec: 0.24, delaySec: 0.2, type: 'square', gain: 0.65 },
];

const URGENT_PULSE_STEPS: ToneStep[] = [
  { freq: 920, durationSec: 0.1, delaySec: 0, type: 'square', gain: 0.6 },
  { freq: 640, durationSec: 0.1, delaySec: 0.13, type: 'square', gain: 0.6 },
  { freq: 920, durationSec: 0.1, delaySec: 0.26, type: 'square', gain: 0.6 },
  { freq: 640, durationSec: 0.14, delaySec: 0.39, type: 'square', gain: 0.6 },
];

const SOFT_CHIME_STEPS: ToneStep[] = [
  { freq: 523.25, durationSec: 0.16, delaySec: 0, type: 'triangle', gain: 0.42 },
  { freq: 392.0, durationSec: 0.24, delaySec: 0.18, type: 'sine', gain: 0.4 },
];

/**
 * Plays the configured subscription-block alarm sound (custom MP3 or built-in preset)
 * at the configured volume (0%..150%).
 */
export function playQrBlockedAlarmSound(options?: QrBlockedAlarmPlaybackOptions): void {
  stopQrAlarmPreview();

  const { shouldPlay, level } = normalizeVolumeScale(options?.volumePercent);
  if (!shouldPlay) return;

  if (options?.customAudioUrl) {
    playAudioAsset(
      options.customAudioUrl,
      options.volumePercent,
      SIREN_FALLBACK_STEPS,
      () => {
        playAudioAsset(blockedAlarmAudioUrl, options.volumePercent, SIREN_FALLBACK_STEPS);
      },
    );
    return;
  }

  switch (options?.soundId) {
    case 'beeper':
      playAudioAsset(errorAlertAudioUrl, options.volumePercent, [
        { freq: 680, durationSec: 0.16, delaySec: 0, type: 'square', gain: 0.6 },
        { freq: 680, durationSec: 0.2, delaySec: 0.22, type: 'square', gain: 0.6 },
      ]);
      return;
    case 'double-buzz':
      playToneSequence(DOUBLE_BUZZ_STEPS, level);
      return;
    case 'urgent-pulse':
      playToneSequence(URGENT_PULSE_STEPS, level);
      return;
    case 'soft-chime':
      playToneSequence(SOFT_CHIME_STEPS, level);
      return;
    case 'siren':
    default:
      playAudioAsset(blockedAlarmAudioUrl, options?.volumePercent, SIREN_FALLBACK_STEPS);
  }
}

/**
 * Crisp confirmation beep (bundled offline audio asset) when a cleared
 * student checks in.
 */
export function playQrSuccessBeep(volumePercent = 100): void {
  playAudioAsset(successBeepAudioUrl, volumePercent, [
    { freq: 784, durationSec: 0.1, delaySec: 0, type: 'sine', gain: 0.45 },
    { freq: 1175, durationSec: 0.18, delaySec: 0.11, type: 'sine', gain: 0.5 },
  ]);
}

/**
 * Alert tone (bundled offline audio asset) when QR code is unknown or invalid.
 */
export function playQrErrorTone(volumePercent = 100): void {
  playAudioAsset(errorAlertAudioUrl, volumePercent, [
    { freq: 260, durationSec: 0.28, delaySec: 0, type: 'triangle', gain: 0.55 },
  ]);
}
