import type { MusicalPosition, MusicalTimeline } from "../domain/types.js";
import {
  musicalPositionToTransportSeconds,
  normalizeMusicalTimeline,
  transportSecondsToMusicalPosition,
} from "../timeline/musical-timeline.js";

export type TransportPlaybackState =
  | "stopped"
  | "paused"
  | "playing"
  | "ended";

export type TransportSnapshot = {
  positionSeconds: number;
  musicalPosition: MusicalPosition;
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
  endAtClockTime: number;
  projectPositionSeconds: number;
  durationSeconds: number;
  loopEnabled: boolean;
};

/**
 * One exact observation of the GrooveShare project timeline against the
 * authoritative audio clock. Recording uses these markers to relate captured
 * audio to project time without introducing a second timing source.
 */
export type TransportTimelineMarker = {
  clockTimeSeconds: number;
  projectPositionSeconds: number;
  musicalPosition: MusicalPosition;
  playbackState: TransportPlaybackState;
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
  musicalTimeline?: MusicalTimeline;
};

export interface Transport {
  setDuration(durationSeconds: number): void;
  play(options?: TransportPlayOptions): PlaybackScheduleInstruction | null;
  createNextLoopInstruction(
    previousInstruction: PlaybackScheduleInstruction,
  ): PlaybackScheduleInstruction | null;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  seekBy(seconds: number): void;
  seekToMusicalPosition(position: MusicalPosition): void;
  setLoopEnabled(enabled: boolean): void;
  complete(): void;
  markTimelinePosition(): TransportTimelineMarker;
  getPosition(): number;
  getMusicalPosition(): MusicalPosition;
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
 * Timeline semantics for Version 3:
 * - Project time zero is both 0 seconds and Bar 1 / Beat 1.
 * - Musical position is derived from seconds through one project BPM/time-signature
 *   timeline rather than maintained as an independent clock.
 * - Project duration is supplied by the audio engine and represents the latest
 *   playable track end in the current mix.
 * - Earlier-ending sources do not shorten or stop the shared project timeline.
 * - While playing, elapsed time is derived exclusively from getClockTime().
 *   UI timers only request/observe snapshots and never advance the transport.
 * - With looping enabled, project position wraps on the same authoritative
 *   clock; the loop boundary is not advanced by a JavaScript callback.
 */
export function createTransport({
  getClockTime,
  scheduleInterval = scheduleDefaultInterval,
  clearScheduledInterval = clearDefaultInterval,
  snapshotIntervalMs = DEFAULT_SNAPSHOT_INTERVAL_MS,
  musicalTimeline,
}: TransportOptions): Transport {
  let durationSeconds = 0;
  let positionSeconds = 0;
  let playbackState: TransportPlaybackState = "stopped";
  let loopEnabled = false;
  let playbackStartClockTime = 0;
  let playbackStartPosition = 0;
  let intervalHandle: unknown = null;
  let destroyed = false;
  const normalizedMusicalTimeline = normalizeMusicalTimeline(musicalTimeline);
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

  function getRunningPositionAt(clockTime: number): number {
    const elapsedSeconds = Math.max(
      0,
      clockTime - playbackStartClockTime,
    );
    const rawPosition = playbackStartPosition + elapsedSeconds;

    if (!loopEnabled || durationSeconds <= 0) {
      return clampPosition(rawPosition);
    }

    if (rawPosition < durationSeconds) {
      return rawPosition;
    }

    return rawPosition % durationSeconds;
  }

  function syncNaturalCompletion(clockTime: number): void {
    if (
      playbackState !== "playing" ||
      loopEnabled ||
      durationSeconds <= 0
    ) {
      return;
    }

    const elapsedSeconds = Math.max(
      0,
      clockTime - playbackStartClockTime,
    );
    const rawPosition = playbackStartPosition + elapsedSeconds;

    if (rawPosition < durationSeconds) {
      return;
    }

    positionSeconds = durationSeconds;
    playbackStartPosition = durationSeconds;
    playbackStartClockTime = clockTime;
    playbackState = "ended";
    stopTicker();
  }

  function getPosition(): number {
    if (playbackState !== "playing") {
      return clampPosition(positionSeconds);
    }

    const clockTime = getClockTime();
    syncNaturalCompletion(clockTime);

    if (playbackState !== "playing") {
      return clampPosition(positionSeconds);
    }

    return getRunningPositionAt(clockTime);
  }

  function getMusicalPosition(): MusicalPosition {
    return transportSecondsToMusicalPosition(
      normalizedMusicalTimeline,
      getPosition(),
    );
  }

  function markTimelinePosition(): TransportTimelineMarker {
    const clockTimeSeconds = getClockTime();

    if (playbackState === "playing") {
      syncNaturalCompletion(clockTimeSeconds);
    }

    const projectPositionSeconds = playbackState === "playing"
      ? getRunningPositionAt(clockTimeSeconds)
      : clampPosition(positionSeconds);

    return {
      clockTimeSeconds,
      projectPositionSeconds,
      musicalPosition: transportSecondsToMusicalPosition(
        normalizedMusicalTimeline,
        projectPositionSeconds,
      ),
      playbackState,
    };
  }

  function getSnapshot(): TransportSnapshot {
    const currentPositionSeconds = getPosition();

    return {
      positionSeconds: currentPositionSeconds,
      musicalPosition: transportSecondsToMusicalPosition(
        normalizedMusicalTimeline,
        currentPositionSeconds,
      ),
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

  function rebasePlayingPosition(clockTime: number): number {
    const currentPosition = playbackState === "playing"
      ? getRunningPositionAt(clockTime)
      : clampPosition(positionSeconds);

    positionSeconds = currentPosition;
    playbackStartPosition = currentPosition;
    playbackStartClockTime = clockTime;

    return currentPosition;
  }

  function setDuration(nextDurationSeconds: number): void {
    if (destroyed) {
      return;
    }

    const clockTime = getClockTime();
    const wasPlaying = playbackState === "playing";
    const currentPosition = wasPlaying
      ? getRunningPositionAt(clockTime)
      : clampPosition(positionSeconds);

    durationSeconds = normalizeDuration(nextDurationSeconds);

    if (durationSeconds === 0) {
      positionSeconds = 0;
      playbackStartPosition = 0;
      playbackStartClockTime = clockTime;
      playbackState = "stopped";
      stopTicker();
      notify();
      return;
    }

    positionSeconds = Math.min(durationSeconds, currentPosition);
    playbackStartPosition = positionSeconds;
    playbackStartClockTime = clockTime;

    if (positionSeconds >= durationSeconds) {
      playbackState = "ended";
      stopTicker();
    } else if (wasPlaying) {
      playbackState = "playing";
      startTicker();
    }

    notify();
  }

  function createInstruction(
    startAtClockTime: number,
    projectPositionSeconds: number,
  ): PlaybackScheduleInstruction {
    const remainingDurationSeconds = Math.max(
      0,
      durationSeconds - projectPositionSeconds,
    );

    return {
      startAtClockTime,
      endAtClockTime: startAtClockTime + remainingDurationSeconds,
      projectPositionSeconds,
      durationSeconds,
      loopEnabled,
    };
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

    return createInstruction(startAtClockTime, playbackStartPosition);
  }

  function createNextLoopInstruction(
    previousInstruction: PlaybackScheduleInstruction,
  ): PlaybackScheduleInstruction | null {
    if (
      destroyed ||
      playbackState !== "playing" ||
      !loopEnabled ||
      durationSeconds <= 0
    ) {
      return null;
    }

    return createInstruction(previousInstruction.endAtClockTime, 0);
  }

  function pause(): void {
    if (destroyed || playbackState !== "playing") {
      return;
    }

    const clockTime = getClockTime();
    positionSeconds = getRunningPositionAt(clockTime);
    playbackStartPosition = positionSeconds;
    playbackStartClockTime = clockTime;
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

  function seekToMusicalPosition(position: MusicalPosition): void {
    seek(
      musicalPositionToTransportSeconds(
        normalizedMusicalTimeline,
        position,
      ),
    );
  }

  function setLoopEnabled(enabled: boolean): void {
    if (destroyed || loopEnabled === enabled) {
      return;
    }

    const clockTime = getClockTime();

    if (playbackState === "playing") {
      rebasePlayingPosition(clockTime);
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
    createNextLoopInstruction,
    pause,
    stop,
    seek,
    seekBy,
    seekToMusicalPosition,
    setLoopEnabled,
    complete,
    markTimelinePosition,
    getPosition,
    getMusicalPosition,
    getSnapshot,
    subscribe,
    destroy,
  };
}
