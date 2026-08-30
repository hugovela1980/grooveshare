import type {
  PlaybackEngine,
  PlaybackStateListener,
  RecordedTakeAuditionOptions,
  RecordingStartMarker,
  SynchronizedRecordingPlaybackStart,
} from "@hugovela/frontend-core";

type GainParamLike = {
  value: number;
  cancelScheduledValues?: (startTime: number) => void;
  setValueAtTime?: (value: number, startTime: number) => void;
  linearRampToValueAtTime?: (value: number, endTime: number) => void;
};

type GainNodeLike = {
  gain: GainParamLike;
  connect: (destination: unknown) => unknown;
  disconnect?: () => void;
};

type OscillatorNodeLike = {
  type: string;
  frequency: { value: number };
  connect: (destination: unknown) => unknown;
  disconnect?: () => void;
  start: (when?: number) => void;
  stop: (when?: number) => void;
};

type AudioContextLike = {
  currentTime: number;
  state: string;
  destination: unknown;
  createGain: () => GainNodeLike;
  createOscillator: () => OscillatorNodeLike;
  resume: () => Promise<void>;
  close?: () => Promise<void>;
};

type AudioContextConstructorLike = new (
  options?: { latencyHint?: "interactive" },
) => AudioContextLike;

type ScheduleTimeout = (
  handler: () => void,
  milliseconds: number,
) => unknown;

type ClearScheduledTimeout = (handle: unknown) => void;

export type BrowserOutputKeepalivePlaybackEngineOptions = {
  playbackEngine: PlaybackEngine;
  AudioContextConstructor?: AudioContextConstructorLike | null;
  frequencyHz?: number;
  levelDb?: number;
  warmupMilliseconds?: number;
  recentlyActiveMilliseconds?: number;
  nowMilliseconds?: () => number;
  scheduleTimeout?: ScheduleTimeout;
  clearScheduledTimeout?: ClearScheduledTimeout;
};

export const BROWSER_OUTPUT_KEEPALIVE_FREQUENCY_HZ = 20_000;
export const BROWSER_OUTPUT_KEEPALIVE_LEVEL_DB = -54;
export const BROWSER_OUTPUT_KEEPALIVE_WARMUP_MS = 400;
export const BROWSER_OUTPUT_KEEPALIVE_RECENTLY_ACTIVE_MS = 400;
const KEEPALIVE_FADE_OUT_SECONDS = 0.02;
const KEEPALIVE_STOP_PADDING_SECONDS = 0.005;

function getDefaultAudioContextConstructor(): AudioContextConstructorLike | null {
  const browserGlobal = globalThis as typeof globalThis & {
    AudioContext?: AudioContextConstructorLike;
    webkitAudioContext?: AudioContextConstructorLike;
  };

  return browserGlobal.AudioContext ?? browserGlobal.webkitAudioContext ?? null;
}

function waitForMilliseconds(
  milliseconds: number,
  scheduleTimeout: ScheduleTimeout,
): Promise<void> {
  if (milliseconds <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    scheduleTimeout(resolve, milliseconds);
  });
}

/**
 * Browser/device compatibility decorator for playback engines.
 *
 * Some mobile USB audio adapters auto-mute sparse Web Audio output and can
 * discard the first audible transient after an idle period. This decorator
 * keeps the physical output route active with a zero-mean 20 kHz sine while
 * GrooveShare is actively playing. Cold starts receive a short measured
 * warm-up before the authoritative transport starts; rapid restarts inside the
 * adapter's residual awake window skip that delay.
 *
 * Musical position, transport scheduling, track alignment, and the shared
 * Web Audio engine remain untouched. This is browser/device mechanics only.
 */
export function createBrowserOutputKeepalivePlaybackEngine({
  playbackEngine,
  AudioContextConstructor = getDefaultAudioContextConstructor(),
  frequencyHz = BROWSER_OUTPUT_KEEPALIVE_FREQUENCY_HZ,
  levelDb = BROWSER_OUTPUT_KEEPALIVE_LEVEL_DB,
  warmupMilliseconds = BROWSER_OUTPUT_KEEPALIVE_WARMUP_MS,
  recentlyActiveMilliseconds = BROWSER_OUTPUT_KEEPALIVE_RECENTLY_ACTIVE_MS,
  nowMilliseconds = () => performance.now(),
  scheduleTimeout = (handler, milliseconds) =>
    globalThis.setTimeout(handler, milliseconds),
}: BrowserOutputKeepalivePlaybackEngineOptions): PlaybackEngine {
  let keepaliveContext: AudioContextLike | null = null;
  let keepaliveOscillator: OscillatorNodeLike | null = null;
  let keepaliveGain: GainNodeLike | null = null;
  let keepaliveStartPromise: Promise<boolean> | null = null;
  let lastKeepaliveStoppedAtMilliseconds: number | null = null;
  let playbackOperationGeneration = 0;
  let keepaliveDesired = false;
  let delegateWasPlaying = playbackEngine.getSnapshot().isPlaying;
  let destroyed = false;

  async function startKeepalive(): Promise<boolean> {
    if (keepaliveContext && keepaliveOscillator && keepaliveGain) {
      return true;
    }

    if (!AudioContextConstructor || destroyed) {
      return false;
    }

    if (keepaliveStartPromise) {
      return keepaliveStartPromise;
    }

    const startPromise = (async () => {
      let context: AudioContextLike | null = null;
      let oscillator: OscillatorNodeLike | null = null;
      let gain: GainNodeLike | null = null;

      try {
        context = new AudioContextConstructor({
          latencyHint: "interactive",
        });

        if (context.state !== "running") {
          await context.resume();
        }

        if (destroyed) {
          await context.close?.();
          return false;
        }

        oscillator = context.createOscillator();
        gain = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = frequencyHz;
        gain.gain.value = 10 ** (levelDb / 20);

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start();

        keepaliveContext = context;
        keepaliveOscillator = oscillator;
        keepaliveGain = gain;

        return true;
      } catch (error) {
        try {
          oscillator?.disconnect?.();
          gain?.disconnect?.();
          await context?.close?.();
        } catch {
          // Keepalive is a compatibility enhancement;
          // playback must remain usable.
        }

        console.warn(
          "Could not start GrooveShare output keepalive.",
          error,
        );

        return false;
      }
    })();

    keepaliveStartPromise = startPromise;

    try {
      return await startPromise;
    } finally {
      if (keepaliveStartPromise === startPromise) {
        keepaliveStartPromise = null;
      }
    }
  }

  async function stopKeepalive(): Promise<void> {
    const context = keepaliveContext;
    const oscillator = keepaliveOscillator;
    const gain = keepaliveGain;

    keepaliveContext = null;
    keepaliveOscillator = null;
    keepaliveGain = null;

    if (!context || !oscillator || !gain) {
      return;
    }

    lastKeepaliveStoppedAtMilliseconds = nowMilliseconds();

    try {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues?.(now);
      gain.gain.setValueAtTime?.(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime?.(
        0,
        now + KEEPALIVE_FADE_OUT_SECONDS,
      );
      oscillator.stop(
        now + KEEPALIVE_FADE_OUT_SECONDS + KEEPALIVE_STOP_PADDING_SECONDS,
      );
    } catch {
      try {
        oscillator.stop();
      } catch {
        // Continue teardown even if the oscillator is already stopped.
      }
    }

    try {
      oscillator.disconnect?.();
      gain.disconnect?.();
      await context.close?.();
    } catch {
      // Playback teardown should not surface keepalive cleanup failures.
    }
  }

  function wasRecentlyActive(): boolean {
    if (lastKeepaliveStoppedAtMilliseconds === null) {
      return false;
    }

    const elapsed = nowMilliseconds() - lastKeepaliveStoppedAtMilliseconds;
    return elapsed >= 0 && elapsed <= recentlyActiveMilliseconds;
  }

  async function prepareOutputRoute(): Promise<number> {
    const preparationStartedAtMilliseconds = nowMilliseconds();
    const canSkipWarmup = wasRecentlyActive();
    const started = await startKeepalive();

    if (!started) {
      return 0;
    }

    if (!canSkipWarmup) {
      await waitForMilliseconds(warmupMilliseconds, scheduleTimeout);
    }

    const measuredPreparationMilliseconds = Math.max(
      0,
      nowMilliseconds() - preparationStartedAtMilliseconds,
    );

    // Test clocks and some coarse browser clocks may not advance across the
    // injected warm-up timer. Never report less structural capture lead-in
    // than the warm-up we deliberately applied.
    return canSkipWarmup
      ? measuredPreparationMilliseconds
      : Math.max(warmupMilliseconds, measuredPreparationMilliseconds);
  }

  async function play(): Promise<void> {
    if (playbackEngine.getSnapshot().preparation.status !== "ready") {
      return;
    }

    keepaliveDesired = true;
    const generation = ++playbackOperationGeneration;
    await prepareOutputRoute();

    if (destroyed || generation !== playbackOperationGeneration) {
      if (!keepaliveDesired) {
        await stopKeepalive();
      }
      return;
    }

    try {
      await playbackEngine.play();
    } catch (error) {
      keepaliveDesired = false;
      await stopKeepalive();
      throw error;
    }

    if (!playbackEngine.getSnapshot().isPlaying) {
      keepaliveDesired = false;
      await stopKeepalive();
    }
  }

  async function startSynchronizedRecordingPlayback(
    options?: { countInBars?: number },
  ): Promise<SynchronizedRecordingPlaybackStart> {
    if (!playbackEngine.startSynchronizedRecordingPlayback) {
      throw new Error(
        "Synchronized recording playback is unavailable in this environment.",
      );
    }

    keepaliveDesired = true;
    const generation = ++playbackOperationGeneration;
    const warmupAppliedMilliseconds = await prepareOutputRoute();

    if (destroyed || generation !== playbackOperationGeneration) {
      if (!keepaliveDesired) {
        await stopKeepalive();
      }
      throw new Error("Playback start was canceled.");
    }

    try {
      const result = await playbackEngine.startSynchronizedRecordingPlayback(options);
      return {
        ...result,
        mediaLeadInSeconds:
          result.mediaLeadInSeconds + warmupAppliedMilliseconds / 1000,
      };
    } catch (error) {
      keepaliveDesired = false;
      await stopKeepalive();
      throw error;
    }
  }

  async function auditionRecordedTake(
    options: RecordedTakeAuditionOptions,
  ): Promise<void> {
    if (!playbackEngine.auditionRecordedTake) {
      throw new Error("Sample-accurate recorded-take audition is unavailable.");
    }

    keepaliveDesired = true;
    const generation = ++playbackOperationGeneration;
    await prepareOutputRoute();

    if (destroyed || generation !== playbackOperationGeneration) {
      if (!keepaliveDesired) {
        await stopKeepalive();
      }
      return;
    }

    try {
      await playbackEngine.auditionRecordedTake(options);
    } catch (error) {
      keepaliveDesired = false;
      await stopKeepalive();
      throw error;
    }

    if (!playbackEngine.getSnapshot().isPlaying) {
      keepaliveDesired = false;
      await stopKeepalive();
    }
  }

  function stopRecordedTakeAudition(): void {
    playbackEngine.stopRecordedTakeAudition?.();
  }

  function pause(): void {
    keepaliveDesired = false;
    playbackOperationGeneration += 1;
    playbackEngine.pause();
    void stopKeepalive();
  }

  function stop(): void {
    keepaliveDesired = false;
    playbackOperationGeneration += 1;
    playbackEngine.stop();
    void stopKeepalive();
  }

  const unsubscribeKeepaliveLifecycle = playbackEngine.subscribe((snapshot) => {
    const wasPlaying = delegateWasPlaying;
    delegateWasPlaying = snapshot.isPlaying;

    if (wasPlaying && !snapshot.isPlaying) {
      keepaliveDesired = false;
      void stopKeepalive();
    }
  });

  function destroy(): void {
    if (destroyed) {
      return;
    }

    destroyed = true;
    keepaliveDesired = false;
    playbackOperationGeneration += 1;
    unsubscribeKeepaliveLifecycle();
    void stopKeepalive();
    playbackEngine.destroy?.();
  }

  return {
    loadMix: (channels) => playbackEngine.loadMix(channels),
    ...(playbackEngine.retryPreparation
      ? { retryPreparation: () => playbackEngine.retryPreparation!() }
      : {}),
    play,
    pause,
    stop,
    seek: (seconds) => playbackEngine.seek(seconds),
    seekBy: (seconds) => playbackEngine.seekBy(seconds),
    seekToMusicalPosition: (position) =>
      playbackEngine.seekToMusicalPosition(position),
    setLoopEnabled: (enabled) => playbackEngine.setLoopEnabled(enabled),
    setMetronomeEnabled: (enabled) => playbackEngine.setMetronomeEnabled?.(enabled),
    setChannelVolume: (channelNumber, volume) =>
      playbackEngine.setChannelVolume(channelNumber, volume),
    ...(playbackEngine.setRecordedTakeAuditionVolume ? {
      setRecordedTakeAuditionVolume: (volume: number) =>
        playbackEngine.setRecordedTakeAuditionVolume!(volume),
    } : {}),
    setChannelEnabled: (channelNumber, enabled) =>
      playbackEngine.setChannelEnabled(channelNumber, enabled),
    getSnapshot: () => playbackEngine.getSnapshot(),
    subscribe: (listener: PlaybackStateListener) =>
      playbackEngine.subscribe(listener),
    ...(playbackEngine.startSynchronizedRecordingPlayback
      ? { startSynchronizedRecordingPlayback }
      : {}),
    ...(playbackEngine.auditionRecordedTake
      ? { auditionRecordedTake, stopRecordedTakeAudition }
      : {}),
    ...(playbackEngine.markRecordingStart
      ? { markRecordingStart: () => playbackEngine.markRecordingStart!() }
      : {}),
    ...(playbackEngine.markRecordingStop
      ? {
        markRecordingStop: (start: RecordingStartMarker) =>
          playbackEngine.markRecordingStop!(start),
      }
      : {}),
    destroy,
  };
}
