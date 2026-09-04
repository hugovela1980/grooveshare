import type { MusicalPosition, MusicalTimeline } from "../domain/types.js";
import {
  musicalPositionToTransportSeconds,
  normalizeMusicalTimeline,
  transportSecondsToMusicalPosition,
} from "../timeline/musical-timeline.js";
import { getTrackTimelineOffsetSeconds } from "./recording-timeline.js";
import {
  getAlignedSourceOffsetSeconds,
  getTrackSourceAlignmentWindow,
  normalizeTrackAlignmentOffsetSeconds,
  normalizeTrackMediaLeadInSeconds,
} from "./track-source-alignment.js";
import type {
  PlaybackChannel,
  PlaybackChannelPreparationStatus,
  PlaybackEngine,
  PlaybackPreparationSnapshot,
  PlaybackSnapshot,
  PlaybackStateListener,
} from "./playback-engine.js";

export type HtmlAudioElementLike = {
  src: string;
  crossOrigin?: string | null;
  currentTime: number;
  duration: number;
  paused: boolean;
  volume: number;
  play: () => Promise<void>;
  pause: () => void;
  load?: () => void;
  addEventListener: (
    eventName: "timeupdate" | "loadedmetadata" | "canplay" | "ended" | "error",
    handler: () => void | Promise<void>,
  ) => void;
};

type LoadedPlaybackChannel = {
  channel: PlaybackChannel;
  audioElement: HtmlAudioElementLike;
  preparationStatus: PlaybackChannelPreparationStatus;
  failureMessage: string | null;
};

type HtmlAudioPlaybackEngineOptions = {
  primaryAudioElement: HtmlAudioElementLike;
  createAudioElement: () => HtmlAudioElementLike;
  musicalTimeline?: MusicalTimeline;
};

const END_EPSILON_SECONDS = 0.01;

function isUsableDuration(duration: number): boolean {
  return Number.isFinite(duration) && duration > 0;
}

function isUsableCurrentTime(currentTime: number): boolean {
  return Number.isFinite(currentTime) && currentTime >= 0;
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return 1;
  }

  return Math.max(0, Math.min(1, volume));
}

export function createHtmlAudioPlaybackEngine({
  primaryAudioElement,
  createAudioElement,
  musicalTimeline,
}: HtmlAudioPlaybackEngineOptions): PlaybackEngine {
  const normalizedMusicalTimeline = normalizeMusicalTimeline(musicalTimeline);
  let loadedChannels: LoadedPlaybackChannel[] = [];
  let loopEnabled = false;
  let playbackRequested = false;
  const delayedStartTimeouts = new Set<ReturnType<typeof globalThis.setTimeout>>();
  const listeners = new Set<PlaybackStateListener>();
  const wiredAudioElements = new WeakSet<object>();

  function getLoadedAudioElements(): HtmlAudioElementLike[] {
    return loadedChannels.map(({ audioElement }) => audioElement);
  }

  function getChannelOffset(channel: PlaybackChannel): number {
    return getTrackTimelineOffsetSeconds(channel, normalizedMusicalTimeline);
  }

  function getChannelAlignmentWindow(
    channel: PlaybackChannel,
    audioElement: HtmlAudioElementLike,
  ) {
    return getTrackSourceAlignmentWindow({
      trackStartSeconds: getChannelOffset(channel),
      sourceDurationSeconds: isUsableDuration(audioElement.duration)
        ? audioElement.duration
        : 0,
      alignmentOffsetSeconds: channel.alignmentOffsetSeconds,
      mediaLeadInSeconds: channel.mediaLeadInSeconds,
    });
  }

  function getMixDuration(): number {
    return loadedChannels.reduce((longestDuration, { channel, audioElement, preparationStatus }) => {
      if (preparationStatus !== "ready") {
        return longestDuration;
      }
      const duration = audioElement.duration;

      return isUsableDuration(duration)
        ? Math.max(
            longestDuration,
            getChannelAlignmentWindow(channel, audioElement).projectEndSeconds,
          )
        : longestDuration;
    }, 0);
  }

  function getTransportCurrentTime(): number {
    const longestDuration = getMixDuration();
    const activeOrAdvancedChannels = loadedChannels.filter(({ channel, audioElement }) => {
      const alignmentWindow = getChannelAlignmentWindow(channel, audioElement);
      return !audioElement.paused ||
        audioElement.currentTime > 0 ||
        alignmentWindow.projectStartSeconds === 0;
    });
    const furthestCurrentTime = activeOrAdvancedChannels.reduce(
      (furthestTime, { channel, audioElement }) => {
        if (!isUsableCurrentTime(audioElement.currentTime)) {
          return furthestTime;
        }

        const projectTime =
          getChannelOffset(channel) +
          audioElement.currentTime +
          normalizeTrackAlignmentOffsetSeconds(channel.alignmentOffsetSeconds) -
          normalizeTrackMediaLeadInSeconds(channel.mediaLeadInSeconds);

        return Math.max(furthestTime, Math.max(0, projectTime));
      },
      0,
    );

    return longestDuration > 0
      ? Math.min(longestDuration, furthestCurrentTime)
      : furthestCurrentTime;
  }

  function setAudioElementCurrentTime(
    audioElement: HtmlAudioElementLike,
    currentTime: number,
  ): void {
    const nextCurrentTime = isUsableDuration(audioElement.duration)
      ? Math.min(audioElement.duration, currentTime)
      : currentTime;

    if (
      isUsableCurrentTime(audioElement.currentTime) &&
      Math.abs(audioElement.currentTime - nextCurrentTime) < END_EPSILON_SECONDS
    ) {
      return;
    }

    audioElement.currentTime = nextCurrentTime;
  }

  function setAllCurrentTimes(projectTime: number): void {
    for (const { channel, audioElement, preparationStatus } of loadedChannels) {
      if (preparationStatus !== "ready") {
        continue;
      }
      const alignmentWindow = getChannelAlignmentWindow(channel, audioElement);
      const localTime =
        projectTime < alignmentWindow.projectStartSeconds
          ? 0
          : getAlignedSourceOffsetSeconds({
              projectTimeSeconds: projectTime,
              trackStartSeconds: getChannelOffset(channel),
              alignmentOffsetSeconds: channel.alignmentOffsetSeconds,
              mediaLeadInSeconds: channel.mediaLeadInSeconds,
            });
      setAudioElementCurrentTime(audioElement, localTime);
    }
  }

  function clearDelayedStarts(): void {
    for (const timeout of delayedStartTimeouts) {
      globalThis.clearTimeout(timeout);
    }
    delayedStartTimeouts.clear();
  }

  function scheduleFutureChannels(projectTime: number): void {
    for (const { channel, audioElement, preparationStatus } of loadedChannels) {
      if (preparationStatus !== "ready") {
        continue;
      }
      const alignmentWindow = getChannelAlignmentWindow(channel, audioElement);
      const channelStart = alignmentWindow.projectStartSeconds;
      if (channelStart <= projectTime || !audioElement.paused) {
        continue;
      }

      const delayMs = Math.max(0, (channelStart - projectTime) * 1000);
      const timeout = globalThis.setTimeout(() => {
        delayedStartTimeouts.delete(timeout);
        if (!playbackRequested) {
          return;
        }
        audioElement.currentTime =
          alignmentWindow.sourceOffsetAtProjectStartSeconds;
        void audioElement.play().then(notify);
      }, delayMs);
      delayedStartTimeouts.add(timeout);
    }
  }

  function hasUnfinishedChannel(): boolean {
    return getLoadedAudioElements().some((audioElement) => {
      if (!isUsableDuration(audioElement.duration)) {
        return !audioElement.paused;
      }

      return audioElement.currentTime <
        audioElement.duration - END_EPSILON_SECONDS;
    });
  }

  function getPreparationSnapshot(): PlaybackPreparationSnapshot {
    const channels = loadedChannels.map((loadedChannel) => ({
      channelNumber: loadedChannel.channel.channelNumber,
      trackId: loadedChannel.channel.trackId,
      required: loadedChannel.channel.enabled,
      status: loadedChannel.preparationStatus,
      failureMessage: loadedChannel.failureMessage,
      activeSource: loadedChannel.preparationStatus === "ready"
        ? "playback-derivative" as const
        : null,
      preparedSources: {
        playbackDerivative: loadedChannel.preparationStatus,
        original: "unloaded" as const,
      },
    }));
    const requiredChannels = channels.filter(({ required }) => required);
    const failedRequiredChannel = requiredChannels.find(({ status }) => {
      return status === "failed";
    });
    const readyRequiredChannelCount = requiredChannels.filter(({ status }) => {
      return status === "ready";
    }).length;

    return {
      status: requiredChannels.length === 0
        ? "idle"
        : failedRequiredChannel
          ? "failed"
          : readyRequiredChannelCount === requiredChannels.length
            ? "ready"
            : "preparing",
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

  function getSnapshot(): PlaybackSnapshot {
    const preparation = getPreparationSnapshot();
    const hasLoadedChannels =
      preparation.status === "ready" &&
      preparation.requiredChannelCount > 0;
    const duration = getMixDuration();
    const currentTime = duration > 0 ? getTransportCurrentTime() : 0;

    return {
      currentTime,
      musicalPosition: transportSecondsToMusicalPosition(
        normalizedMusicalTimeline,
        currentTime,
      ),
      duration,
      isPlaying:
        playbackRequested ||
          getLoadedAudioElements().some((audioElement) => !audioElement.paused),
      hasLoadedChannels,
      preparation,
    };
  }

  function notify(): void {
    const snapshot = getSnapshot();

    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  async function play(): Promise<void> {
    if (!getSnapshot().hasLoadedChannels) {
      return;
    }

    const projectTime = getTransportCurrentTime();
    playbackRequested = true;
    clearDelayedStarts();
    setAllCurrentTimes(projectTime);

    const playableNow = loadedChannels.filter(({ channel, audioElement, preparationStatus }) => {
      if (preparationStatus !== "ready") {
        return false;
      }
      const channelStart =
        getChannelAlignmentWindow(channel, audioElement).projectStartSeconds;
      return channelStart <= projectTime + END_EPSILON_SECONDS &&
        (!isUsableDuration(audioElement.duration) ||
          audioElement.currentTime < audioElement.duration - END_EPSILON_SECONDS);
    });

    await Promise.all(
      playableNow.map(({ audioElement }) => audioElement.play()),
    );
    scheduleFutureChannels(projectTime);
    notify();
  }

  function pause(): void {
    playbackRequested = false;
    clearDelayedStarts();
    for (const audioElement of getLoadedAudioElements()) {
      audioElement.pause();
    }

    notify();
  }

  function stop(): void {
    playbackRequested = false;
    clearDelayedStarts();
    for (const audioElement of getLoadedAudioElements()) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }

    notify();
  }

  function seek(seconds: number): void {
    if (loadedChannels.length === 0 || !Number.isFinite(seconds)) {
      return;
    }

    const mixDuration = getMixDuration();
    const nextTime = mixDuration > 0
      ? Math.max(0, Math.min(mixDuration, seconds))
      : Math.max(0, seconds);
    const shouldResumePlayback = playbackRequested;

    if (shouldResumePlayback) {
      clearDelayedStarts();
      for (const audioElement of getLoadedAudioElements()) {
        audioElement.pause();
      }
    }

    setAllCurrentTimes(nextTime);

    if (shouldResumePlayback) {
      for (const { channel, audioElement } of loadedChannels) {
        const channelStart =
          getChannelAlignmentWindow(channel, audioElement).projectStartSeconds;
        const canPlayNow =
          channelStart <= nextTime + END_EPSILON_SECONDS &&
          (!isUsableDuration(audioElement.duration) ||
            audioElement.currentTime <
              audioElement.duration - END_EPSILON_SECONDS);

        if (canPlayNow) {
          void audioElement.play().then(notify);
        }
      }

      scheduleFutureChannels(nextTime);
    }

    notify();
  }

  function seekBy(seconds: number): void {
    if (loadedChannels.length === 0 || !Number.isFinite(seconds)) {
      return;
    }

    seek(getTransportCurrentTime() + seconds);
  }

  function seekToMusicalPosition(position: MusicalPosition): void {
    seek(
      musicalPositionToTransportSeconds(
        normalizedMusicalTimeline,
        position,
      ),
    );
  }

  function setChannelVolume(channelNumber: number, volume: number): boolean {
    const loadedChannel = loadedChannels.find(({ channel }) => {
      return channel.channelNumber === channelNumber;
    });

    if (!loadedChannel) {
      return false;
    }

    const nextVolume = clampVolume(volume);
    loadedChannel.channel.volume = nextVolume;
    loadedChannel.audioElement.volume = loadedChannel.channel.enabled
      ? nextVolume
      : 0;

    return true;
  }

  function setChannelEnabled(channelNumber: number, enabled: boolean): boolean {
    const loadedChannel = loadedChannels.find(({ channel }) => {
      return channel.channelNumber === channelNumber;
    });

    if (!loadedChannel) {
      return false;
    }

    if (loadedChannel.channel.enabled === enabled) {
      return true;
    }

    loadedChannel.channel.enabled = enabled;
    loadedChannel.audioElement.volume = enabled
      ? clampVolume(loadedChannel.channel.volume)
      : 0;

    if (enabled) {
      if (loadedChannel.preparationStatus === "failed") {
        loadedChannel.preparationStatus = "unloaded";
        loadedChannel.failureMessage = null;
      }
      if (loadedChannel.preparationStatus === "unloaded") {
        beginChannelPreparation(loadedChannel);
      } else if (loadedChannel.preparationStatus === "ready" && playbackRequested) {
        const projectTime = getTransportCurrentTime();
        const alignmentWindow = getChannelAlignmentWindow(
          loadedChannel.channel,
          loadedChannel.audioElement,
        );
        setAllCurrentTimes(projectTime);
        if (
          alignmentWindow.projectStartSeconds <=
          projectTime + END_EPSILON_SECONDS
        ) {
          void loadedChannel.audioElement.play().then(notify);
        } else {
          clearDelayedStarts();
          scheduleFutureChannels(projectTime);
        }
      }
    }

    handlePreparationChange();

    return true;
  }

  async function handleEnded(): Promise<void> {
    if (hasUnfinishedChannel()) {
      notify();
      return;
    }

    if (!loopEnabled) {
      stop();
      return;
    }

    seek(0);
  }

  function wireAudioElement(audioElement: HtmlAudioElementLike): void {
    if (wiredAudioElements.has(audioElement as object)) {
      return;
    }

    wiredAudioElements.add(audioElement as object);
    audioElement.addEventListener("timeupdate", notify);
    audioElement.addEventListener("loadedmetadata", () => {
      const loadedChannel = loadedChannels.find((candidate) => {
        return candidate.audioElement === audioElement;
      });
      if (
        loadedChannel &&
        loadedChannel.preparationStatus === "fetching"
      ) {
        loadedChannel.preparationStatus = "decoding";
      }
      notify();
    });
    audioElement.addEventListener("canplay", () => {
      const loadedChannel = loadedChannels.find((candidate) => {
        return candidate.audioElement === audioElement;
      });
      if (loadedChannel) {
        loadedChannel.preparationStatus = "ready";
        loadedChannel.failureMessage = null;
        if (loadedChannel.channel.enabled && playbackRequested) {
          const projectTime = getTransportCurrentTime();
          const alignmentWindow = getChannelAlignmentWindow(
            loadedChannel.channel,
            loadedChannel.audioElement,
          );
          setAllCurrentTimes(projectTime);
          if (
            alignmentWindow.projectStartSeconds <=
            projectTime + END_EPSILON_SECONDS
          ) {
            void loadedChannel.audioElement.play().then(notify);
          } else {
            scheduleFutureChannels(projectTime);
          }
        }
      }
      handlePreparationChange();
    });
    audioElement.addEventListener("error", () => {
      const loadedChannel = loadedChannels.find((candidate) => {
        return candidate.audioElement === audioElement;
      });
      if (loadedChannel) {
        loadedChannel.preparationStatus = "failed";
        loadedChannel.failureMessage = "This track could not be prepared for playback.";
      }
      handlePreparationChange();
    });
    audioElement.addEventListener("ended", handleEnded);
  }

  function beginChannelPreparation(loadedChannel: LoadedPlaybackChannel): void {
    if (
      loadedChannel.preparationStatus === "fetching" ||
      loadedChannel.preparationStatus === "decoding" ||
      loadedChannel.preparationStatus === "ready"
    ) {
      return;
    }

    loadedChannel.preparationStatus = "fetching";
    loadedChannel.failureMessage = null;
    const derivativeUrl = loadedChannel.channel.playbackDerivativeUrl;
    if (!derivativeUrl) {
      loadedChannel.preparationStatus = "failed";
      loadedChannel.failureMessage = "Playback derivative is not available.";
      handlePreparationChange();
      return;
    }
    loadedChannel.audioElement.crossOrigin = "use-credentials";
    loadedChannel.audioElement.src = derivativeUrl;
    loadedChannel.audioElement.currentTime = 0;
    loadedChannel.audioElement.load?.();
    notify();
  }

  function handlePreparationChange(): void {
    const preparation = getPreparationSnapshot();
    if (preparation.status === "ready" || preparation.status === "idle") {
      for (const loadedChannel of loadedChannels) {
        if (
          !loadedChannel.channel.enabled &&
          loadedChannel.preparationStatus === "unloaded"
        ) {
          beginChannelPreparation(loadedChannel);
        }
      }
    }
    notify();
  }

  function retryPreparation(): void {
    for (const loadedChannel of loadedChannels) {
      if (
        loadedChannel.channel.enabled &&
        loadedChannel.preparationStatus === "failed"
      ) {
        loadedChannel.preparationStatus = "unloaded";
        loadedChannel.failureMessage = null;
        beginChannelPreparation(loadedChannel);
      }
    }
    handlePreparationChange();
  }

  function loadMix(channels: PlaybackChannel[]): void {
    // Rebuilding the mix is a data refresh, not a navigation command. Preserve
    // the current working position; the explicit Project Player Stop command is
    // what resets transport to project start.
    const preservedPositionSeconds = getTransportCurrentTime();
    stop();

    loadedChannels = channels.map((channel, index) => {
      const audioElement =
        index === 0 ? primaryAudioElement : createAudioElement();

      wireAudioElement(audioElement);
      audioElement.currentTime = 0;
      audioElement.volume = channel.enabled
        ? clampVolume(channel.volume)
        : 0;

      return {
        channel: { ...channel },
        audioElement,
        preparationStatus: "unloaded" as const,
        failureMessage: null,
      };
    });

    for (const loadedChannel of loadedChannels) {
      if (loadedChannel.channel.enabled) {
        beginChannelPreparation(loadedChannel);
      }
    }

    if (!loadedChannels.some(({ channel }) => channel.enabled)) {
      handlePreparationChange();
    }

    if (preservedPositionSeconds > 0) {
      seek(preservedPositionSeconds);
      return;
    }

    notify();
  }

  wireAudioElement(primaryAudioElement);

  return {
    loadMix,
    retryPreparation,
    play,
    pause,
    stop,
    seek,
    seekBy,
    seekToMusicalPosition,
    setLoopEnabled(enabled) {
      loopEnabled = enabled;
    },
    setMetronomeEnabled() {
      // HTML fallback cannot provide sample-scheduled metronome clicks.
    },
    setChannelVolume,
    setChannelEnabled,
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      listener(getSnapshot());

      return () => {
        listeners.delete(listener);
      };
    },
    destroy() {
      stop();
      loadedChannels = [];
      listeners.clear();
    },
  };
}
