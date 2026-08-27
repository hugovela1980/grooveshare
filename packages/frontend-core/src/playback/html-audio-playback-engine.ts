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
  PlaybackEngine,
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
    eventName: "timeupdate" | "loadedmetadata" | "ended",
    handler: () => void | Promise<void>,
  ) => void;
};

type LoadedPlaybackChannel = {
  channel: PlaybackChannel;
  audioElement: HtmlAudioElementLike;
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
    return loadedChannels.reduce((longestDuration, { channel, audioElement }) => {
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
    for (const { channel, audioElement } of loadedChannels) {
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
    for (const { channel, audioElement } of loadedChannels) {
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

  function getSnapshot(): PlaybackSnapshot {
    const hasLoadedChannels = loadedChannels.length > 0;
    const duration = hasLoadedChannels ? getMixDuration() : 0;

    const currentTime = hasLoadedChannels ? getTransportCurrentTime() : 0;

    return {
      currentTime,
      musicalPosition: transportSecondsToMusicalPosition(
        normalizedMusicalTimeline,
        currentTime,
      ),
      duration,
      isPlaying:
        hasLoadedChannels &&
        (playbackRequested ||
          getLoadedAudioElements().some((audioElement) => !audioElement.paused)),
      hasLoadedChannels,
    };
  }

  function notify(): void {
    const snapshot = getSnapshot();

    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  async function play(): Promise<void> {
    if (loadedChannels.length === 0) {
      return;
    }

    const projectTime = getTransportCurrentTime();
    playbackRequested = true;
    clearDelayedStarts();
    setAllCurrentTimes(projectTime);

    const playableNow = loadedChannels.filter(({ channel, audioElement }) => {
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

    loadedChannel.channel.enabled = enabled;
    loadedChannel.audioElement.volume = enabled
      ? clampVolume(loadedChannel.channel.volume)
      : 0;

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
    audioElement.addEventListener("loadedmetadata", notify);
    audioElement.addEventListener("ended", handleEnded);
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
      audioElement.crossOrigin = "use-credentials";
      audioElement.src = channel.audioUrl;
      audioElement.currentTime = 0;
      audioElement.volume = channel.enabled
        ? clampVolume(channel.volume)
        : 0;
      audioElement.load?.();

      return {
        channel: { ...channel },
        audioElement,
      };
    });

    if (preservedPositionSeconds > 0) {
      seek(preservedPositionSeconds);
      return;
    }

    notify();
  }

  wireAudioElement(primaryAudioElement);

  return {
    loadMix,
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
