import {
  createRecordingWorkspaceState,
  type MusicalPosition,
  type PlaybackChannel,
  type PlaybackEngine,
  type PlaybackSnapshot,
  type PlaybackStateListener,
  type StorageProvider,
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

function createCheckbox(initialChecked = false) {
  let changeHandler: (() => void) | null = null;

  return {
    checked: initialChecked,
    addEventListener(eventName: "change", handler: () => void) {
      if (eventName === "change") changeHandler = handler;
    },
    change(nextChecked: boolean) {
      this.checked = nextChecked;
      changeHandler?.();
    },
  };
}

function createNumberInput(initialValue = "1") {
  let focusHandler: (() => void) | null = null;
  let selectCount = 0;

  return {
    disabled: true,
    value: initialValue,
    addEventListener(eventName: "focus", handler: () => void) {
      if (eventName === "focus") focusHandler = handler;
    },
    select() {
      selectCount += 1;
    },
    focus() {
      focusHandler?.();
    },
    getSelectCount() {
      return selectCount;
    },
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
  let loopEnabled = false;
  let metronomeEnabled = false;

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
    setLoopEnabled(enabled: boolean) {
      loopEnabled = enabled;
    },
    setMetronomeEnabled(enabled: boolean) {
      metronomeEnabled = enabled;
    },
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
    getCurrentTime() {
      return snapshot.currentTime;
    },
    getLoopEnabled() {
      return loopEnabled;
    },
    getMetronomeEnabled() {
      return metronomeEnabled;
    },
    getSoughtMusicalPosition() {
      return soughtMusicalPosition;
    },
  };
}

function createMemoryStorage(): StorageProvider {
  const values = new Map<string, string>();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

tester.describe("mobile musical timeline playback", () => {
  tester.it("renders the diagnostic musical position and bar jump controls", () => {
    const html = renderAudioPlayer({ showMicrophoneControl: true });

    tester.expect(html.includes('id="audio-musical-position"')).toBe(true);
    tester.expect(html.includes("Bar 1 · Beat 1")).toBe(true);
    tester.expect(html.includes('id="audio-seek-bar-input"')).toBe(true);
    tester.expect(html.includes('id="audio-seek-beat-input"')).toBe(true);
    tester.expect(html.includes('id="audio-seek-bar-button"')).toBe(true);
    tester.expect(html.includes('id="audio-seek-forward-button"')).toBe(true);
    tester.expect(html.includes('id="microphone-arm-button"')).toBe(true);
    tester.expect(html.includes('id="audio-metronome-checkbox"')).toBe(true);
    tester.expect(html.includes("Click")).toBe(true);
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
      metronomeCheckbox: { checked: false },
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
      metronomeCheckbox: { checked: false },
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

    tester.expect(musicalPositionElement.textContent).toBe("Bar 2 · Beat 2");

    seekBarInput.value = "4";
    await seekBarButton.click();

    tester.expect(playback.getSoughtMusicalPosition()).toEqual({ bar: 4, beat: 1 });
    tester.expect(musicalPositionElement.textContent).toBe("Bar 4 · Beat 1");
  });

  tester.it("delegates both five-second seeks and bar/beat navigation to shared playback", async () => {
    const playback = createPlaybackHarness();
    const seekBackwardButton = createButton();
    const seekForwardButton = createButton();
    const seekBarButton = createButton();
    const seekBarInput = createNumberInput("4");
    const seekBeatInput = createNumberInput("3");
    const controller = createAudioPlayerController({
      playbackEngine: playback.engine,
      seekBackwardButton,
      seekForwardButton,
      playPauseButton: createButton(),
      stopButton: createButton(),
      progressInput: createRangeInput(),
      timestampElement: { textContent: null as string | null },
      durationElement: { textContent: null as string | null },
      musicalPositionElement: { textContent: null as string | null },
      seekBarInput,
      seekBeatInput,
      seekBarButton,
      trackNameElement: { textContent: null as string | null },
      loopCheckbox: { checked: false },
      metronomeCheckbox: { checked: false },
    });

    controller.init();
    seekBarInput.focus();
    seekBeatInput.focus();
    tester.expect(seekBarInput.getSelectCount()).toBe(1);
    tester.expect(seekBeatInput.getSelectCount()).toBe(1);
    controller.loadMix([{
      channelNumber: 1,
      trackId: "track-1",
      name: "Guitar",
      audioUrl: "/track.wav",
      volume: 1,
    }]);
    playback.publish({
      currentTime: 10,
      musicalPosition: { bar: 1, beat: 1 },
      duration: 30,
      isPlaying: false,
      hasLoadedChannels: true,
    });

    await seekBackwardButton.click();
    tester.expect(playback.getCurrentTime()).toBe(5);
    await seekForwardButton.click();
    tester.expect(playback.getCurrentTime()).toBe(10);
    await seekBarButton.click();
    tester.expect(playback.getSoughtMusicalPosition()).toEqual({ bar: 4, beat: 3 });
  });

  tester.it("delegates Loop and Click switches to shared playback state", () => {
    const playback = createPlaybackHarness();
    const loopCheckbox = createCheckbox();
    const metronomeCheckbox = createCheckbox();
    const controller = createAudioPlayerController({
      playbackEngine: playback.engine,
      seekBackwardButton: createButton(),
      playPauseButton: createButton(),
      stopButton: createButton(),
      progressInput: createRangeInput(),
      timestampElement: { textContent: null as string | null },
      durationElement: { textContent: null as string | null },
      musicalPositionElement: { textContent: null as string | null },
      seekBarInput: { disabled: true, value: "1" },
      seekBarButton: createButton(),
      trackNameElement: { textContent: null as string | null },
      loopCheckbox,
      metronomeCheckbox,
    });

    controller.init();
    loopCheckbox.change(true);
    metronomeCheckbox.change(true);

    tester.expect(playback.getLoopEnabled()).toBe(true);
    tester.expect(playback.getMetronomeEnabled()).toBe(true);
  });

  tester.it("restores the sticky Go anchor after a mobile page reload and clears it only on Stop", async () => {
    const storage = createMemoryStorage();
    const workspace = createRecordingWorkspaceState({
      projectId: "project-1",
      storageProvider: storage,
    });
    const firstPlayback = createPlaybackHarness();
    const firstGoButton = createButton();
    const firstStopButton = createButton();
    const firstSeekInput = { disabled: true, value: "1" };
    const first = createAudioPlayerController({
      playbackEngine: firstPlayback.engine,
      seekBackwardButton: createButton(),
      playPauseButton: createButton(),
      stopButton: firstStopButton,
      progressInput: createRangeInput(),
      timestampElement: { textContent: null as string | null },
      durationElement: { textContent: null as string | null },
      musicalPositionElement: { textContent: null as string | null },
      seekBarInput: firstSeekInput,
      seekBarButton: firstGoButton,
      trackNameElement: { textContent: null as string | null },
      loopCheckbox: { checked: false },
      metronomeCheckbox: { checked: false },
      recordingWorkspaceState: workspace,
    });
    first.init();
    first.loadMix([{
      channelNumber: 1,
      trackId: "track-1",
      name: "Guitar",
      audioUrl: "/track.wav",
      volume: 1,
    }]);
    firstSeekInput.value = "16";
    await firstGoButton.click();
    tester.expect(workspace.getAnchor()).toEqual({ bar: 16, beat: 1 });

    first.stop({ resetWorkspaceAnchor: false });
    tester.expect(workspace.getAnchor()).toEqual({ bar: 16, beat: 1 });

    const restoredWorkspace = createRecordingWorkspaceState({
      projectId: "project-1",
      storageProvider: storage,
    });
    const secondPlayback = createPlaybackHarness();
    const secondStopButton = createButton();
    const secondSeekInput = { disabled: true, value: "1" };
    const second = createAudioPlayerController({
      playbackEngine: secondPlayback.engine,
      seekBackwardButton: createButton(),
      playPauseButton: createButton(),
      stopButton: secondStopButton,
      progressInput: createRangeInput(),
      timestampElement: { textContent: null as string | null },
      durationElement: { textContent: null as string | null },
      musicalPositionElement: { textContent: null as string | null },
      seekBarInput: secondSeekInput,
      seekBarButton: createButton(),
      trackNameElement: { textContent: null as string | null },
      loopCheckbox: { checked: false },
      metronomeCheckbox: { checked: false },
      recordingWorkspaceState: restoredWorkspace,
    });
    second.init();
    second.loadMix([{
      channelNumber: 1,
      trackId: "track-1",
      name: "Guitar",
      audioUrl: "/track.wav",
      volume: 1,
    }]);

    tester.expect(secondSeekInput.value).toBe("16");
    tester.expect(secondPlayback.getSoughtMusicalPosition()).toEqual({ bar: 16, beat: 1 });

    await secondStopButton.click();
    tester.expect(restoredWorkspace.getAnchor()).toBe(null);
    tester.expect(secondSeekInput.value).toBe("1");
  });

});
