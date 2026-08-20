export type TransportPlaybackState =
  | "stopped"
  | "paused"
  | "playing"
  | "ended";

export type TransportSnapshot = {
  positionSeconds: number;
  durationSeconds: number;
  playbackState: TransportPlaybackState;
  loopEnabled: boolean;
};

export type TransportPlayOptions = {
  /**
   * Small scheduling lead used by an audio engine to give Web Audio source
   * nodes time to be created before playback begins. The Transport converts
   * this relative lead into one absolute clock start time for every source.
   */
  leadTimeSeconds?: number;
};

export type PlaybackScheduleInstruction = {
  startAtClockTime: number;
  projectPositionSeconds: number;
  durationSeconds: number;
  loopEnabled: boolean;
};

export type TransportStateListener = (
  snapshot: TransportSnapshot,
) => void;

export type ScheduleTransportInterval = (
  handler: () => void,
  milliseconds: number,
) => unknown;

export type ClearTransportInterval = (handle: unknown) => void;

export type TransportOptions = {
  /**
   * Returns the authoritative audio clock in seconds. Web Audio callers should
   * provide AudioContext.currentTime here.
   */
  getClockTime: () => number;
  scheduleInterval?: ScheduleTransportInterval;
  clearScheduledInterval?: ClearTransportInterval;
  snapshotIntervalMs?: number;
};

export interface Transport {
  setDuration(durationSeconds: number): void;
  play(options?: TransportPlayOptions): PlaybackScheduleInstruction | null;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  seekBy(seconds: number): void;
  setLoopEnabled(enabled: boolean): void;
  complete(): void;
  getPosition(): number;
  getSnapshot(): TransportSnapshot;
  subscribe(listener: TransportStateListener): () => void;
  destroy(): void;
}

const DEFAULT_SNAPSHOT_INTERVAL_MS = 100;
const PLAYBACK_END_EPSILON_SECONDS = 0.01;

function scheduleDefaultInterval(
  handler: () => void,
  milliseconds: number,
): unknown {
  return globalThis.setInterval(handler, milliseconds);
}

function clearDefaultInterval(handle: unknown): void {
  globalThis.clearInterval(
    handle as ReturnType<typeof globalThis.setInterval>,
  );
}

function normalizeDuration(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }

  return durationSeconds;
}

function normalizeLeadTime(leadTimeSeconds: number | undefined): number {
  if (!Number.isFinite(leadTimeSeconds) || (leadTimeSeconds ?? 0) <= 0) {
    return 0;
  }

  return leadTimeSeconds ?? 0;
}

/**
 * Shared GrooveShare project transport.
 *
 * Timeline semantics for Version 3 Milestone 1:
 * - Project time zero is 0 seconds.
 * - Project duration is supplied by the audio engine and represents the
 *   longest playable source in the current mix.
 * - Shorter sources may end before the transport; they do not shorten or stop
 *   the shared project timeline.
 * - While playing, elapsed time is derived exclusively from getClockTime().
 *   UI timers only request/observe snapshots and never advance the transport.
 */
export function createTransport({
  getClockTime,
  scheduleInterval = scheduleDefaultInterval,
  clearScheduledInterval = clearDefaultInterval,
  snapshotIntervalMs = DEFAULT_SNAPSHOT_INTERVAL_MS,
}: TransportOptions): Transport {
  let durationSeconds = 0;
  let positionSeconds = 0;
  let playbackState: TransportPlaybackState = "stopped";
  let loopEnabled = false;
  let playbackStartClockTime = 0;
  let playbackStartPosition = 0;
  let intervalHandle: unknown = null;
  let destroyed = false;
  const listeners = new Set<TransportStateListener>();

  function clampPosition(seconds: number): number {
    if (!Number.isFinite(seconds)) {
      return positionSeconds;
    }

    const nonNegativeSeconds = Math.max(0, seconds);

    return durationSeconds > 0
      ? Math.min(durationSeconds, nonNegativeSeconds)
      : 0;
  }

  function getPosition(): number {
    if (playbackState !== "playing") {
      return clampPosition(positionSeconds);
    }

    const elapsedSeconds = Math.max(
      0,
      getClockTime() - playbackStartClockTime,
    );

    return clampPosition(playbackStartPosition + elapsedSeconds);
  }

  function getSnapshot(): TransportSnapshot {
    return {
      positionSeconds: getPosition(),
      durationSeconds,
      playbackState,
      loopEnabled,
    };
  }

  function notify(): void {
    if (destroyed) {
      return;
    }

    const snapshot = getSnapshot();

    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function stopTicker(): void {
    if (intervalHandle === null) {
      return;
    }

    clearScheduledInterval(intervalHandle);
    intervalHandle = null;
  }

  function startTicker(): void {
    if (
      intervalHandle !== null ||
      listeners.size === 0 ||
      playbackState !== "playing"
    ) {
      return;
    }

    intervalHandle = scheduleInterval(notify, snapshotIntervalMs);
  }

  function setDuration(nextDurationSeconds: number): void {
    if (destroyed) {
      return;
    }

    durationSeconds = normalizeDuration(nextDurationSeconds);

    if (durationSeconds === 0) {
      positionSeconds = 0;
      playbackStartPosition = 0;
      playbackStartClockTime = getClockTime();
      playbackState = "stopped";
      stopTicker();
      notify();
      return;
    }

    const currentPosition = getPosition();
    positionSeconds = Math.min(durationSeconds, currentPosition);
    playbackStartPosition = positionSeconds;
    playbackStartClockTime = getClockTime();

    if (positionSeconds >= durationSeconds) {
      playbackState = "ended";
      stopTicker();
    }

    notify();
  }

  function play(
    options: TransportPlayOptions = {},
  ): PlaybackScheduleInstruction | null {
    if (destroyed || durationSeconds <= 0 || playbackState === "playing") {
      return null;
    }

    if (
      positionSeconds >=
      Math.max(0, durationSeconds - PLAYBACK_END_EPSILON_SECONDS)
    ) {
      positionSeconds = 0;
    }

    const leadTimeSeconds = normalizeLeadTime(options.leadTimeSeconds);
    const startAtClockTime = getClockTime() + leadTimeSeconds;

    playbackStartPosition = positionSeconds;
    playbackStartClockTime = startAtClockTime;
    playbackState = "playing";
    startTicker();
    notify();

    return {
      startAtClockTime,
      projectPositionSeconds: playbackStartPosition,
      durationSeconds,
      loopEnabled,
    };
  }

  function pause(): void {
    if (destroyed || playbackState !== "playing") {
      return;
    }

    positionSeconds = getPosition();
    playbackStartPosition = positionSeconds;
    playbackStartClockTime = getClockTime();
    playbackState = positionSeconds >= durationSeconds && durationSeconds > 0
      ? "ended"
      : "paused";
    stopTicker();
    notify();
  }

  function stop(): void {
    if (destroyed) {
      return;
    }

    positionSeconds = 0;
    playbackStartPosition = 0;
    playbackStartClockTime = getClockTime();
    playbackState = "stopped";
    stopTicker();
    notify();
  }

  function seek(seconds: number): void {
    if (destroyed || !Number.isFinite(seconds)) {
      return;
    }

    const wasPlaying = playbackState === "playing";
    const nextPosition = clampPosition(seconds);
    positionSeconds = nextPosition;
    playbackStartPosition = nextPosition;
    playbackStartClockTime = getClockTime();

    if (nextPosition >= durationSeconds && durationSeconds > 0) {
      playbackState = "ended";
      stopTicker();
    } else if (wasPlaying) {
      playbackState = "playing";
      startTicker();
    } else if (playbackState === "ended") {
      playbackState = nextPosition === 0 ? "stopped" : "paused";
    }

    notify();
  }

  function seekBy(seconds: number): void {
    if (!Number.isFinite(seconds)) {
      return;
    }

    seek(getPosition() + seconds);
  }

  function setLoopEnabled(enabled: boolean): void {
    if (destroyed || loopEnabled === enabled) {
      return;
    }

    loopEnabled = enabled;
    notify();
  }

  function complete(): void {
    if (destroyed) {
      return;
    }

    positionSeconds = durationSeconds;
    playbackStartPosition = durationSeconds;
    playbackStartClockTime = getClockTime();
    playbackState = durationSeconds > 0 ? "ended" : "stopped";
    stopTicker();
    notify();
  }

  function subscribe(listener: TransportStateListener): () => void {
    if (destroyed) {
      listener(getSnapshot());
      return () => {};
    }

    listeners.add(listener);
    listener(getSnapshot());
    startTicker();

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        stopTicker();
      }
    };
  }

  function destroy(): void {
    if (destroyed) {
      return;
    }

    stopTicker();
    listeners.clear();
    destroyed = true;
  }

  return {
    setDuration,
    play,
    pause,
    stop,
    seek,
    seekBy,
    setLoopEnabled,
    complete,
    getPosition,
    getSnapshot,
    subscribe,
    destroy,
  };
}
