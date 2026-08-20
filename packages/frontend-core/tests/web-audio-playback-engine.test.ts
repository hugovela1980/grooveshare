import {
  createWebAudioPlaybackEngine,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

type FakeBuffer = {
  duration: number;
};

type FakeGainNode = ReturnType<typeof createFakeGainNode>;
type FakeSource = ReturnType<typeof createFakeSource>;

function createFakeGainNode() {
  return {
    gain: {
      value: 1,
      setValueAtTime(value: number) {
        this.value = value;
      },
    },
    connectedDestination: null as unknown,
    disconnected: false,
    connect(destination: unknown) {
      this.connectedDestination = destination;
      return destination;
    },
    disconnect() {
      this.disconnected = true;
    },
  };
}

function createFakeSource() {
  return {
    buffer: null as FakeBuffer | null,
    onended: null as (() => void) | null,
    connectedDestination: null as unknown,
    startWhen: null as number | null,
    startOffset: null as number | null,
    stopCallCount: 0,
    disconnected: false,
    connect(destination: unknown) {
      this.connectedDestination = destination;
      return destination;
    },
    start(when = 0, offset = 0) {
      this.startWhen = when;
      this.startOffset = offset;
    },
    stop() {
      this.stopCallCount += 1;
    },
    disconnect() {
      this.disconnected = true;
    },
  };
}

function createFakeAudioContext() {
  const gainNodes: FakeGainNode[] = [];
  const sources: FakeSource[] = [];

  return {
    currentTime: 10,
    state: "suspended",
    destination: { name: "destination" },
    resumeCallCount: 0,
    closeCallCount: 0,
    gainNodes,
    sources,
    createGain() {
      const gainNode = createFakeGainNode();
      gainNodes.push(gainNode);
      return gainNode;
    },
    createBufferSource() {
      const source = createFakeSource();
      sources.push(source);
      return source;
    },
    async decodeAudioData(audioData: ArrayBuffer): Promise<FakeBuffer> {
      const duration = new Uint8Array(audioData)[0] ?? 0;
      return { duration };
    },
    async resume() {
      this.resumeCallCount += 1;
      this.state = "running";
    },
    async close() {
      this.closeCallCount += 1;
      this.state = "closed";
    },
  };
}

function createEngineHarness() {
  const audioContext = createFakeAudioContext();
  const fetchedUrls: string[] = [];
  const durationsByUrl = new Map<string, number>([
    ["/drums.wav", 60],
    ["/bass.wav", 60],
    ["/loop.wav", 10],
    ["/long-take.m4a", 60],
  ]);

  const engine = createWebAudioPlaybackEngine({
    audioContext,
    async fetchAudioData(audioUrl) {
      fetchedUrls.push(audioUrl);
      const duration = durationsByUrl.get(audioUrl) ?? 60;
      return new Uint8Array([duration]).buffer;
    },
    scheduleInterval() {
      return { fakeInterval: true };
    },
    clearScheduledInterval() {},
    onLoadError(error) {
      throw error;
    },
  });

  return {
    audioContext,
    engine,
    fetchedUrls,
  };
}

const twoChannelMix = [
  {
    channelNumber: 1,
    trackId: "track-1",
    audioUrl: "/drums.wav",
    volume: 0.8,
    enabled: true,
  },
  {
    channelNumber: 2,
    trackId: "track-2",
    audioUrl: "/bass.wav",
    volume: 0.5,
    enabled: true,
  },
];

tester.describe("WebAudioPlaybackEngine", () => {
  tester.it("fetches and decodes every track before scheduling them on one clock", async () => {
    const { audioContext, engine, fetchedUrls } = createEngineHarness();

    engine.loadMix(twoChannelMix);
    tester.expect(engine.getSnapshot().hasLoadedChannels).toBe(false);

    await engine.play();

    tester.expect(fetchedUrls).toEqual(["/drums.wav", "/bass.wav"]);
    tester.expect(audioContext.resumeCallCount).toBe(1);
    tester.expect(audioContext.sources.length).toBe(2);
    tester.expect(audioContext.sources[0]?.startWhen).toBe(
      audioContext.sources[1]?.startWhen,
    );
    tester.expect(audioContext.sources[0]?.startWhen).toBe(10.03);
    tester.expect(audioContext.sources[0]?.startOffset).toBe(0);
    tester.expect(audioContext.sources[1]?.startOffset).toBe(0);
    tester.expect(engine.getSnapshot().duration).toBe(60);
    tester.expect(engine.getSnapshot().isPlaying).toBe(true);

    engine.destroy?.();
  });

  tester.it("pauses and resumes all tracks from the same transport position", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix(twoChannelMix);
    await engine.play();

    const firstStartTime = audioContext.sources[0]?.startWhen ?? 0;
    audioContext.currentTime = firstStartTime + 12;
    engine.pause();

    tester.expect(
      Math.abs(engine.getSnapshot().currentTime - 12) < 0.000001,
    ).toBe(true);
    tester.expect(engine.getSnapshot().isPlaying).toBe(false);
    tester.expect(audioContext.sources[0]?.stopCallCount).toBe(1);
    tester.expect(audioContext.sources[1]?.stopCallCount).toBe(1);

    await engine.play();

    const resumedSources = audioContext.sources.slice(-2);
    tester.expect(resumedSources[0]?.startWhen).toBe(
      resumedSources[1]?.startWhen,
    );
    tester.expect(resumedSources[0]?.startWhen).toBe(
      audioContext.currentTime + 0.03,
    );
    tester.expect(
      Math.abs((resumedSources[0]?.startOffset ?? 0) - 12) < 0.000001,
    ).toBe(true);
    tester.expect(
      Math.abs((resumedSources[1]?.startOffset ?? 0) - 12) < 0.000001,
    ).toBe(true);

    engine.destroy?.();
  });

  tester.it("recreates playing sources together when seeking", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix(twoChannelMix);
    await engine.play();
    const originalSourceCount = audioContext.sources.length;

    audioContext.currentTime = 25;
    engine.seek(30);

    tester.expect(audioContext.sources[0]?.stopCallCount).toBe(1);
    tester.expect(audioContext.sources[1]?.stopCallCount).toBe(1);
    tester.expect(audioContext.sources.length).toBe(originalSourceCount + 2);
    const soughtSources = audioContext.sources.slice(-2);
    tester.expect(soughtSources[0]?.startWhen).toBe(soughtSources[1]?.startWhen);
    tester.expect(soughtSources[0]?.startWhen).toBe(25.03);
    tester.expect(soughtSources[0]?.startOffset).toBe(30);
    tester.expect(soughtSources[1]?.startOffset).toBe(30);

    engine.seekBy(-5);
    const relativeSeekSources = audioContext.sources.slice(-2);
    tester.expect(relativeSeekSources[0]?.startOffset).toBe(25);
    tester.expect(relativeSeekSources[1]?.startOffset).toBe(25);

    engine.destroy?.();
  });

  tester.it("uses GainNodes for live volume and enable changes without restarting sources", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix(twoChannelMix);
    await engine.play();
    const sourceCount = audioContext.sources.length;

    tester.expect(engine.setChannelVolume(1, 0.35)).toBe(true);
    tester.expect(audioContext.gainNodes[0]?.gain.value).toBe(0.35);
    tester.expect(audioContext.sources.length).toBe(sourceCount);

    tester.expect(engine.setChannelEnabled(1, false)).toBe(true);
    tester.expect(audioContext.gainNodes[0]?.gain.value).toBe(0);
    tester.expect(audioContext.sources.length).toBe(sourceCount);

    tester.expect(engine.setChannelVolume(1, 0.7)).toBe(true);
    tester.expect(audioContext.gainNodes[0]?.gain.value).toBe(0);
    tester.expect(audioContext.sources.length).toBe(sourceCount);

    tester.expect(engine.setChannelEnabled(1, true)).toBe(true);
    tester.expect(audioContext.gainNodes[0]?.gain.value).toBe(0.7);
    tester.expect(audioContext.sources.length).toBe(sourceCount);

    engine.destroy?.();
  });

  tester.it("uses the longest decoded track as the transport duration", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix([
      {
        channelNumber: 1,
        trackId: "track-1",
        audioUrl: "/loop.wav",
        volume: 1,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "track-2",
        audioUrl: "/long-take.m4a",
        volume: 1,
        enabled: true,
      },
    ]);
    await engine.play();

    tester.expect(engine.getSnapshot().duration).toBe(60);
    tester.expect(audioContext.sources.length).toBe(2);

    const startTime = audioContext.sources[0]?.startWhen ?? 0;
    audioContext.currentTime = startTime + 20;
    engine.pause();
    await engine.play();

    const resumedSources = audioContext.sources.slice(-1);
    tester.expect(resumedSources.length).toBe(1);
    tester.expect(resumedSources[0]?.startOffset).toBe(20);

    engine.destroy?.();
  });

  tester.it("lets shorter tracks end without ending the shared transport", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix([
      {
        channelNumber: 1,
        trackId: "short-track",
        audioUrl: "/loop.wav",
        volume: 1,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "long-track",
        audioUrl: "/long-take.m4a",
        volume: 1,
        enabled: true,
      },
    ]);
    await engine.play();

    const shortSource = audioContext.sources[0];
    const longSource = audioContext.sources[1];
    tester.expect(shortSource?.startWhen).toBe(longSource?.startWhen);
    tester.expect(shortSource?.startOffset).toBe(longSource?.startOffset);
    tester.expect(shortSource?.onended).toBe(null);
    tester.expect(longSource?.onended !== null).toBe(true);

    const sharedStartTime = longSource?.startWhen ?? 0;
    audioContext.currentTime = sharedStartTime + 20;

    tester.expect(engine.getSnapshot().duration).toBe(60);
    tester.expect(engine.getSnapshot().isPlaying).toBe(true);
    tester.expect(
      Math.abs(engine.getSnapshot().currentTime - 20) < 0.000001,
    ).toBe(true);

    engine.destroy?.();
  });

  tester.it("restarts every track from zero on one shared clock when looping", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix(twoChannelMix);
    engine.setLoopEnabled(true);
    await engine.play();

    const firstGeneration = audioContext.sources.slice(0, 2);
    const anchorSource = firstGeneration[0];
    tester.expect(anchorSource?.onended !== null).toBe(true);

    audioContext.currentTime = (anchorSource?.startWhen ?? 0) + 60;
    anchorSource?.onended?.();

    const loopSources = audioContext.sources.slice(-2);
    tester.expect(loopSources[0]?.startWhen).toBe(loopSources[1]?.startWhen);
    tester.expect(loopSources[0]?.startOffset).toBe(0);
    tester.expect(loopSources[1]?.startOffset).toBe(0);
    tester.expect(engine.getSnapshot().isPlaying).toBe(true);

    const loopStartTime = loopSources[0]?.startWhen ?? 0;
    audioContext.currentTime = loopStartTime + 1;
    tester.expect(
      Math.abs(engine.getSnapshot().currentTime - 1) < 0.000001,
    ).toBe(true);

    engine.destroy?.();
  });
});
