import type {
  MusicalPosition,
  PlaybackChannel,
  PlaybackEngine,
  PlaybackSnapshot,
  PlaybackStateListener,
} from "@hugovela/frontend-core";
import { createAudioPlayerController } from "../src/page-controllers/audio-player-controller.js";
import { renderAudioPlayer } from "../src/templates/audio-player.js";
import { tester } from "./test-runner/tester.js";

type Listener = () => void | Promise<void>;

function createButton() {
  let clickHandler: Listener | null = null;

  return {
    disabled: true,
    textContent: null as string | null,
    addEventListener(eventName: "click", handler: Listener) {
      if (eventName === "click") {
        clickHandler = handler;
      }
    },
    async click() {
      await clickHandler?.();
    },
  };
}

function createRangeInput() {
  return {
    disabled: true,
    value: "0",
    addEventListener() {},
  };
}

function createPlaybackHarness() {
  let snapshot: PlaybackSnapshot = {
    currentTime: 0,
    musicalPosition: { bar: 1, beat: 1 },
    duration: 0,
    isPlaying: false,
    hasLoadedChannels: false,
  };
  let listener: PlaybackStateListener | null = null;
  let soughtMusicalPosition: MusicalPosition | null = null;

  function publish(nextSnapshot: PlaybackSnapshot): void {
    snapshot = nextSnapshot;
    listener?.(snapshot);
  }

  const engine: PlaybackEngine = {
    loadMix(channels: PlaybackChannel[]) {
      publish({
        ...snapshot,
        duration: channels.length > 0 ? 30 : 0,
        hasLoadedChannels: channels.length > 0,
      });
    },
    async play() {
      publish({ ...snapshot, isPlaying: true });
    },
    pause() {
      publish({ ...snapshot, isPlaying: false });
    },
    stop() {
      publish({
        ...snapshot,
        currentTime: 0,
        musicalPosition: { bar: 1, beat: 1 },
        isPlaying: false,
      });
    },
    seek(seconds: number) {
      publish({ ...snapshot, currentTime: seconds });
    },
    seekBy(seconds: number) {
      publish({ ...snapshot, currentTime: Math.max(0, snapshot.currentTime + seconds) });
    },
    seekToMusicalPosition(position: MusicalPosition) {
      soughtMusicalPosition = { ...position };
      publish({ ...snapshot, musicalPosition: { ...position } });
    },
    setLoopEnabled() {},
    setChannelVolume() {
      return true;
    },
    setChannelEnabled() {
      return true;
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(nextListener: PlaybackStateListener) {
      listener = nextListener;
      nextListener(snapshot);
      return () => {
        if (listener === nextListener) {
          listener = null;
        }
      };
    },
  };

  return {
    engine,
    publish,
    getSoughtMusicalPosition() {
      return soughtMusicalPosition;
    },
  };
}

tester.describe("mobile musical timeline playback", () => {
  tester.it("renders the diagnostic musical position and bar jump controls", () => {
    const html = renderAudioPlayer();

    tester.expect(html.includes('id="audio-musical-position"')).toBe(true);
    tester.expect(html.includes("Bar 1 · Beat 1")).toBe(true);
    tester.expect(html.includes('id="audio-seek-bar-input"')).toBe(true);
    tester.expect(html.includes('id="audio-seek-bar-button"')).toBe(true);
  });

  tester.it("preserves the go-to-bar value across mix reloads", () => {
    const playback = createPlaybackHarness();
    const seekBarInput = { disabled: true, value: "9" };
    const controller = createAudioPlayerController({
      playbackEngine: playback.engine,
      seekBackwardButton: createButton(),
      playPauseButton: createButton(),
      stopButton: createButton(),
      progressInput: createRangeInput(),
      timestampElement: { textContent: null as string | null },
      durationElement: { textContent: null as string | null },
      musicalPositionElement: { textContent: null as string | null },
      seekBarInput,
      seekBarButton: createButton(),
      trackNameElement: { textContent: null as string | null },
      loopCheckbox: { checked: false },
    });

    controller.init();
    controller.loadMix([{
      channelNumber: 1,
      trackId: "track-1",
      name: "Guitar",
      audioUrl: "/track-1.wav",
      volume: 1,
      enabled: true,
    }]);

    tester.expect(seekBarInput.value).toBe("9");
  });

  tester.it("displays shared musical state and delegates bar jumps to the playback engine", async () => {
    const playback = createPlaybackHarness();
    const seekBackwardButton = createButton();
    const playPauseButton = createButton();
    const stopButton = createButton();
    const seekBarButton = createButton();
    const progressInput = createRangeInput();
    const musicalPositionElement = { textContent: null as string | null };
    const seekBarInput = { disabled: true, value: "1" };

    const controller = createAudioPlayerController({
      playbackEngine: playback.engine,
      seekBackwardButton,
      playPauseButton,
      stopButton,
      progressInput,
      timestampElement: { textContent: null as string | null },
      durationElement: { textContent: null as string | null },
      musicalPositionElement,
      seekBarInput,
      seekBarButton,
      trackNameElement: { textContent: null as string | null },
      loopCheckbox: { checked: false },
    });

    controller.init();
    controller.loadMix([
      {
        channelNumber: 1,
        trackId: "track-1",
        name: "Guitar",
        audioUrl: "/track-1.wav",
        volume: 1,
        enabled: true,
      },
    ]);

    playback.publish({
      currentTime: 2.75,
      musicalPosition: { bar: 2, beat: 2.5 },
      duration: 30,
      isPlaying: true,
      hasLoadedChannels: true,
    });

    tester.expect(musicalPositionElement.textContent).toBe("Bar 2 · Beat 2.5");

    seekBarInput.value = "4";
    await seekBarButton.click();

    tester.expect(playback.getSoughtMusicalPosition()).toEqual({ bar: 4, beat: 1 });
    tester.expect(musicalPositionElement.textContent).toBe("Bar 4 · Beat 1");
  });
});
