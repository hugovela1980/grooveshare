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

function isUsableDuration(duration: number): boolean {
  return Number.isFinite(duration) && duration > 0;
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

  function getPrimaryAudioElement(): HtmlAudioElementLike {
    return loadedChannels[0]?.audioElement ?? primaryAudioElement;
  }

  function getLoadedAudioElements(): HtmlAudioElementLike[] {
    return loadedChannels.map(({ audioElement }) => audioElement);
  }

  function setAllCurrentTimes(currentTime: number): void {
    for (const audioElement of getLoadedAudioElements()) {
      audioElement.currentTime = currentTime;
    }
  }

  function getSnapshot(): PlaybackSnapshot {
    const primary = getPrimaryAudioElement();
    const hasLoadedChannels = loadedChannels.length > 0;

    return {
      currentTime: hasLoadedChannels ? primary.currentTime : 0,
      duration:
        hasLoadedChannels && isUsableDuration(primary.duration)
          ? primary.duration
          : 0,
      isPlaying: hasLoadedChannels && !primary.paused,
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

    await Promise.all(
      getLoadedAudioElements().map((audioElement) => audioElement.play()),
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

    const primary = getPrimaryAudioElement();
    const nextTime = isUsableDuration(primary.duration)
      ? Math.max(0, Math.min(primary.duration, seconds))
      : Math.max(0, seconds);

    setAllCurrentTimes(nextTime);
    notify();
  }

  function seekBy(seconds: number): void {
    if (loadedChannels.length === 0 || !Number.isFinite(seconds)) {
      return;
    }

    seek(getPrimaryAudioElement().currentTime + seconds);
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

  function loadMix(channels: PlaybackChannel[]): void {
    stop();

    loadedChannels = channels.map((channel, index) => {
      const audioElement =
        index === 0 ? primaryAudioElement : createAudioElement();

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

  async function handleEnded(): Promise<void> {
    if (!loopEnabled) {
      stop();
      return;
    }

    seek(0);
    await play();
  }

  primaryAudioElement.addEventListener("timeupdate", notify);
  primaryAudioElement.addEventListener("loadedmetadata", notify);
  primaryAudioElement.addEventListener("ended", handleEnded);

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
  };
}
