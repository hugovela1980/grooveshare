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
    hidden: false as boolean | "until-found",
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

function createPlaybackHarness({
  loadImmediately = true,
}: { loadImmediately?: boolean } = {}) {
  let snapshot: PlaybackSnapshot = {
    currentTime: 0,
    musicalPosition: { bar: 1, beat: 1 },
    duration: 0,
    isPlaying: false,
    hasLoadedChannels: false,
    preparation: {
      status: "idle",
      requiredChannelCount: 0,
      readyRequiredChannelCount: 0,
      channels: [],
      failure: null,
    },
  };
  let listener: PlaybackStateListener | null = null;
  let soughtMusicalPosition: MusicalPosition | null = null;
  let loopEnabled = false;
  let metronomeEnabled = false;
  let playCalls = 0;
  let retryCalls = 0;
  const channelVolumes = new Map<number, number>();
  const channelEnabledStates = new Map<number, boolean>();

  function publish(nextSnapshot: PlaybackSnapshot): void {
    snapshot = nextSnapshot;
    listener?.(snapshot);
  }

  const engine: PlaybackEngine = {
    loadMix(channels: PlaybackChannel[]) {
      channelVolumes.clear();
      channelEnabledStates.clear();
      for (const channel of channels) {
        channelVolumes.set(channel.channelNumber, channel.volume);
        channelEnabledStates.set(channel.channelNumber, channel.enabled);
      }
      publish({
        ...snapshot,
        duration: loadImmediately && channels.length > 0 ? 30 : 0,
        hasLoadedChannels: loadImmediately && channels.length > 0,
        preparation: {
          status: loadImmediately && channels.length > 0 ? "ready" : "preparing",
          requiredChannelCount: channels.length,
          readyRequiredChannelCount: loadImmediately ? channels.length : 0,
          channels: [],
          failure: null,
        },
      });
    },
    async play() {
      playCalls += 1;
      publish({ ...snapshot, isPlaying: true });
    },
    retryPreparation() {
      retryCalls += 1;
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
    setChannelVolume(channelNumber, volume) {
      if (!channelVolumes.has(channelNumber)) return false;
      channelVolumes.set(channelNumber, volume);
      return true;
    },
    setChannelEnabled(channelNumber, enabled) {
      if (!channelEnabledStates.has(channelNumber)) return false;
      channelEnabledStates.set(channelNumber, enabled);
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
    getPlayCalls() {
      return playCalls;
    },
    getRetryCalls() {
      return retryCalls;
    },
    getChannelVolume(channelNumber: number) {
      return channelVolumes.get(channelNumber) ?? null;
    },
    getChannelEnabled(channelNumber: number) {
      return channelEnabledStates.get(channelNumber) ?? null;
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
  tester.it("keeps Play unavailable and refuses an early tap while selected tracks prepare", async () => {
    const playback = createPlaybackHarness({ loadImmediately: false });
    const seekBackwardButton = createButton();
    const seekForwardButton = createButton();
    const playPauseButton = createButton();
    const stopButton = createButton();
    const progressInput = createRangeInput();
    const seekBarInput = createNumberInput();
    const seekBeatInput = createNumberInput();
    const seekBarButton = createButton();

    const controller = createAudioPlayerController({
      playbackEngine: playback.engine,
      seekBackwardButton,
      seekForwardButton,
      playPauseButton,
      stopButton,
      progressInput,
      timestampElement: { textContent: null },
      durationElement: { textContent: null },
      musicalPositionElement: { textContent: null },
      seekBarInput,
      seekBeatInput,
      seekBarButton,
      trackNameElement: { textContent: null },
      loopCheckbox: createCheckbox(),
      metronomeCheckbox: createCheckbox(),
    });

    controller.init();
    controller.loadMix([{
      channelNumber: 1,
      trackId: "track-1",
      name: "Bass",
      playbackDerivativeUrl: "/tracks/track-1/audio",
      volume: 1,
    }]);

    tester.expect(playback.engine.getSnapshot().hasLoadedChannels).toBe(false);
    tester.expect(playPauseButton.disabled).toBe(true);
    tester.expect(seekBackwardButton.disabled).toBe(true);
    tester.expect(stopButton.disabled).toBe(true);

    await playPauseButton.click();
    tester.expect(playback.getPlayCalls()).toBe(0);
  });

  tester.it("shows authoritative preparation progress and a failed-track retry action", async () => {
    const playback = createPlaybackHarness({ loadImmediately: false });
    const preparationElement = { hidden: true, textContent: null as string | null };
    const preparationMessageElement = { textContent: null as string | null };
    const preparationRetryButton = createButton();
    const playPauseButton = createButton();
    const controller = createAudioPlayerController({
      playbackEngine: playback.engine,
      seekBackwardButton: createButton(),
      seekForwardButton: createButton(),
      playPauseButton,
      stopButton: createButton(),
      progressInput: createRangeInput(),
      timestampElement: { textContent: null },
      durationElement: { textContent: null },
      musicalPositionElement: { textContent: null },
      seekBarInput: createNumberInput(),
      seekBeatInput: createNumberInput(),
      seekBarButton: createButton(),
      trackNameElement: { textContent: null },
      preparationElement,
      preparationMessageElement,
      preparationRetryButton,
      loopCheckbox: createCheckbox(),
      metronomeCheckbox: createCheckbox(),
    });

    controller.init();
    controller.loadMix([{
      channelNumber: 1,
      trackId: "track-1",
      name: "Bass",
      playbackDerivativeUrl: "/bass.wav",
      volume: 1,
    }]);
    tester.expect(preparationElement.hidden).toBe(false);
    tester.expect(preparationMessageElement.textContent).toBe(
      "Preparing playback · 0/1 tracks",
    );
    tester.expect(preparationRetryButton.hidden).toBe(true);
    tester.expect(preparationRetryButton.disabled).toBe(true);

    playback.publish({
      ...playback.engine.getSnapshot(),
      preparation: {
        status: "failed",
        requiredChannelCount: 1,
        readyRequiredChannelCount: 0,
        channels: [{
          channelNumber: 1,
          trackId: "track-1",
          required: true,
          status: "failed",
          failureMessage: "Network failure",
          activeSource: null,
          preparedSources: {
            playbackDerivative: "failed",
            original: "unloaded",
          },
        }],
        failure: {
          channelNumber: 1,
          trackId: "track-1",
          message: "Network failure",
        },
      },
    });
    tester.expect(preparationMessageElement.textContent).toBe(
      "Audio unavailable for Bass.",
    );
    tester.expect(preparationRetryButton.hidden).toBe(false);
    await playPauseButton.click();
    tester.expect(playback.getPlayCalls()).toBe(0);
    await preparationRetryButton.click();
    tester.expect(playback.getRetryCalls()).toBe(1);

    playback.publish({
      ...playback.engine.getSnapshot(),
      hasLoadedChannels: true,
      preparation: {
        status: "ready",
        requiredChannelCount: 1,
        readyRequiredChannelCount: 1,
        channels: [{
          channelNumber: 1,
          trackId: "track-1",
          required: true,
          status: "ready",
          failureMessage: null,
          activeSource: null,
          preparedSources: {
            playbackDerivative: "ready",
            original: "failed",
          },
        }],
        failure: null,
      },
    });
    tester.expect(preparationElement.hidden).toBe(true);
    tester.expect(playPauseButton.disabled).toBe(false);
    await playPauseButton.click();
    tester.expect(playback.getPlayCalls()).toBe(1);
  });

  tester.it("renders the diagnostic musical position and bar jump controls", () => {
    const html = renderAudioPlayer({ showMicrophoneControl: true });

    tester.expect(html.includes('id="audio-musical-position"')).toBe(true);
    tester.expect(html.includes("Bar 1 · Beat 1")).toBe(true);
    tester.expect(html.includes('id="audio-seek-bar-input"')).toBe(true);
    tester.expect(html.includes('id="audio-seek-beat-input"')).toBe(true);
    tester.expect(html.includes('id="audio-seek-bar-button"')).toBe(true);
    tester.expect(html.includes('id="audio-seek-forward-button"')).toBe(true);
    tester.expect(html.includes('<span aria-hidden="true">&lt;&lt;</span>')).toBe(true);
    tester.expect(html.includes('<span aria-hidden="true">&gt;&gt;</span>')).toBe(true);
    tester.expect(html.includes('id="microphone-arm-button"')).toBe(true);
    tester.expect(html.includes('id="audio-metronome-checkbox"')).toBe(true);
    tester.expect(html.includes('id="audio-playback-preparation"')).toBe(true);
    tester.expect(html.includes('id="audio-playback-preparation-retry"')).toBe(true);
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
      playbackDerivativeUrl: "/track-1.wav",
      volume: 1,
      enabled: true,
    }]);

    tester.expect(seekBarInput.value).toBe("9");
  });

  tester.it("applies an isolated review mix and restores the cloned project mix", () => {
    const playback = createPlaybackHarness();
    const controller = createAudioPlayerController({
      playbackEngine: playback.engine,
      seekBackwardButton: createButton(),
      playPauseButton: createButton(),
      stopButton: createButton(),
      progressInput: createRangeInput(),
      timestampElement: { textContent: null },
      durationElement: { textContent: null },
      musicalPositionElement: { textContent: null },
      seekBarInput: createNumberInput(),
      seekBarButton: createButton(),
      trackNameElement: { textContent: null },
      loopCheckbox: createCheckbox(),
      metronomeCheckbox: createCheckbox(),
    });
    controller.init();
    controller.loadMix([
      {
        channelNumber: 1,
        trackId: "bass",
        name: "Bass",
        playbackDerivativeUrl: "/bass.wav",
        volume: 0.75,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "vocal",
        name: "Vocal",
        playbackDerivativeUrl: "/vocal.wav",
        volume: 0.72,
        enabled: false,
      },
    ]);

    const reviewMix = controller.getReviewPlaybackMix();
    reviewMix[0]!.volume = 0.4;
    reviewMix[1]!.enabled = true;
    tester.expect(controller.applyReviewPlaybackMix(reviewMix)).toBe(true);
    tester.expect(playback.getChannelVolume(1)).toBe(0.4);
    tester.expect(playback.getChannelEnabled(2)).toBe(true);

    tester.expect(controller.getReviewPlaybackMix()).toEqual([
      {
        channelNumber: 1,
        trackId: "bass",
        name: "Bass",
        volume: 0.75,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "vocal",
        name: "Vocal",
        volume: 0.72,
        enabled: false,
      },
    ]);

    controller.restoreProjectPlaybackMix();
    tester.expect(playback.getChannelVolume(1)).toBe(0.75);
    tester.expect(playback.getChannelEnabled(2)).toBe(false);
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
        playbackDerivativeUrl: "/track-1.wav",
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
      preparation: {
        status: "ready",
        requiredChannelCount: 1,
        readyRequiredChannelCount: 1,
        channels: [{
          channelNumber: 1,
          trackId: "track-1",
          required: true,
          status: "ready",
          failureMessage: null,
          activeSource: "playback-derivative",
          preparedSources: {
            playbackDerivative: "ready",
            original: "fetching",
          },
        }],
        failure: null,
      },
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
      playbackDerivativeUrl: "/track.wav",
      volume: 1,
    }]);
    playback.publish({
      currentTime: 10,
      musicalPosition: { bar: 1, beat: 1 },
      duration: 30,
      isPlaying: false,
      hasLoadedChannels: true,
      preparation: {
        status: "ready",
        requiredChannelCount: 1,
        readyRequiredChannelCount: 1,
        channels: [],
        failure: null,
      },
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
      playbackDerivativeUrl: "/track.wav",
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
      playbackDerivativeUrl: "/track.wav",
      volume: 1,
    }]);

    tester.expect(secondSeekInput.value).toBe("16");
    tester.expect(secondPlayback.getSoughtMusicalPosition()).toEqual({ bar: 16, beat: 1 });

    await secondStopButton.click();
    tester.expect(restoredWorkspace.getAnchor()).toBe(null);
    tester.expect(secondSeekInput.value).toBe("1");
  });

  tester.it("uses the shared workspace anchor for Ready and prepares transport there before recording", () => {
    const workspace = createRecordingWorkspaceState({ projectId: "project-1" });
    const playback = createPlaybackHarness();
    const seekBarInput = createNumberInput("1");
    const seekBeatInput = createNumberInput("1");
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
      seekBeatInput,
      seekBarButton: createButton(),
      trackNameElement: { textContent: null as string | null },
      loopCheckbox: { checked: false },
      metronomeCheckbox: { checked: false },
      recordingWorkspaceState: workspace,
    });

    controller.init();
    controller.loadMix([{
      channelNumber: 1,
      trackId: "track-1",
      name: "Guitar",
      playbackDerivativeUrl: "/track.wav",
      volume: 1,
    }]);
    playback.publish({
      currentTime: 12,
      musicalPosition: { bar: 6, beat: 3.75 },
      duration: 30,
      isPlaying: true,
      hasLoadedChannels: true,
      preparation: {
        status: "ready",
        requiredChannelCount: 1,
        readyRequiredChannelCount: 1,
        channels: [],
        failure: null,
      },
    });

    tester.expect(controller.getRecordingStartPosition()).toEqual({ bar: 6, beat: 3 });
    tester.expect(controller.seekToMusicalPosition({ bar: 8, beat: 2 })).toBe(true);
    tester.expect(workspace.getAnchor()).toEqual({ bar: 8, beat: 2 });
    tester.expect(seekBarInput.value).toBe("8");
    tester.expect(seekBeatInput.value).toBe("2");

    playback.publish({
      currentTime: 18,
      musicalPosition: { bar: 10, beat: 1 },
      duration: 30,
      isPlaying: true,
      hasLoadedChannels: true,
      preparation: {
        status: "ready",
        requiredChannelCount: 1,
        readyRequiredChannelCount: 1,
        channels: [{
          channelNumber: 1,
          trackId: "track-1",
          required: true,
          status: "ready",
          failureMessage: null,
          activeSource: "playback-derivative",
          preparedSources: {
            playbackDerivative: "ready",
            original: "fetching",
          },
        }],
        failure: null,
      },
    });
    tester.expect(controller.prepareRecordingStart({ bar: 8, beat: 2 })).toBe(true);
    tester.expect(playback.engine.getSnapshot().isPlaying).toBe(false);
    tester.expect(playback.getSoughtMusicalPosition()).toEqual({ bar: 8, beat: 2 });
    tester.expect(workspace.getAnchor()).toEqual({ bar: 8, beat: 2 });

    playback.publish({
      currentTime: 18,
      musicalPosition: { bar: 10, beat: 1 },
      duration: 30,
      isPlaying: false,
      hasLoadedChannels: false,
      preparation: {
        status: "preparing",
        requiredChannelCount: 1,
        readyRequiredChannelCount: 0,
        channels: [],
        failure: null,
      },
    });
    tester.expect(controller.prepareRecordingStart({ bar: 9, beat: 1 })).toBe(false);
    tester.expect(playback.getSoughtMusicalPosition()).toEqual({ bar: 8, beat: 2 });
    tester.expect(workspace.getAnchor()).toEqual({ bar: 8, beat: 2 });
  });

});
