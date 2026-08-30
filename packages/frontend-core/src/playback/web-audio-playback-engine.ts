import type { MusicalPosition, MusicalTimeline } from "../domain/types.js";
import type { RecordingAlignmentDiagnosticsPort } from "../recording/recording-alignment-diagnostics.js";
import {
  normalizeMusicalTimeline,
  getSecondsPerMusicalBeat,
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
  PlaybackChannelPreparationStatus,
  PlaybackEngine,
  PlaybackPreparationSnapshot,
  PlaybackSnapshot,
  PlaybackStateListener,
  RecordedTakeAuditionOptions,
  SynchronizedRecordingPlaybackStart,
  SynchronizedRecordingPlaybackSnapshot,
} from "./playback-engine.js";
import {
  createTransport,
  type PlaybackScheduleInstruction,
} from "./transport.js";
import { createRecordingTimeline } from "./recording-timeline.js";

type AudioBufferLike = {
  duration: number;
};

type GainParamLike = {
  value: number;
  setValueAtTime?: (value: number, startTime: number) => void;
  linearRampToValueAtTime?: (value: number, endTime: number) => void;
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


type OscillatorNodeLike = {
  type: string;
  frequency: { value: number };
  connect: (destination: unknown) => unknown;
  disconnect?: () => void;
  start: (when?: number) => void;
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
  createOscillator?: () => OscillatorNodeLike;
  createBufferSource: () => AudioBufferSourceNodeLike;
  decodeAudioData: (audioData: ArrayBuffer) => Promise<AudioBufferLike>;
  resume: () => Promise<void>;
  close?: () => Promise<void>;
};

type LoadedWebAudioChannel = {
  channel: PlaybackChannel;
  buffer: AudioBufferLike | null;
  gainNode: GainNodeLike | null;
  preparationStatus: PlaybackChannelPreparationStatus;
  failureMessage: string | null;
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
const METRONOME_LOOKAHEAD_SECONDS = 1;
const METRONOME_CLICK_DURATION_SECONDS = 0.04;
const METRONOME_REGULAR_FREQUENCY_HZ = 880;
const METRONOME_DOWNBEAT_FREQUENCY_HZ = 1760;
const METRONOME_REGULAR_GAIN = 0.12;
const METRONOME_DOWNBEAT_GAIN = 0.2;
const RECORDING_COUNT_IN_START_LEAD_SECONDS = 0.03;
const DEFAULT_RECORDING_COUNT_IN_BARS = 1;
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
  let metronomeEnabled = false;
  let activeMetronomeClicks: Array<{
    oscillator: OscillatorNodeLike;
    gainNode: GainNodeLike;
    startAtClockTime: number;
    stopAtClockTime: number;
    kind: "metronome" | "count-in";
  }> = [];
  let lastScheduledMetronomeClockTime: number | null = null;
  const listeners = new Set<PlaybackStateListener>();
  let loadGeneration = 0;
  let backgroundPreparationGeneration: number | null = null;
  let pendingSeekSeconds: number | null = null;
  let destroyed = false;
  let activeRecordedTakeAudition: {
    source: AudioBufferSourceNodeLike;
    gainNode: GainNodeLike;
    generation: number;
  } | null = null;
  let recordedTakeAuditionGeneration = 0;
  let recordedTakeAuditionVolume = 1;
  let synchronizedRecordingSchedule: {
    countInBars: number;
    countInBeats: number;
    countInDurationSeconds: number;
    countInStartAtClockTime: number;
    projectStartAtClockTime: number;
    secondsPerBeat: number;
  } | null = null;
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

  function getPreparationSnapshot(): PlaybackPreparationSnapshot {
    const channels = loadedChannels.map((loadedChannel) => ({
      channelNumber: loadedChannel.channel.channelNumber,
      trackId: loadedChannel.channel.trackId,
      required: loadedChannel.channel.enabled,
      status: loadedChannel.preparationStatus,
      failureMessage: loadedChannel.failureMessage,
    }));
    const requiredChannels = channels.filter(({ required }) => required);
    const failedRequiredChannel = requiredChannels.find(({ status }) => {
      return status === "failed";
    });
    const readyRequiredChannelCount = requiredChannels.filter(({ status }) => {
      return status === "ready";
    }).length;
    const status = requiredChannels.length === 0
      ? "idle"
      : failedRequiredChannel
        ? "failed"
        : readyRequiredChannelCount === requiredChannels.length
          ? "ready"
          : "preparing";

    return {
      status,
      requiredChannelCount: requiredChannels.length,
      readyRequiredChannelCount,
      channels,
      failure: failedRequiredChannel
        ? {
            channelNumber: failedRequiredChannel.channelNumber,
            trackId: failedRequiredChannel.trackId,
            message:
              failedRequiredChannel.failureMessage ??
              "This track could not be prepared for playback.",
          }
        : null,
    };
  }

  function hasReadyChannels(): boolean {
    const preparation = getPreparationSnapshot();
    return preparation.status === "ready" && preparation.requiredChannelCount > 0;
  }

  function getSynchronizedRecordingPlaybackSnapshot(): SynchronizedRecordingPlaybackSnapshot | null {
    const schedule = synchronizedRecordingSchedule;
    if (!schedule) {
      return null;
    }

    const clockTime = audioContext.currentTime;
    const countInElapsedSeconds = Math.max(
      0,
      clockTime - schedule.countInStartAtClockTime,
    );
    const currentBeat = schedule.countInBeats > 0
      ? Math.min(
          schedule.countInBeats,
          Math.floor(countInElapsedSeconds / schedule.secondsPerBeat) + 1,
        )
      : 0;

    return {
      phase: clockTime < schedule.projectStartAtClockTime
        ? "count-in"
        : "recording",
      countIn: {
        bars: schedule.countInBars,
        totalBeats: schedule.countInBeats,
        currentBeat,
        durationSeconds: schedule.countInDurationSeconds,
      },
      elapsedRecordingSeconds: Math.max(
        0,
        clockTime - schedule.projectStartAtClockTime,
      ),
    };
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
        mediaLeadInSeconds: channel.mediaLeadInSeconds,
      });

      return Math.max(longestDuration, alignmentWindow.projectEndSeconds);
    }, 0);
  }

  function getSnapshot(): PlaybackSnapshot {
    const hasLoadedChannels = hasReadyChannels();
    const preparation = getPreparationSnapshot();
    const transportSnapshot = transport.getSnapshot();
    const hasPreparedTimeline = transportSnapshot.durationSeconds > 0;

    return {
      currentTime: hasPreparedTimeline
        ? transportSnapshot.positionSeconds
        : 0,
      musicalPosition: transportSnapshot.musicalPosition,
      duration: hasPreparedTimeline
        ? transportSnapshot.durationSeconds
        : 0,
      isPlaying:
        transportSnapshot.playbackState === "playing",
      hasLoadedChannels,
      preparation,
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

  function pruneCompletedMetronomeClicks(): void {
    const now = audioContext.currentTime;
    activeMetronomeClicks = activeMetronomeClicks.filter((click) => {
      if (click.stopAtClockTime > now) {
        return true;
      }
      click.oscillator.disconnect?.();
      click.gainNode.disconnect?.();
      return false;
    });
  }

  function clearClickCues(kind?: "metronome" | "count-in"): void {
    const now = audioContext.currentTime;
    const remaining: typeof activeMetronomeClicks = [];

    for (const click of activeMetronomeClicks) {
      if (kind && click.kind !== kind) {
        remaining.push(click);
        continue;
      }

      if (click.stopAtClockTime > now) {
        try {
          click.oscillator.stop(now);
        } catch {
          // The oscillator may already have completed.
        }
      }
      click.oscillator.disconnect?.();
      click.gainNode.disconnect?.();
    }

    activeMetronomeClicks = remaining;
    if (!kind || kind === "metronome") {
      lastScheduledMetronomeClockTime = null;
    }
  }

  function clearMetronomeClicks(): void {
    clearClickCues("metronome");
  }

  function clearAllClickCues(): void {
    clearClickCues();
  }

  function scheduleMetronomeClick(
    startAtClockTime: number,
    isDownbeat: boolean,
    kind: "metronome" | "count-in" = "metronome",
  ): boolean {
    const createOscillator = audioContext.createOscillator;
    if (!createOscillator) {
      return false;
    }

    const oscillator = createOscillator.call(audioContext);
    const gainNode = audioContext.createGain();
    const stopAtClockTime = startAtClockTime + METRONOME_CLICK_DURATION_SECONDS;
    const gainValue = isDownbeat
      ? METRONOME_DOWNBEAT_GAIN
      : METRONOME_REGULAR_GAIN;

    oscillator.type = "sine";
    oscillator.frequency.value = isDownbeat
      ? METRONOME_DOWNBEAT_FREQUENCY_HZ
      : METRONOME_REGULAR_FREQUENCY_HZ;
    gainNode.gain.value = gainValue;
    gainNode.gain.setValueAtTime?.(gainValue, startAtClockTime);
    gainNode.gain.linearRampToValueAtTime?.(0, stopAtClockTime);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startAtClockTime);
    oscillator.stop(stopAtClockTime);

    activeMetronomeClicks.push({
      oscillator,
      gainNode,
      startAtClockTime,
      stopAtClockTime,
      kind,
    });
    return true;
  }

  function scheduleMetronomeForInstruction(
    instruction: PlaybackScheduleInstruction,
    horizonClockTime: number,
  ): void {
    const secondsPerBeat = getSecondsPerMusicalBeat(normalizedMusicalTimeline);
    const beatsPerBar = normalizedMusicalTimeline.timeSignature.numerator;
    const now = audioContext.currentTime;
    const windowStartClockTime = Math.max(now, instruction.startAtClockTime);
    const windowEndClockTime = Math.min(
      horizonClockTime,
      instruction.endAtClockTime,
    );

    if (windowEndClockTime <= windowStartClockTime) {
      return;
    }

    const projectAtWindowStart =
      instruction.projectPositionSeconds +
      (windowStartClockTime - instruction.startAtClockTime);
    let beatIndex = Math.ceil(projectAtWindowStart / secondsPerBeat - 1e-9);

    while (true) {
      const beatProjectSeconds = beatIndex * secondsPerBeat;
      const clickClockTime =
        instruction.startAtClockTime +
        (beatProjectSeconds - instruction.projectPositionSeconds);

      if (clickClockTime >= windowEndClockTime - 1e-9) {
        break;
      }

      if (
        clickClockTime >= now - 1e-9 &&
        (lastScheduledMetronomeClockTime === null ||
          clickClockTime > lastScheduledMetronomeClockTime + 1e-9)
      ) {
        if (scheduleMetronomeClick(
          clickClockTime,
          beatIndex % beatsPerBar === 0,
        )) {
          lastScheduledMetronomeClockTime = clickClockTime;
        }
      }

      beatIndex += 1;
    }
  }

  function maintainMetronomeSchedule(): void {
    pruneCompletedMetronomeClicks();

    if (
      !metronomeEnabled ||
      transport.getSnapshot().playbackState !== "playing"
    ) {
      return;
    }

    const horizonClockTime =
      audioContext.currentTime + METRONOME_LOOKAHEAD_SECONDS;
    const instructions = sourceGenerations
      .map((generation) => generation.instruction)
      .sort((a, b) => a.startAtClockTime - b.startAtClockTime);

    for (const instruction of instructions) {
      scheduleMetronomeForInstruction(instruction, horizonClockTime);
    }
  }

  function resetMetronomeSchedule(): void {
    clearMetronomeClicks();
    maintainMetronomeSchedule();
  }

  const unsubscribeTransport = transport.subscribe(() => {
    observePeriodicOutputClockSample();
    pruneCompletedSourceGenerations();
    maintainLoopSchedule();
    maintainMetronomeSchedule();
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

  function clearRecordedTakeAudition(): void {
    recordedTakeAuditionGeneration += 1;
    const active = activeRecordedTakeAudition;
    activeRecordedTakeAudition = null;

    if (active) {
      safeStopSource(active.source);
      active.gainNode.disconnect?.();
    }
  }

  function clearActiveSources(): void {
    for (const generation of sourceGenerations) {
      for (const { source } of generation.sources) {
        safeStopSource(source);
      }
    }

    sourceGenerations = [];
    lastScheduledLoopInstruction = null;
    synchronizedRecordingSchedule = null;
    clearRecordedTakeAudition();
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

  function createSourceForChannel(
    loadedChannel: LoadedWebAudioChannel,
    instruction: PlaybackScheduleInstruction,
    scheduleStartAtClockTime = instruction.startAtClockTime,
    scheduleProjectPosition = instruction.projectPositionSeconds,
  ): ActiveSource | null {
    const buffer = loadedChannel.buffer;
    const gainNode = loadedChannel.gainNode;

    if (!buffer || !gainNode) {
      return null;
    }

    const trackStartPosition = getTrackTimelineOffsetSeconds(
      loadedChannel.channel,
      normalizedMusicalTimeline,
    );
    const alignmentWindow = getTrackSourceAlignmentWindow({
      trackStartSeconds: trackStartPosition,
      sourceDurationSeconds: buffer.duration,
      alignmentOffsetSeconds: loadedChannel.channel.alignmentOffsetSeconds,
      mediaLeadInSeconds: loadedChannel.channel.mediaLeadInSeconds,
    });
    const instructionEndPosition =
      instruction.projectPositionSeconds +
      (instruction.endAtClockTime - instruction.startAtClockTime);
    const sourceProjectStart = Math.max(
      scheduleProjectPosition,
      alignmentWindow.projectStartSeconds,
    );
    const sourceOffset = getAlignedSourceOffsetSeconds({
      projectTimeSeconds: sourceProjectStart,
      trackStartSeconds: trackStartPosition,
      alignmentOffsetSeconds: loadedChannel.channel.alignmentOffsetSeconds,
      mediaLeadInSeconds: loadedChannel.channel.mediaLeadInSeconds,
    });

    if (
      sourceProjectStart >= instructionEndPosition - END_EPSILON_SECONDS ||
      sourceProjectStart >= alignmentWindow.projectEndSeconds - END_EPSILON_SECONDS ||
      sourceOffset >= buffer.duration - END_EPSILON_SECONDS
    ) {
      return null;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    source.start(
      scheduleStartAtClockTime + (sourceProjectStart - scheduleProjectPosition),
      sourceOffset,
    );

    return {
      channelNumber: loadedChannel.channel.channelNumber,
      source,
    };
  }

  function startSources(
    instruction: PlaybackScheduleInstruction,
    isLoopContinuation = false,
  ): ScheduledSourceGeneration | null {
    if (!hasReadyChannels()) {
      return null;
    }

    const sources: ActiveSource[] = [];

    for (const loadedChannel of loadedChannels) {
      const source = createSourceForChannel(loadedChannel, instruction);
      if (source) {
        sources.push(source);
      }
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

    maintainMetronomeSchedule();
    return instruction;
  }

  async function play(): Promise<void> {
    if (destroyed) {
      return;
    }

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

  async function startSynchronizedRecordingPlayback(
    { countInBars = DEFAULT_RECORDING_COUNT_IN_BARS }: { countInBars?: number } = {},
  ): Promise<SynchronizedRecordingPlaybackStart> {
    if (destroyed) {
      throw new Error("Playback engine has been destroyed.");
    }

    if (!hasReadyChannels()) {
      throw new Error(
        "Load at least one project track before starting synchronized recording.",
      );
    }

    if (transport.getSnapshot().playbackState === "playing") {
      return {
        marker: recordingTimeline.markStart(),
        mediaLeadInSeconds: 0,
        countIn: { bars: 0, beats: 0, durationSeconds: 0 },
      };
    }

    if (audioContext.state !== "running") {
      await audioContext.resume();
    }

    if (!audioContext.createOscillator) {
      throw new Error("This Web Audio environment cannot schedule a recording count-in.");
    }

    const normalizedCountInBars = Number.isInteger(countInBars) && countInBars > 0
      ? countInBars
      : DEFAULT_RECORDING_COUNT_IN_BARS;
    const beatsPerBar = normalizedMusicalTimeline.timeSignature.numerator;
    const countInBeats = normalizedCountInBars * beatsPerBar;
    const secondsPerBeat = getSecondsPerMusicalBeat(normalizedMusicalTimeline);
    const countInDurationSeconds = countInBeats * secondsPerBeat;
    const schedulingStartedAt = audioContext.currentTime;
    const countInStartAt =
      schedulingStartedAt + RECORDING_COUNT_IN_START_LEAD_SECONDS;
    const projectStartAt = countInStartAt + countInDurationSeconds;

    for (let beatIndex = 0; beatIndex < countInBeats; beatIndex += 1) {
      scheduleMetronomeClick(
        countInStartAt + beatIndex * secondsPerBeat,
        beatIndex % beatsPerBar === 0,
        "count-in",
      );
    }

    const instruction = scheduleAndStartSources(
      Math.max(0, projectStartAt - audioContext.currentTime),
    );

    if (!instruction) {
      clearAllClickCues();
      throw new Error("Project playback could not start for synchronized recording.");
    }

    synchronizedRecordingSchedule = {
      countInBars: normalizedCountInBars,
      countInBeats,
      countInDurationSeconds,
      countInStartAtClockTime: countInStartAt,
      projectStartAtClockTime: instruction.startAtClockTime,
      secondsPerBeat,
    };
    notify();

    return {
      marker: {
        kind: "recording-start",
        projectPositionSeconds: instruction.projectPositionSeconds,
        musicalPosition: transportSecondsToMusicalPosition(
          normalizedMusicalTimeline,
          instruction.projectPositionSeconds,
        ),
        audioContextTimeSeconds: instruction.startAtClockTime,
        playbackState: "playing",
      },
      mediaLeadInSeconds: Math.max(
        0,
        instruction.startAtClockTime - schedulingStartedAt,
      ),
      countIn: {
        bars: normalizedCountInBars,
        beats: countInBeats,
        durationSeconds: countInDurationSeconds,
      },
    };
  }

  async function auditionRecordedTake({
    capture,
    projectStartSeconds,
    alignmentOffsetSeconds = 0,
    mediaLeadInSeconds = 0,
    onEnded,
  }: RecordedTakeAuditionOptions): Promise<void> {
    if (destroyed) {
      throw new Error("Playback engine has been destroyed.");
    }

    if (!hasReadyChannels()) {
      throw new Error(
        "Load at least one project track before auditioning a recorded take.",
      );
    }

    if (!Number.isFinite(projectStartSeconds)) {
      throw new Error("Recorded take audition has an invalid project position.");
    }

    // Decode the temporary capture before starting the transport so project and
    // take can be scheduled together on one AudioContext clock edge.
    const captureBytes = new Uint8Array(capture.bytes.byteLength);
    captureBytes.set(capture.bytes);
    const takeBuffer = await audioContext.decodeAudioData(captureBytes.buffer);

    if (destroyed) {
      return;
    }

    if (transport.getSnapshot().playbackState === "playing") {
      transport.pause();
    }
    clearActiveSources();
    clearAllClickCues();

    const clampedProjectStart = Math.max(
      0,
      Math.min(transport.getSnapshot().durationSeconds, projectStartSeconds),
    );
    transport.seek(clampedProjectStart);

    if (audioContext.state !== "running") {
      await audioContext.resume();
    }

    const instruction = scheduleAndStartSources(PLAYBACK_START_LEAD_SECONDS);
    if (!instruction) {
      throw new Error("Project playback could not start for take audition.");
    }

    const alignmentWindow = getTrackSourceAlignmentWindow({
      trackStartSeconds: clampedProjectStart,
      sourceDurationSeconds: takeBuffer.duration,
      alignmentOffsetSeconds,
      mediaLeadInSeconds,
    });
    const sourceProjectStart = Math.max(
      instruction.projectPositionSeconds,
      alignmentWindow.projectStartSeconds,
    );
    const sourceOffset = getAlignedSourceOffsetSeconds({
      projectTimeSeconds: sourceProjectStart,
      trackStartSeconds: clampedProjectStart,
      alignmentOffsetSeconds,
      mediaLeadInSeconds,
    });

    if (
      sourceProjectStart >= instruction.projectPositionSeconds + instruction.durationSeconds - END_EPSILON_SECONDS ||
      sourceProjectStart >= alignmentWindow.projectEndSeconds - END_EPSILON_SECONDS ||
      sourceOffset >= takeBuffer.duration - END_EPSILON_SECONDS
    ) {
      stop();
      onEnded?.();
      return;
    }

    const source = audioContext.createBufferSource();
    source.buffer = takeBuffer;
    const gainNode = audioContext.createGain();
    gainNode.gain.value = recordedTakeAuditionVolume;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    const generation = ++recordedTakeAuditionGeneration;
    activeRecordedTakeAudition = { source, gainNode, generation };
    source.onended = () => {
      if (
        destroyed ||
        !activeRecordedTakeAudition ||
        activeRecordedTakeAudition.source !== source ||
        activeRecordedTakeAudition.generation !== generation
      ) {
        return;
      }

      activeRecordedTakeAudition = null;
      source.onended = null;
      source.disconnect?.();
      gainNode.disconnect?.();
      onEnded?.();
    };

    try {
      source.start(
        instruction.startAtClockTime +
          (sourceProjectStart - instruction.projectPositionSeconds),
        sourceOffset,
      );
    } catch (error) {
      if (activeRecordedTakeAudition?.source === source) {
        activeRecordedTakeAudition = null;
      }
      safeStopSource(source);
      gainNode.disconnect?.();
      stop();
      throw error;
    }
  }

  function stopRecordedTakeAudition(): void {
    clearRecordedTakeAudition();
  }

  function setRecordedTakeAuditionVolume(volume: number): void {
    if (!Number.isFinite(volume) || destroyed) return;
    recordedTakeAuditionVolume = Math.max(0, Math.min(1, volume));
    if (activeRecordedTakeAudition) {
      activeRecordedTakeAudition.gainNode.gain.value = recordedTakeAuditionVolume;
    }
  }

  function pause(): void {
    if (transport.getSnapshot().playbackState !== "playing") {
      return;
    }

    transport.pause();
    clearActiveSources();
    clearAllClickCues();
  }

  function stop(): void {
    pendingSeekSeconds = null;
    transport.stop();
    clearActiveSources();
    clearAllClickCues();
  }

  function seek(seconds: number): void {
    if (destroyed || !Number.isFinite(seconds)) {
      return;
    }

    if (!hasReadyChannels()) {
      if (loadedChannels.length > 0) {
        pendingSeekSeconds = Math.max(0, seconds);
      }
      return;
    }

    pendingSeekSeconds = null;
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
    clearAllClickCues();
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

    if (loadedChannel.channel.enabled === enabled) {
      return true;
    }

    loadedChannel.channel.enabled = enabled;

    if (loadedChannel.gainNode) {
      setGainValue(loadedChannel.gainNode, loadedChannel.channel);
    }

    if (enabled) {
      if (loadedChannel.preparationStatus === "failed") {
        loadedChannel.preparationStatus = "unloaded";
        loadedChannel.failureMessage = null;
      }
      if (loadedChannel.preparationStatus === "ready") {
        attachPreparedChannelToActivePlayback(loadedChannel);
      } else {
        void prepareChannel(loadedChannel, loadGeneration);
      }
    }

    handlePreparationChange(loadGeneration);

    return true;
  }

  function getLoadFailureMessage(error: unknown): string {
    return error instanceof Error && error.message.trim()
      ? error.message
      : "This track could not be prepared for playback.";
  }

  function updatePreparedMixDuration(): void {
    const nextDuration = getMixDuration();
    const transportSnapshot = transport.getSnapshot();
    const durationChanged =
      Math.abs(transportSnapshot.durationSeconds - nextDuration) >
      END_EPSILON_SECONDS;

    if (!durationChanged) {
      return;
    }

    const currentGeneration = sourceGenerations.find((generation) => {
      return (
        generation.instruction.startAtClockTime <= audioContext.currentTime &&
        generation.instruction.endAtClockTime > audioContext.currentTime
      );
    });

    if (transportSnapshot.playbackState === "playing" && transportSnapshot.loopEnabled) {
      cancelFutureLoopGenerations();
    }

    transport.setDuration(nextDuration);

    if (!currentGeneration) {
      return;
    }

    currentGeneration.instruction.durationSeconds = nextDuration;
    currentGeneration.instruction.endAtClockTime =
      currentGeneration.instruction.startAtClockTime +
      Math.max(0, nextDuration - currentGeneration.instruction.projectPositionSeconds);

    if (transportSnapshot.loopEnabled) {
      lastScheduledLoopInstruction = currentGeneration.instruction;
      maintainLoopSchedule(true);
    }
  }

  function attachPreparedChannelToActivePlayback(
    loadedChannel: LoadedWebAudioChannel,
  ): void {
    const transportSnapshot = transport.getSnapshot();
    if (
      !loadedChannel.channel.enabled ||
      loadedChannel.preparationStatus !== "ready" ||
      transportSnapshot.playbackState !== "playing"
    ) {
      return;
    }

    pruneCompletedSourceGenerations();
    const marker = transport.markTimelinePosition();
    const joinLeadSeconds = PLAYBACK_START_LEAD_SECONDS;

    for (const generation of sourceGenerations) {
      if (generation.sources.some(({ channelNumber }) => {
        return channelNumber === loadedChannel.channel.channelNumber;
      })) {
        continue;
      }

      const isCurrentGeneration =
        generation.instruction.startAtClockTime <= audioContext.currentTime &&
        generation.instruction.endAtClockTime > audioContext.currentTime;
      const source = isCurrentGeneration
        ? createSourceForChannel(
            loadedChannel,
            generation.instruction,
            audioContext.currentTime + joinLeadSeconds,
            marker.projectPositionSeconds + joinLeadSeconds,
          )
        : createSourceForChannel(loadedChannel, generation.instruction);

      if (source) {
        generation.sources.push(source);
      }
    }
  }

  function startBackgroundPreparation(generation: number): void {
    if (
      destroyed ||
      generation !== loadGeneration ||
      backgroundPreparationGeneration === generation
    ) {
      return;
    }

    backgroundPreparationGeneration = generation;
    void (async () => {
      try {
        for (const loadedChannel of loadedChannels) {
          if (destroyed || generation !== loadGeneration) {
            return;
          }
          if (
            loadedChannel.channel.enabled ||
            loadedChannel.preparationStatus !== "unloaded"
          ) {
            continue;
          }
          await prepareChannel(loadedChannel, generation);
        }
      } finally {
        if (backgroundPreparationGeneration === generation) {
          backgroundPreparationGeneration = null;
        }
      }
    })();
  }

  function handlePreparationChange(generation: number): void {
    if (destroyed || generation !== loadGeneration) {
      return;
    }

    const preparation = getPreparationSnapshot();
    if (preparation.status === "ready") {
      if (pendingSeekSeconds !== null) {
        const requestedSeekSeconds = pendingSeekSeconds;
        pendingSeekSeconds = null;
        transport.seek(requestedSeekSeconds);
      }
      startBackgroundPreparation(generation);
    } else if (preparation.status === "idle") {
      startBackgroundPreparation(generation);
    }

    notify();
  }

  async function prepareChannel(
    loadedChannel: LoadedWebAudioChannel,
    generation: number,
  ): Promise<void> {
    if (
      destroyed ||
      generation !== loadGeneration ||
      loadedChannel.preparationStatus === "fetching" ||
      loadedChannel.preparationStatus === "decoding" ||
      loadedChannel.preparationStatus === "ready"
    ) {
      return;
    }

    try {
      loadedChannel.preparationStatus = "fetching";
      loadedChannel.failureMessage = null;
      handlePreparationChange(generation);
      const audioData = await fetchAudioData(loadedChannel.channel.audioUrl);
      if (destroyed || generation !== loadGeneration) {
        return;
      }

      loadedChannel.preparationStatus = "decoding";
      handlePreparationChange(generation);
      const buffer = await audioContext.decodeAudioData(audioData);
      if (destroyed || generation !== loadGeneration) {
        return;
      }

      const gainNode = audioContext.createGain();
      loadedChannel.buffer = buffer;
      loadedChannel.gainNode = gainNode;
      loadedChannel.preparationStatus = "ready";
      setGainValue(gainNode, loadedChannel.channel);
      gainNode.connect(audioContext.destination);
      updatePreparedMixDuration();
      attachPreparedChannelToActivePlayback(loadedChannel);
      handlePreparationChange(generation);
    } catch (error: unknown) {
      if (destroyed || generation !== loadGeneration) {
        return;
      }
      loadedChannel.preparationStatus = "failed";
      loadedChannel.failureMessage = getLoadFailureMessage(error);
      handlePreparationChange(generation);
      onLoadError(error);
    }
  }

  function retryPreparation(): void {
    if (destroyed) {
      return;
    }

    const generation = loadGeneration;
    const failedRequiredChannels = loadedChannels.filter((loadedChannel) => {
      return loadedChannel.channel.enabled &&
        loadedChannel.preparationStatus === "failed";
    });

    for (const loadedChannel of failedRequiredChannels) {
      loadedChannel.preparationStatus = "unloaded";
      loadedChannel.failureMessage = null;
      void prepareChannel(loadedChannel, generation);
    }

    handlePreparationChange(generation);
  }

  function loadMix(channels: PlaybackChannel[]): void {
    if (destroyed) {
      return;
    }

    // Rebuilding the mix is a data refresh, not a navigation command. Preserve
    // either a seek requested while the previous mix was decoding or the
    // transport position the user is currently working from. Explicit Stop is
    // the operation that resets transport to project start.
    const preservedPositionSeconds = pendingSeekSeconds ?? transport.getPosition();

    const generation = loadGeneration + 1;
    loadGeneration = generation;
    backgroundPreparationGeneration = null;

    clearActiveSources();
    clearAllClickCues();
    disconnectLoadedChannels();
    loadedChannels = channels.map((channel) => ({
      channel: {
        ...channel,
        volume: clampVolume(channel.volume),
      },
      buffer: null,
      gainNode: null,
      preparationStatus: "unloaded",
      failureMessage: null,
    }));
    pendingSeekSeconds = preservedPositionSeconds > 0
      ? preservedPositionSeconds
      : null;
    transport.stop();
    transport.setDuration(0);

    if (loadedChannels.length === 0) {
      notify();
      return;
    }

    const requiredChannels = loadedChannels.filter(({ channel }) => channel.enabled);
    if (requiredChannels.length === 0) {
      handlePreparationChange(generation);
      return;
    }

    for (const loadedChannel of requiredChannels) {
      void prepareChannel(loadedChannel, generation);
    }
  }

  function destroy(): void {
    if (destroyed) {
      return;
    }

    loadGeneration += 1;
    clearActiveSources();
    clearAllClickCues();
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
    retryPreparation,
    play,
    startSynchronizedRecordingPlayback,
    getSynchronizedRecordingPlaybackSnapshot,
    auditionRecordedTake,
    setRecordedTakeAuditionVolume,
    stopRecordedTakeAudition,
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
        resetMetronomeSchedule();
        return;
      }

      lastScheduledLoopInstruction = getCurrentOrUpcomingInstruction();
      maintainLoopSchedule(true);
      resetMetronomeSchedule();
    },
    setMetronomeEnabled(enabled) {
      if (metronomeEnabled === enabled) {
        return;
      }
      metronomeEnabled = enabled;
      if (!enabled) {
        clearMetronomeClicks();
        return;
      }
      resetMetronomeSchedule();
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
