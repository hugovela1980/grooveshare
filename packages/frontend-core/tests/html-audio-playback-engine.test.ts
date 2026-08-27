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
  tester.it("applies signed alignment to source seeks and converts source time back to project time", () => {
    for (const alignmentOffsetSeconds of [-0.1, 0, 0.1]) {
      const audio = createFakeAudioElement();
      const engine = createHtmlAudioPlaybackEngine({ primaryAudioElement: audio, createAudioElement: createFakeAudioElement });
      engine.loadMix([{
        channelNumber: 1, trackId: "take", audioUrl: "/take.wav", volume: 0.6,
        enabled: true, timelineOffsetSeconds: 4, mediaLeadInSeconds: 2,
        alignmentOffsetSeconds,
      }]);
      engine.seek(6);
      tester.expect(Math.abs(audio.currentTime - (4 - alignmentOffsetSeconds)) < 1e-9).toBe(true);
      tester.expect(Math.abs(engine.getSnapshot().currentTime - 6) < 1e-9).toBe(true);
      audio.currentTime += 0.5;
      tester.expect(Math.abs(engine.getSnapshot().currentTime - 6.5) < 1e-9).toBe(true);
      tester.expect(audio.volume).toBe(0.6);
      engine.destroy?.();
    }
  });
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

  tester.it("preserves the working position when a refreshed mix replaces the loaded channels", () => {
    const first = createFakeAudioElement();
    const second = createFakeAudioElement();
    const engine = createHtmlAudioPlaybackEngine({
      primaryAudioElement: first,
      createAudioElement: () => second,
    });

    engine.loadMix([{
      channelNumber: 1,
      trackId: "track-1",
      audioUrl: "/first.wav",
      volume: 1,
      enabled: true,
    }]);
    engine.seek(22);

    engine.loadMix([
      {
        channelNumber: 1,
        trackId: "track-1",
        audioUrl: "/first.wav",
        volume: 1,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "track-2",
        audioUrl: "/second.wav",
        volume: 1,
        enabled: true,
      },
    ]);

    tester.expect(engine.getSnapshot().currentTime).toBe(22);
    tester.expect(first.currentTime).toBe(22);
    tester.expect(second.currentTime).toBe(22);
  });

  tester.it("maps musical seeks into each track's persisted musical placement", () => {
    const first = createFakeAudioElement();
    const second = createFakeAudioElement();
    const engine = createHtmlAudioPlaybackEngine({
      primaryAudioElement: first,
      createAudioElement: () => second,
      musicalTimeline: {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      },
    });

    engine.loadMix([
      {
        channelNumber: 1,
        trackId: "track-1",
        audioUrl: "/rhythm.wav",
        volume: 1,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "track-2",
        audioUrl: "/late-take.wav",
        volume: 1,
        enabled: true,
        musicalPlacement: {
          start: { bar: 2, beat: 1 },
          spanBeats: 4,
        },
      },
    ]);

    engine.seekToMusicalPosition({ bar: 2, beat: 2 });

    tester.expect(first.currentTime).toBe(2.5);
    tester.expect(second.currentTime).toBe(0.5);
    tester.expect(engine.getSnapshot().currentTime).toBe(2.5);
    tester.expect(engine.getSnapshot().musicalPosition).toEqual({
      bar: 2,
      beat: 2,
    });
  });

  tester.it("skips captured count-in lead-in without moving fallback musical placement", () => {
    const first = createFakeAudioElement();
    first.duration = 12.43;
    const engine = createHtmlAudioPlaybackEngine({
      primaryAudioElement: first,
      createAudioElement: createFakeAudioElement,
      musicalTimeline: {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      },
    });

    engine.loadMix([{
      channelNumber: 1,
      trackId: "recorded-take",
      audioUrl: "/take.webm",
      volume: 1,
      enabled: true,
      musicalPlacement: { start: { bar: 2, beat: 1 }, spanBeats: 20 },
      mediaLeadInSeconds: 2.43,
    }]);

    engine.seekToMusicalPosition({ bar: 2, beat: 1 });

    tester.expect(first.currentTime).toBe(2.43);
    tester.expect(Math.abs(engine.getSnapshot().currentTime - 2) < 1e-9).toBe(true);
    tester.expect(Math.abs(engine.getSnapshot().duration - 12) < 1e-9).toBe(true);
  });

  tester.it("keeps placed tracks aligned when seeking during fallback playback", async () => {
    const first = createFakeAudioElement();
    const second = createFakeAudioElement();
    const engine = createHtmlAudioPlaybackEngine({
      primaryAudioElement: first,
      createAudioElement: () => second,
      musicalTimeline: {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      },
    });

    engine.loadMix([
      {
        channelNumber: 1,
        trackId: "track-1",
        audioUrl: "/rhythm.wav",
        volume: 1,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "track-2",
        audioUrl: "/late-take.wav",
        volume: 1,
        enabled: true,
        musicalPlacement: {
          start: { bar: 2, beat: 1 },
          spanBeats: 4,
        },
      },
    ]);

    await engine.play();
    tester.expect(first.playCallCount).toBe(1);
    tester.expect(second.playCallCount).toBe(0);

    engine.seekToMusicalPosition({ bar: 2, beat: 2 });
    tester.expect(first.currentTime).toBe(2.5);
    tester.expect(second.currentTime).toBe(0.5);
    tester.expect(first.playCallCount).toBe(2);
    tester.expect(second.playCallCount).toBe(1);
    tester.expect(second.paused).toBe(false);

    engine.stop();
    engine.destroy?.();
  });

  tester.it("uses the longest loaded track as the transport duration", async () => {
    const first = createFakeAudioElement();
    const second = createFakeAudioElement();
    first.duration = 10;
    second.duration = 60;
    const engine = createHtmlAudioPlaybackEngine({
      primaryAudioElement: first,
      createAudioElement: () => second,
    });

    engine.loadMix([
      { channelNumber: 1, trackId: "track-1", audioUrl: "/loop.wav", volume: 1, enabled: true },
      { channelNumber: 2, trackId: "track-2", audioUrl: "/long-take.m4a", volume: 1, enabled: true },
    ]);

    await second.trigger("loadedmetadata");

    tester.expect(engine.getSnapshot().duration).toBe(60);

    engine.seek(50);
    tester.expect(first.currentTime).toBe(10);
    tester.expect(second.currentTime).toBe(50);
    tester.expect(engine.getSnapshot().currentTime).toBe(50);
  });

  tester.it("lets a longer non-primary track continue after a shorter track ends", async () => {
    const first = createFakeAudioElement();
    const second = createFakeAudioElement();
    first.duration = 10;
    second.duration = 60;
    const engine = createHtmlAudioPlaybackEngine({
      primaryAudioElement: first,
      createAudioElement: () => second,
    });

    engine.loadMix([
      { channelNumber: 1, trackId: "track-1", audioUrl: "/loop.wav", volume: 1, enabled: true },
      { channelNumber: 2, trackId: "track-2", audioUrl: "/long-take.m4a", volume: 1, enabled: true },
    ]);
    await engine.play();

    first.currentTime = 10;
    first.paused = true;
    second.currentTime = 10;
    second.paused = false;
    await first.trigger("ended");

    tester.expect(second.pauseCallCount).toBe(0);
    tester.expect(engine.getSnapshot().duration).toBe(60);
    tester.expect(engine.getSnapshot().currentTime).toBe(10);
    tester.expect(engine.getSnapshot().isPlaying).toBe(true);

    second.currentTime = 25;
    await second.trigger("timeupdate");
    tester.expect(engine.getSnapshot().currentTime).toBe(25);
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
      musicalPosition: { bar: 16, beat: 1 },
      duration: 120,
      isPlaying: false,
      hasLoadedChannels: true,
    });
  });
});

