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
}: HtmlAudioPlaybackEngineOptions): PlaybackEngine {
  let loadedChannels: LoadedPlaybackChannel[] = [];
  let loopEnabled = false;
  const listeners = new Set<PlaybackStateListener>();
  const wiredAudioElements = new WeakSet<object>();

  function getLoadedAudioElements(): HtmlAudioElementLike[] {
    return loadedChannels.map(({ audioElement }) => audioElement);
  }

  function getMixDuration(): number {
    return getLoadedAudioElements().reduce((longestDuration, audioElement) => {
      return isUsableDuration(audioElement.duration)
        ? Math.max(longestDuration, audioElement.duration)
        : longestDuration;
    }, 0);
  }

  function getTransportCurrentTime(): number {
    const longestDuration = getMixDuration();
    const furthestCurrentTime = getLoadedAudioElements().reduce(
      (furthestTime, audioElement) => {
        return isUsableCurrentTime(audioElement.currentTime)
          ? Math.max(furthestTime, audioElement.currentTime)
          : furthestTime;
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
    audioElement.currentTime = isUsableDuration(audioElement.duration)
      ? Math.min(audioElement.duration, currentTime)
      : currentTime;
  }

  function setAllCurrentTimes(currentTime: number): void {
    for (const audioElement of getLoadedAudioElements()) {
      setAudioElementCurrentTime(audioElement, currentTime);
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

    return {
      currentTime: hasLoadedChannels ? getTransportCurrentTime() : 0,
      duration,
      isPlaying:
        hasLoadedChannels &&
        getLoadedAudioElements().some((audioElement) => !audioElement.paused),
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

    const playableAudioElements = getLoadedAudioElements().filter(
      (audioElement) => {
        return !isUsableDuration(audioElement.duration) ||
          audioElement.currentTime <
            audioElement.duration - END_EPSILON_SECONDS;
      },
    );

    await Promise.all(
      playableAudioElements.map((audioElement) => audioElement.play()),
    );
    notify();
  }

  function pause(): void {
    for (const audioElement of getLoadedAudioElements()) {
      audioElement.pause();
    }

    notify();
  }

  function stop(): void {
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

    setAllCurrentTimes(nextTime);
    notify();
  }

  function seekBy(seconds: number): void {
    if (loadedChannels.length === 0 || !Number.isFinite(seconds)) {
      return;
    }

    seek(getTransportCurrentTime() + seconds);
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
    await play();
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
    setLoopEnabled(enabled) {
      loopEnabled = enabled;
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
