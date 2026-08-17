import {
  createHtmlAudioPlaybackEngine,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

type Listener = () => void | Promise<void>;

function createFakeAudioElement() {
  const listeners = new Map<string, Listener>();

  return {
    src: "",
    crossOrigin: null as string | null,
    currentTime: 0,
    duration: 120,
    paused: true,
    volume: 1,
    playCallCount: 0,
    pauseCallCount: 0,
    loadCallCount: 0,
    async play() {
      this.playCallCount += 1;
      this.paused = false;
    },
    pause() {
      this.pauseCallCount += 1;
      this.paused = true;
    },
    load() {
      this.loadCallCount += 1;
    },
    addEventListener(eventName: string, handler: Listener) {
      listeners.set(eventName, handler);
    },
    async trigger(eventName: string) {
      await listeners.get(eventName)?.();
    },
  };
}

tester.describe("HtmlAudioPlaybackEngine", () => {
  tester.it("loads and plays multiple HTML audio channels behind one contract", async () => {
    const first = createFakeAudioElement();
    const second = createFakeAudioElement();
    const engine = createHtmlAudioPlaybackEngine({
      primaryAudioElement: first,
      createAudioElement: () => second,
    });

    engine.loadMix([
      {
        channelNumber: 1,
        trackId: "track-1",
        audioUrl: "/drums.wav",
        volume: 0.75,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "track-2",
        audioUrl: "/bass.wav",
        volume: 0.4,
        enabled: true,
      },
    ]);

    tester.expect(first.src).toBe("/drums.wav");
    tester.expect(second.src).toBe("/bass.wav");
    tester.expect(first.volume).toBe(0.75);
    tester.expect(second.volume).toBe(0.4);
    tester.expect(engine.getSnapshot().hasLoadedChannels).toBe(true);

    await engine.play();

    tester.expect(first.playCallCount).toBe(1);
    tester.expect(second.playCallCount).toBe(1);
    tester.expect(engine.getSnapshot().isPlaying).toBe(true);
  });

  tester.it("seeks every loaded channel through absolute and relative seek", () => {
    const first = createFakeAudioElement();
    const second = createFakeAudioElement();
    const engine = createHtmlAudioPlaybackEngine({
      primaryAudioElement: first,
      createAudioElement: () => second,
    });

    engine.loadMix([
      { channelNumber: 1, trackId: "track-1", audioUrl: "/1.wav", volume: 1, enabled: true },
      { channelNumber: 2, trackId: "track-2", audioUrl: "/2.wav", volume: 1, enabled: true },
    ]);

    engine.seek(50);
    tester.expect(first.currentTime).toBe(50);
    tester.expect(second.currentTime).toBe(50);

    engine.seekBy(-5);
    tester.expect(first.currentTime).toBe(45);
    tester.expect(second.currentTime).toBe(45);

    engine.seekBy(-100);
    tester.expect(first.currentTime).toBe(0);
    tester.expect(second.currentTime).toBe(0);
  });

  tester.it("updates channel volume and enable state without rebuilding the mix", () => {
    const first = createFakeAudioElement();
    const engine = createHtmlAudioPlaybackEngine({
      primaryAudioElement: first,
      createAudioElement: createFakeAudioElement,
    });

    engine.loadMix([
      { channelNumber: 1, trackId: "track-1", audioUrl: "/1.wav", volume: 0.8, enabled: true },
    ]);
    const loadCount = first.loadCallCount;

    tester.expect(engine.setChannelVolume(1, 0.35)).toBe(true);
    tester.expect(first.volume).toBe(0.35);
    tester.expect(engine.setChannelEnabled(1, false)).toBe(true);
    tester.expect(first.volume).toBe(0);
    tester.expect(engine.setChannelVolume(1, 0.6)).toBe(true);
    tester.expect(first.volume).toBe(0);
    tester.expect(engine.setChannelEnabled(1, true)).toBe(true);
    tester.expect(first.volume).toBe(0.6);
    tester.expect(first.loadCallCount).toBe(loadCount);
  });

  tester.it("loops from zero when the primary HTML audio element ends", async () => {
    const first = createFakeAudioElement();
    const second = createFakeAudioElement();
    const engine = createHtmlAudioPlaybackEngine({
      primaryAudioElement: first,
      createAudioElement: () => second,
    });

    engine.loadMix([
      { channelNumber: 1, trackId: "track-1", audioUrl: "/1.wav", volume: 1, enabled: true },
      { channelNumber: 2, trackId: "track-2", audioUrl: "/2.wav", volume: 1, enabled: true },
    ]);
    engine.setLoopEnabled(true);
    await engine.play();
    first.currentTime = 120;
    second.currentTime = 120;

    await first.trigger("ended");

    tester.expect(first.currentTime).toBe(0);
    tester.expect(second.currentTime).toBe(0);
    tester.expect(first.playCallCount).toBe(2);
    tester.expect(second.playCallCount).toBe(2);
  });

  tester.it("publishes playback snapshots without exposing HTML audio elements", async () => {
    const first = createFakeAudioElement();
    const snapshots: unknown[] = [];
    const engine = createHtmlAudioPlaybackEngine({
      primaryAudioElement: first,
      createAudioElement: createFakeAudioElement,
    });

    engine.subscribe((snapshot) => snapshots.push(snapshot));
    engine.loadMix([
      { channelNumber: 1, trackId: "track-1", audioUrl: "/1.wav", volume: 1, enabled: true },
    ]);
    first.currentTime = 30;
    first.duration = 120;
    await first.trigger("timeupdate");

    tester.expect(snapshots[snapshots.length - 1]).toEqual({
      currentTime: 30,
      duration: 120,
      isPlaying: false,
      hasLoadedChannels: true,
    });
  });
});

