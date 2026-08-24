import type { MusicalPosition, MusicalTimeline } from "../domain/types.js";
import type { RecordingAlignmentDiagnosticsPort } from "../recording/recording-alignment-diagnostics.js";
import {
  normalizeMusicalTimeline,
  musicalPositionToTransportSeconds,
  transportSecondsToMusicalPosition,
} from "../timeline/musical-timeline.js";
import { getTrackTimelineOffsetSeconds } from "./recording-timeline.js";
import {
  getAlignedSourceOffsetSeconds,
  getTrackSourceAlignmentWindow,
} from "./track-source-alignment.js";
import type {
  PlaybackChannel,
  PlaybackEngine,
  PlaybackSnapshot,
  PlaybackStateListener,
} from "./playback-engine.js";
import {
  createTransport,
  type PlaybackScheduleInstruction,
} from "./transport.js";
import {
  createRecordingTimeline,
  type RecordingStartMarker,
} from "./recording-timeline.js";

type AudioBufferLike = {
  duration: number;
};

type GainParamLike = {
  value: number;
  setValueAtTime?: (value: number, startTime: number) => void;
};

type GainNodeLike = {
  gain: GainParamLike;
  connect: (destination: unknown) => unknown;
  disconnect?: () => void;
};

type AudioBufferSourceNodeLike = {
  buffer: AudioBufferLike | null;
  onended: (() => void) | null;
  connect: (destination: unknown) => unknown;
  disconnect?: () => void;
  start: (when?: number, offset?: number) => void;
  stop: (when?: number) => void;
};

type AudioOutputTimestampLike = {
  contextTime: number;
  performanceTime: number;
};

type AudioPlaybackStatsLike = {
  averageLatency?: number;
  minimumLatency?: number;
  maximumLatency?: number;
  totalDuration?: number;
  underrunDuration?: number;
  underrunEvents?: number;
};

type AudioContextLike = {
  currentTime: number;
  state: string;
  sampleRate?: number;
  sinkId?: string;
  baseLatency?: number;
  outputLatency?: number;
  playbackStats?: AudioPlaybackStatsLike;
  getOutputTimestamp?: () => AudioOutputTimestampLike;
  destination: unknown;
  createGain: () => GainNodeLike;
  createBufferSource: () => AudioBufferSourceNodeLike;
  decodeAudioData: (audioData: ArrayBuffer) => Promise<AudioBufferLike>;
  resume: () => Promise<void>;
  close?: () => Promise<void>;
};

type LoadedWebAudioChannel = {
  channel: PlaybackChannel;
  buffer: AudioBufferLike | null;
  gainNode: GainNodeLike | null;
};

type ActiveSource = {
  channelNumber: number;
  source: AudioBufferSourceNodeLike;
};

type ScheduledSourceGeneration = {
  instruction: PlaybackScheduleInstruction;
  sources: ActiveSource[];
  isLoopContinuation: boolean;
};

type ScheduleInterval = (
  handler: () => void,
  milliseconds: number,
) => unknown;

type ClearScheduledInterval = (handle: unknown) => void;

type WebAudioPlaybackEngineOptions = {
  audioContext?: AudioContextLike;
  fetchAudioData?: (audioUrl: string) => Promise<ArrayBuffer>;
  createFallbackEngine?: () => PlaybackEngine;
  scheduleInterval?: ScheduleInterval;
  clearScheduledInterval?: ClearScheduledInterval;
  onLoadError?: (error: unknown) => void;
  musicalTimeline?: MusicalTimeline;
  recordingAlignmentDiagnostics?: RecordingAlignmentDiagnosticsPort;
};

const END_EPSILON_SECONDS = 0.01;
const PLAYBACK_START_LEAD_SECONDS = 0.03;
const LOOP_SCHEDULE_LOOKAHEAD_SECONDS = 1;
const SNAPSHOT_INTERVAL_MS = 100;
const OUTPUT_CLOCK_SAMPLE_OFFSETS_SECONDS = [0.25, 1, 2, 4, 8, 12, 15] as const;

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return 1;
  }

  return Math.max(0, Math.min(1, volume));
}

function getBrowserAudioContext(): AudioContextLike | null {
  const browserGlobal = globalThis as typeof globalThis & {
    AudioContext?: new () => unknown;
    webkitAudioContext?: new () => unknown;
  };
  const AudioContextConstructor =
    browserGlobal.AudioContext ?? browserGlobal.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  return new AudioContextConstructor() as unknown as AudioContextLike;
}

async function fetchBrowserAudioData(audioUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(audioUrl, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(
      `Could not load audio (${response.status} ${response.statusText}).`,
    );
  }

  return response.arrayBuffer();
}

function scheduleBrowserInterval(
  handler: () => void,
  milliseconds: number,
): unknown {
  return globalThis.setInterval(handler, milliseconds);
}

function clearBrowserInterval(handle: unknown): void {
  globalThis.clearInterval(
    handle as ReturnType<typeof globalThis.setInterval>,
  );
}

export function createWebAudioPlaybackEngine(
  options: WebAudioPlaybackEngineOptions = {},
): PlaybackEngine {
  const resolvedAudioContext =
    options.audioContext ?? getBrowserAudioContext();

  if (!resolvedAudioContext) {
    if (options.createFallbackEngine) {
      return options.createFallbackEngine();
    }

    throw new Error("Web Audio is not supported in this environment.");
  }

  const audioContext: AudioContextLike = resolvedAudioContext;
  const fetchAudioData = options.fetchAudioData ?? fetchBrowserAudioData;
  const scheduleInterval =
    options.scheduleInterval ?? scheduleBrowserInterval;
  const clearScheduledInterval =
    options.clearScheduledInterval ?? clearBrowserInterval;
  const normalizedMusicalTimeline = normalizeMusicalTimeline(options.musicalTimeline);
  const recordingAlignmentDiagnostics = options.recordingAlignmentDiagnostics;
  const onLoadError = options.onLoadError ?? ((error: unknown) => {
    console.error("Could not prepare GrooveShare audio playback.", error);
  });

  let loadedChannels: LoadedWebAudioChannel[] = [];
  let sourceGenerations: ScheduledSourceGeneration[] = [];
  let lastScheduledLoopInstruction: PlaybackScheduleInstruction | null = null;
  const listeners = new Set<PlaybackStateListener>();
  let loadGeneration = 0;
  let loadingPromise: Promise<void> = Promise.resolve();
  let destroyed = false;
  let outputDiagnosticAttemptId: string | null = null;
  let outputDiagnosticReferenceContextTimeSeconds: number | null = null;
  let nextOutputClockSampleIndex = 0;
  const transport = createTransport({
    getClockTime: () => audioContext.currentTime,
    scheduleInterval,
    clearScheduledInterval,
    snapshotIntervalMs: SNAPSHOT_INTERVAL_MS,
    musicalTimeline: normalizedMusicalTimeline,
  });
  const recordingTimeline = createRecordingTimeline(transport);

  function hasReadyChannels(): boolean {
    return (
      loadedChannels.length > 0 &&
      loadedChannels.every(({ buffer, gainNode }) => {
        return buffer !== null && gainNode !== null;
      })
    );
  }

  function getMixDuration(): number {
    return loadedChannels.reduce((longestDuration, { channel, buffer }) => {
      const duration = buffer?.duration ?? 0;

      if (!Number.isFinite(duration) || duration <= 0) {
        return longestDuration;
      }

      const trackStartPosition = getTrackTimelineOffsetSeconds(
        channel,
        normalizedMusicalTimeline,
      );
      const alignmentWindow = getTrackSourceAlignmentWindow({
        trackStartSeconds: trackStartPosition,
        sourceDurationSeconds: duration,
        alignmentOffsetSeconds: channel.alignmentOffsetSeconds,
      });

      return Math.max(longestDuration, alignmentWindow.projectEndSeconds);
    }, 0);
  }

  function getSnapshot(): PlaybackSnapshot {
    const hasLoadedChannels = hasReadyChannels();
    const transportSnapshot = transport.getSnapshot();

    return {
      currentTime: hasLoadedChannels
        ? transportSnapshot.positionSeconds
        : 0,
      musicalPosition: transportSnapshot.musicalPosition,
      duration: hasLoadedChannels
        ? transportSnapshot.durationSeconds
        : 0,
      isPlaying:
        hasLoadedChannels &&
        transportSnapshot.playbackState === "playing",
      hasLoadedChannels,
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

  const unsubscribeTransport = transport.subscribe(() => {
    observePeriodicOutputClockSample();
    pruneCompletedSourceGenerations();
    maintainLoopSchedule();
    notify();
  });

  function finiteMilliseconds(value: number | undefined): number | null {
    return typeof value === "number" && Number.isFinite(value)
      ? value * 1000
      : null;
  }

  function getOutputClockDiagnosticDetail(
    targetContextTimeSeconds?: number,
  ): Record<string, string | number | boolean | null> {
    let outputTimestamp: AudioOutputTimestampLike | null = null;

    try {
      outputTimestamp = audioContext.getOutputTimestamp?.() ?? null;
    } catch {
      outputTimestamp = null;
    }

    const timestampContextTime =
      outputTimestamp && Number.isFinite(outputTimestamp.contextTime)
        ? outputTimestamp.contextTime
        : null;
    const timestampPerformanceTime =
      outputTimestamp && Number.isFinite(outputTimestamp.performanceTime)
        ? outputTimestamp.performanceTime
        : null;
    const estimatedScheduledOutputPerformanceTimeMilliseconds =
      targetContextTimeSeconds !== undefined &&
      timestampContextTime !== null &&
      timestampPerformanceTime !== null
        ? timestampPerformanceTime +
          (targetContextTimeSeconds - timestampContextTime) * 1000
        : null;
    const playbackStats = audioContext.playbackStats;

    return {
      outputTimestampSupported: Boolean(audioContext.getOutputTimestamp),
      outputTimestampContextTimeSeconds: timestampContextTime,
      outputTimestampPerformanceTimeMilliseconds: timestampPerformanceTime,
      outputTimestampCurrentTimeGapMilliseconds:
        timestampContextTime !== null
          ? (audioContext.currentTime - timestampContextTime) * 1000
          : null,
      estimatedScheduledOutputPerformanceTimeMilliseconds,
      audioContextBaseLatencyMilliseconds: finiteMilliseconds(
        audioContext.baseLatency,
      ),
      audioContextOutputLatencyMilliseconds: finiteMilliseconds(
        audioContext.outputLatency,
      ),
      audioPlaybackStatsSupported: Boolean(playbackStats),
      audioPlaybackAverageLatencyMilliseconds: finiteMilliseconds(
        playbackStats?.averageLatency,
      ),
      audioPlaybackMinimumLatencyMilliseconds: finiteMilliseconds(
        playbackStats?.minimumLatency,
      ),
      audioPlaybackMaximumLatencyMilliseconds: finiteMilliseconds(
        playbackStats?.maximumLatency,
      ),
      audioPlaybackTotalDurationMilliseconds: finiteMilliseconds(
        playbackStats?.totalDuration,
      ),
      audioPlaybackUnderrunDurationMilliseconds: finiteMilliseconds(
        playbackStats?.underrunDuration,
      ),
      audioPlaybackUnderrunEvents:
        typeof playbackStats?.underrunEvents === "number"
          ? playbackStats.underrunEvents
          : null,
      audioContextState: audioContext.state,
      audioContextSampleRate:
        typeof audioContext.sampleRate === "number" ? audioContext.sampleRate : null,
      audioContextSinkId:
        typeof audioContext.sinkId === "string" ? audioContext.sinkId : null,
    };
  }

  function resetOutputClockSamplingForAttempt(
    attemptId: string,
    referenceContextTimeSeconds: number,
  ): void {
    outputDiagnosticAttemptId = attemptId;
    outputDiagnosticReferenceContextTimeSeconds = referenceContextTimeSeconds;
    nextOutputClockSampleIndex = 0;
  }

  function observePeriodicOutputClockSample(): void {
    const attemptId = recordingAlignmentDiagnostics?.getActiveAttemptId() ?? null;

    if (!attemptId) {
      outputDiagnosticAttemptId = null;
      outputDiagnosticReferenceContextTimeSeconds = null;
      nextOutputClockSampleIndex = 0;
      return;
    }

    if (outputDiagnosticAttemptId !== attemptId) {
      resetOutputClockSamplingForAttempt(attemptId, audioContext.currentTime);
    }

    const referenceContextTimeSeconds = outputDiagnosticReferenceContextTimeSeconds;
    const sampleOffsetSeconds =
      OUTPUT_CLOCK_SAMPLE_OFFSETS_SECONDS[nextOutputClockSampleIndex];
    const transportSnapshot = transport.getSnapshot();

    if (
      referenceContextTimeSeconds === null ||
      sampleOffsetSeconds === undefined ||
      transportSnapshot.playbackState !== "playing" ||
      audioContext.currentTime - referenceContextTimeSeconds < sampleOffsetSeconds
    ) {
      return;
    }

    nextOutputClockSampleIndex += 1;
    recordingAlignmentDiagnostics?.observe({
      stage: "project-output-clock-sample",
      source: "playback-engine",
      audioContextTimeSeconds: audioContext.currentTime,
      projectPositionSeconds: transportSnapshot.positionSeconds,
      musicalPosition: transportSnapshot.musicalPosition,
      playbackState: transportSnapshot.playbackState,
      detail: {
        sampleOffsetFromPlaybackStartMilliseconds: sampleOffsetSeconds * 1000,
        ...getOutputClockDiagnosticDetail(),
      },
    });
  }

  function setGainValue(
    gainNode: GainNodeLike,
    channel: PlaybackChannel,
  ): void {
    const value = channel.enabled ? clampVolume(channel.volume) : 0;

    if (gainNode.gain.setValueAtTime) {
      gainNode.gain.setValueAtTime(value, audioContext.currentTime);
      return;
    }

    gainNode.gain.value = value;
  }

  function safeStopSource(source: AudioBufferSourceNodeLike): void {
    source.onended = null;

    try {
      source.stop();
    } catch {
      // A source may already have ended naturally. Nothing remains to stop.
    }

    source.disconnect?.();
  }

  function releaseSource(source: AudioBufferSourceNodeLike): void {
    source.onended = null;
    source.disconnect?.();
  }

  function clearActiveSources(): void {
    for (const generation of sourceGenerations) {
      for (const { source } of generation.sources) {
        safeStopSource(source);
      }
    }

    sourceGenerations = [];
    lastScheduledLoopInstruction = null;
  }

  function pruneCompletedSourceGenerations(): void {
    if (sourceGenerations.length === 0) {
      return;
    }

    const clockTime = audioContext.currentTime;
    const remainingGenerations: ScheduledSourceGeneration[] = [];

    for (const generation of sourceGenerations) {
      if (generation.instruction.endAtClockTime <= clockTime) {
        for (const { source } of generation.sources) {
          releaseSource(source);
        }
        continue;
      }

      remainingGenerations.push(generation);
    }

    sourceGenerations = remainingGenerations;
  }

  function disconnectLoadedChannels(): void {
    for (const { gainNode } of loadedChannels) {
      gainNode?.disconnect?.();
    }
  }

  function startSources(
    instruction: PlaybackScheduleInstruction,
    isLoopContinuation = false,
  ): ScheduledSourceGeneration | null {
    if (!hasReadyChannels()) {
      return null;
    }

    const playbackPosition = instruction.projectPositionSeconds;
    const instructionEndPosition = playbackPosition + instruction.durationSeconds;
    const sources: ActiveSource[] = [];

    for (const loadedChannel of loadedChannels) {
      const buffer = loadedChannel.buffer;
      const gainNode = loadedChannel.gainNode;
      const trackStartPosition = getTrackTimelineOffsetSeconds(
        loadedChannel.channel,
        normalizedMusicalTimeline,
      );

      if (!buffer || !gainNode) {
        continue;
      }

      const alignmentWindow = getTrackSourceAlignmentWindow({
        trackStartSeconds: trackStartPosition,
        sourceDurationSeconds: buffer.duration,
        alignmentOffsetSeconds: loadedChannel.channel.alignmentOffsetSeconds,
      });
      const sourceProjectStart = Math.max(
        playbackPosition,
        alignmentWindow.projectStartSeconds,
      );
      const sourceOffset = getAlignedSourceOffsetSeconds({
        projectTimeSeconds: sourceProjectStart,
        trackStartSeconds: trackStartPosition,
        alignmentOffsetSeconds: loadedChannel.channel.alignmentOffsetSeconds,
      });

      if (
        sourceProjectStart >= instructionEndPosition - END_EPSILON_SECONDS ||
        sourceProjectStart >= alignmentWindow.projectEndSeconds - END_EPSILON_SECONDS ||
        sourceOffset >= buffer.duration - END_EPSILON_SECONDS
      ) {
        continue;
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      source.start(
        instruction.startAtClockTime + (sourceProjectStart - playbackPosition),
        sourceOffset,
      );
      sources.push({
        channelNumber: loadedChannel.channel.channelNumber,
        source,
      });
    }

    if (sources.length === 0) {
      return null;
    }

    const generation = {
      instruction,
      sources,
      isLoopContinuation,
    };
    sourceGenerations.push(generation);

    return generation;
  }

  function getCurrentOrUpcomingInstruction(): PlaybackScheduleInstruction | null {
    const clockTime = audioContext.currentTime;
    const currentGeneration = sourceGenerations.find((generation) => {
      return (
        generation.instruction.startAtClockTime <= clockTime &&
        generation.instruction.endAtClockTime > clockTime
      );
    });

    if (currentGeneration) {
      return currentGeneration.instruction;
    }

    const upcomingGeneration = sourceGenerations.find((generation) => {
      return generation.instruction.startAtClockTime > clockTime;
    });

    return upcomingGeneration?.instruction ?? null;
  }

  function cancelFutureLoopGenerations(): void {
    const clockTime = audioContext.currentTime;
    const remainingGenerations: ScheduledSourceGeneration[] = [];

    for (const generation of sourceGenerations) {
      if (
        generation.isLoopContinuation &&
        generation.instruction.startAtClockTime > clockTime
      ) {
        for (const { source } of generation.sources) {
          safeStopSource(source);
        }
        continue;
      }

      remainingGenerations.push(generation);
    }

    sourceGenerations = remainingGenerations;
  }

  function maintainLoopSchedule(force = false): void {
    const transportSnapshot = transport.getSnapshot();

    if (
      destroyed ||
      transportSnapshot.playbackState !== "playing" ||
      !transportSnapshot.loopEnabled ||
      !lastScheduledLoopInstruction
    ) {
      return;
    }

    const shouldScheduleNext =
      force ||
      audioContext.currentTime >=
        lastScheduledLoopInstruction.startAtClockTime -
          LOOP_SCHEDULE_LOOKAHEAD_SECONDS;

    if (!shouldScheduleNext) {
      return;
    }

    const nextInstruction = transport.createNextLoopInstruction(
      lastScheduledLoopInstruction,
    );

    if (!nextInstruction) {
      return;
    }

    const generation = startSources(nextInstruction, true);

    if (generation) {
      lastScheduledLoopInstruction = nextInstruction;
    }
  }

  function scheduleAndStartSources(
    leadTimeSeconds: number,
  ): PlaybackScheduleInstruction | null {
    if (!hasReadyChannels()) {
      return null;
    }

    const instruction = transport.play({ leadTimeSeconds });

    if (!instruction) {
      return null;
    }

    const activeDiagnosticAttemptId =
      recordingAlignmentDiagnostics?.getActiveAttemptId() ?? null;
    if (activeDiagnosticAttemptId) {
      resetOutputClockSamplingForAttempt(
        activeDiagnosticAttemptId,
        instruction.startAtClockTime,
      );
    }

    recordingAlignmentDiagnostics?.observe({
      stage: "project-playback-scheduled",
      source: "playback-engine",
      audioContextTimeSeconds: audioContext.currentTime,
      scheduledAudioContextTimeSeconds: instruction.startAtClockTime,
      projectPositionSeconds: instruction.projectPositionSeconds,
      musicalPosition: transportSecondsToMusicalPosition(
        normalizedMusicalTimeline,
        instruction.projectPositionSeconds,
      ),
      playbackState: transport.getSnapshot().playbackState,
      detail: {
        schedulingLeadMilliseconds:
          (instruction.startAtClockTime - audioContext.currentTime) * 1000,
        ...getOutputClockDiagnosticDetail(instruction.startAtClockTime),
      },
    });

    const generation = startSources(instruction);

    if (!generation) {
      transport.complete();
      return null;
    }

    lastScheduledLoopInstruction = instruction;

    if (instruction.loopEnabled) {
      maintainLoopSchedule(true);
    }

    return instruction;
  }

  async function play(): Promise<void> {
    if (destroyed) {
      return;
    }

    await loadingPromise;

    if (
      !hasReadyChannels() ||
      transport.getSnapshot().playbackState === "playing"
    ) {
      return;
    }

    if (audioContext.state !== "running") {
      await audioContext.resume();
    }

    scheduleAndStartSources(PLAYBACK_START_LEAD_SECONDS);
  }

  async function startSynchronizedRecordingPlayback(): Promise<RecordingStartMarker> {
    if (destroyed) {
      throw new Error("Playback engine has been destroyed.");
    }

    await loadingPromise;

    if (!hasReadyChannels()) {
      throw new Error(
        "Load at least one project track before starting synchronized recording.",
      );
    }

    if (transport.getSnapshot().playbackState === "playing") {
      return recordingTimeline.markStart();
    }

    if (audioContext.state !== "running") {
      await audioContext.resume();
    }

    // Recording capture is already active before this method is called. A zero
    // scheduling lead avoids adding GrooveShare's normal 30 ms playback lead
    // to the recorded source as artificial pre-roll.
    const instruction = scheduleAndStartSources(0);

    if (!instruction) {
      throw new Error("Project playback could not start for synchronized recording.");
    }

    return {
      kind: "recording-start",
      projectPositionSeconds: instruction.projectPositionSeconds,
      musicalPosition: transportSecondsToMusicalPosition(
        normalizedMusicalTimeline,
        instruction.projectPositionSeconds,
      ),
      audioContextTimeSeconds: instruction.startAtClockTime,
      playbackState: "playing",
    };
  }

  function pause(): void {
    if (transport.getSnapshot().playbackState !== "playing") {
      return;
    }

    transport.pause();
    clearActiveSources();
  }

  function stop(): void {
    transport.stop();
    clearActiveSources();
  }

  function seek(seconds: number): void {
    if (
      destroyed ||
      !hasReadyChannels() ||
      !Number.isFinite(seconds)
    ) {
      return;
    }

    const transportSnapshot = transport.getSnapshot();
    const duration = transportSnapshot.durationSeconds;
    const nextPosition = Math.max(
      0,
      Math.min(duration, seconds),
    );
    const shouldResume =
      transportSnapshot.playbackState === "playing" &&
      nextPosition < duration;

    if (transportSnapshot.playbackState === "playing") {
      transport.pause();
    }

    clearActiveSources();
    transport.seek(nextPosition);

    if (shouldResume) {
      scheduleAndStartSources(PLAYBACK_START_LEAD_SECONDS);
    }
  }

  function seekBy(seconds: number): void {
    if (!Number.isFinite(seconds)) {
      return;
    }

    seek(transport.getPosition() + seconds);
  }

  function seekToMusicalPosition(position: MusicalPosition): void {
    seek(
      musicalPositionToTransportSeconds(
        normalizedMusicalTimeline,
        position,
      ),
    );
  }

  function getChannel(channelNumber: number): LoadedWebAudioChannel | null {
    return loadedChannels.find(({ channel }) => {
      return channel.channelNumber === channelNumber;
    }) ?? null;
  }

  function setChannelVolume(channelNumber: number, volume: number): boolean {
    const loadedChannel = getChannel(channelNumber);

    if (!loadedChannel) {
      return false;
    }

    loadedChannel.channel.volume = clampVolume(volume);

    if (loadedChannel.gainNode) {
      setGainValue(loadedChannel.gainNode, loadedChannel.channel);
    }

    return true;
  }

  function setChannelEnabled(channelNumber: number, enabled: boolean): boolean {
    const loadedChannel = getChannel(channelNumber);

    if (!loadedChannel) {
      return false;
    }

    loadedChannel.channel.enabled = enabled;

    if (loadedChannel.gainNode) {
      setGainValue(loadedChannel.gainNode, loadedChannel.channel);
    }

    return true;
  }

  function loadMix(channels: PlaybackChannel[]): void {
    if (destroyed) {
      return;
    }

    const generation = loadGeneration + 1;
    loadGeneration = generation;

    clearActiveSources();
    disconnectLoadedChannels();
    loadedChannels = channels.map((channel) => ({
      channel: {
        ...channel,
        volume: clampVolume(channel.volume),
      },
      buffer: null,
      gainNode: null,
    }));
    transport.stop();
    transport.setDuration(0);

    if (loadedChannels.length === 0) {
      loadingPromise = Promise.resolve();
      return;
    }

    const channelsForGeneration = loadedChannels;

    loadingPromise = Promise.all(
      channelsForGeneration.map(async (loadedChannel) => {
        const audioData = await fetchAudioData(
          loadedChannel.channel.audioUrl,
        );
        const buffer = await audioContext.decodeAudioData(audioData);

        return {
          loadedChannel,
          buffer,
        };
      }),
    )
      .then((decodedChannels) => {
        if (destroyed || generation !== loadGeneration) {
          return;
        }

        for (const { loadedChannel, buffer } of decodedChannels) {
          const gainNode = audioContext.createGain();
          loadedChannel.buffer = buffer;
          loadedChannel.gainNode = gainNode;
          setGainValue(gainNode, loadedChannel.channel);
          gainNode.connect(audioContext.destination);
        }

        transport.setDuration(getMixDuration());
      })
      .catch((error: unknown) => {
        if (destroyed || generation !== loadGeneration) {
          return;
        }

        disconnectLoadedChannels();
        loadedChannels = [];
        transport.setDuration(0);
        onLoadError(error);
      });
  }

  function destroy(): void {
    if (destroyed) {
      return;
    }

    loadGeneration += 1;
    clearActiveSources();
    disconnectLoadedChannels();
    loadedChannels = [];
    unsubscribeTransport();
    transport.destroy();
    listeners.clear();
    destroyed = true;
    void audioContext.close?.();
  }

  return {
    loadMix,
    play,
    startSynchronizedRecordingPlayback,
    pause,
    stop,
    seek,
    seekBy,
    seekToMusicalPosition,
    setLoopEnabled(enabled) {
      const transportSnapshot = transport.getSnapshot();

      if (transportSnapshot.loopEnabled === enabled) {
        return;
      }

      transport.setLoopEnabled(enabled);

      if (transportSnapshot.playbackState !== "playing") {
        return;
      }

      if (!enabled) {
        cancelFutureLoopGenerations();
        lastScheduledLoopInstruction = null;
        return;
      }

      lastScheduledLoopInstruction = getCurrentOrUpcomingInstruction();
      maintainLoopSchedule(true);
    },
    setChannelVolume,
    setChannelEnabled,
    getSnapshot,
    markRecordingStart() {
      return recordingTimeline.markStart();
    },
    markRecordingStop(start) {
      return recordingTimeline.markStop(start);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(getSnapshot());

      return () => {
        listeners.delete(listener);
      };
    },
    destroy,
  };
}
