import {
  createWebAudioPlaybackEngine,
  type PlaybackEngine,
  type RecordingAlignmentDiagnosticObservation,
  type RecordingAlignmentDiagnosticsPort,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

type FakeBuffer = {
  duration: number;
};

type FakeGainNode = ReturnType<typeof createFakeGainNode>;
type FakeSource = ReturnType<typeof createFakeSource>;
type FakeOscillator = ReturnType<typeof createFakeOscillator>;

function createFakeGainNode() {
  return {
    gain: {
      value: 1,
      setValueAtTime(value: number) {
        this.value = value;
      },
      linearRampToValueAtTime(value: number) {
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


function createFakeOscillator() {
  return {
    type: "sine",
    frequency: { value: 0 },
    connectedDestination: null as unknown,
    startWhen: null as number | null,
    stopWhen: null as number | null,
    disconnected: false,
    connect(destination: unknown) {
      this.connectedDestination = destination;
      return destination;
    },
    start(when = 0) {
      this.startWhen = when;
    },
    stop(when = 0) {
      this.stopWhen = when;
    },
    disconnect() {
      this.disconnected = true;
    },
  };
}

function createFakeAudioContext() {
  const gainNodes: FakeGainNode[] = [];
  const sources: FakeSource[] = [];
  const oscillators: FakeOscillator[] = [];

  return {
    currentTime: 10,
    state: "suspended",
    sampleRate: 48000,
    sinkId: "default",
    baseLatency: 0.004,
    outputLatency: 0.023,
    destination: { name: "destination" },
    resumeCallCount: 0,
    closeCallCount: 0,
    gainNodes,
    sources,
    oscillators,
    createGain() {
      const gainNode = createFakeGainNode();
      gainNodes.push(gainNode);
      return gainNode;
    },
    createOscillator() {
      const oscillator = createFakeOscillator();
      oscillators.push(oscillator);
      return oscillator;
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

async function waitForPlaybackReady(engine: PlaybackEngine): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const preparation = engine.getSnapshot().preparation;
    if (preparation.status === "ready") {
      return;
    }
    if (preparation.status === "failed") {
      throw new Error(preparation.failure?.message ?? "Playback preparation failed.");
    }
    await Promise.resolve();
  }

  throw new Error("Playback preparation did not settle.");
}

function createEngineHarness(
  musicalTimeline = {
    bpm: 120,
    timeSignature: { numerator: 4, denominator: 4 },
  },
) {
  const audioContext = createFakeAudioContext();
  const fetchedUrls: string[] = [];
  let intervalHandler: (() => void) | null = null;
  const durationsByUrl = new Map<string, number>([
    ["/drums.wav", 60],
    ["/bass.wav", 60],
    ["/loop.wav", 10],
    ["/long-take.m4a", 60],
    ["/recorded-take.webm", 2],
  ]);

  const rawEngine = createWebAudioPlaybackEngine({
    audioContext,
    musicalTimeline,
    async fetchAudioData(audioUrl) {
      fetchedUrls.push(audioUrl);
      const duration = durationsByUrl.get(audioUrl) ?? 60;
      return new Uint8Array([duration]).buffer;
    },
    scheduleInterval(handler) {
      intervalHandler = handler;
      return { fakeInterval: true };
    },
    clearScheduledInterval() {
      intervalHandler = null;
    },
    onLoadError(error) {
      throw error;
    },
  });
  const engine: PlaybackEngine = {
    ...rawEngine,
    async play() {
      await waitForPlaybackReady(rawEngine);
      await rawEngine.play();
    },
    async startSynchronizedRecordingPlayback(options) {
      await waitForPlaybackReady(rawEngine);
      return rawEngine.startSynchronizedRecordingPlayback!(options);
    },
    async auditionRecordedTake(options) {
      await waitForPlaybackReady(rawEngine);
      return rawEngine.auditionRecordedTake!(options);
    },
  };

  return {
    audioContext,
    engine,
    rawEngine,
    fetchedUrls,
    tickTransport() {
      intervalHandler?.();
    },
  };
}

const twoChannelMix = [
  {
    channelNumber: 1,
    trackId: "track-1",
    playbackDerivativeUrl: "/drums.wav",
    volume: 0.8,
    enabled: true,
  },
  {
    channelNumber: 2,
    trackId: "track-2",
    playbackDerivativeUrl: "/bass.wav",
    volume: 0.5,
    enabled: true,
  },
];

tester.describe("WebAudioPlaybackEngine", () => {
  tester.it("publishes explicit required-track readiness and refuses early Play without queuing it", async () => {
    const { rawEngine, audioContext } = createEngineHarness();
    rawEngine.loadMix(twoChannelMix);

    const preparing = rawEngine.getSnapshot();
    tester.expect(preparing.preparation.status).toBe("preparing");
    tester.expect(preparing.preparation.requiredChannelCount).toBe(2);
    tester.expect(preparing.preparation.readyRequiredChannelCount).toBe(0);

    await rawEngine.play();
    tester.expect(audioContext.resumeCallCount).toBe(0);
    tester.expect(rawEngine.getSnapshot().isPlaying).toBe(false);

    await waitForPlaybackReady(rawEngine);
    tester.expect(rawEngine.getSnapshot().isPlaying).toBe(false);
    await rawEngine.play();
    tester.expect(rawEngine.getSnapshot().isPlaying).toBe(true);
    rawEngine.destroy?.();
  });

  tester.it("publishes fetching and decoding as distinct not-ready states", async () => {
    const audioContext = createFakeAudioContext();
    let resolveFetch: ((audioData: ArrayBuffer) => void) | null = null;
    let resolveDecode: ((buffer: FakeBuffer) => void) | null = null;
    const fetchedAudio = new Promise<ArrayBuffer>((resolve) => {
      resolveFetch = resolve;
    });
    const decodedAudio = new Promise<FakeBuffer>((resolve) => {
      resolveDecode = resolve;
    });
    audioContext.decodeAudioData = () => decodedAudio;
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      fetchAudioData() {
        return fetchedAudio;
      },
      scheduleInterval() { return {}; },
      clearScheduledInterval() {},
      onLoadError() {},
    });

    engine.loadMix([{
      channelNumber: 1,
      trackId: "state-track",
      playbackDerivativeUrl: "/state/playback-derivative",
      volume: 1,
      enabled: true,
    }]);
    tester.expect(engine.getSnapshot().preparation.status).toBe("preparing");
    tester.expect(engine.getSnapshot().preparation.channels[0]?.status).toBe(
      "fetching",
    );

    resolveFetch!(new Uint8Array([24]).buffer);
    await Promise.resolve();
    tester.expect(engine.getSnapshot().preparation.status).toBe("preparing");
    tester.expect(engine.getSnapshot().preparation.channels[0]?.status).toBe(
      "decoding",
    );

    resolveDecode!({ duration: 24 });
    await waitForPlaybackReady(engine);
    tester.expect(engine.getSnapshot().preparation.channels[0]?.status).toBe(
      "ready",
    );
    engine.destroy?.();
  });

  tester.it("uses derivatives exclusively under the derivative-only policy", async () => {
    const audioContext = createFakeAudioContext();
    const fetchedUrls: string[] = [];
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      mediaPreparationPolicy: "derivative-only",
      async fetchAudioData(url) {
        fetchedUrls.push(url);
        return new Uint8Array([24]).buffer;
      },
      scheduleInterval() { return {}; },
      clearScheduledInterval() {},
      onLoadError() {},
    });

    engine.loadMix([{
      channelNumber: 1,
      trackId: "derivative-only-track",
      playbackDerivativeUrl: "/tracks/1/playback-derivative",
      originalAudioUrl: "/tracks/1/audio",
      volume: 1,
      enabled: true,
    }]);

    await waitForPlaybackReady(engine);
    const prepared = engine.getSnapshot().preparation.channels[0]!;
    tester.expect(fetchedUrls).toEqual(["/tracks/1/playback-derivative"]);
    tester.expect(prepared.activeSource).toBe(null);
    tester.expect(prepared.preparedSources.playbackDerivative).toBe("ready");
    tester.expect(prepared.preparedSources.original).toBe("unloaded");

    await engine.play();
    tester.expect(audioContext.sources[0]?.buffer?.duration).toBe(24);
    tester.expect(
      engine.getSnapshot().preparation.channels[0]?.activeSource,
    ).toBe("playback-derivative");

    engine.seek(3);
    tester.expect(audioContext.sources.at(-1)?.buffer?.duration).toBe(24);
    engine.setLoopEnabled(true);
    tester.expect(audioContext.sources.at(-1)?.buffer?.duration).toBe(24);
    engine.pause();
    tester.expect(
      engine.getSnapshot().preparation.channels[0]?.activeSource,
    ).toBe("playback-derivative");
    await engine.play();
    tester.expect(audioContext.sources.at(-1)?.buffer?.duration).toBe(24);

    engine.stop();
    tester.expect(
      engine.getSnapshot().preparation.channels[0]?.activeSource,
    ).toBe(null);
    await engine.play();
    tester.expect(audioContext.sources.at(-1)?.buffer?.duration).toBe(24);
    tester.expect(fetchedUrls).toEqual(["/tracks/1/playback-derivative"]);
    engine.stop();
    await engine.startSynchronizedRecordingPlayback?.();
    tester.expect(audioContext.sources.at(-1)?.buffer?.duration).toBe(24);
    tester.expect(
      engine.getSnapshot().preparation.channels[0]?.activeSource,
    ).toBe("playback-derivative");
    engine.destroy?.();
  });

  tester.it("switches original requests by changing only the shared media policy", async () => {
    const requestsByPolicy: Record<string, string[]> = {};

    for (const policy of [
      "derivative-only",
      "derivative-plus-original",
    ] as const) {
      const audioContext = createFakeAudioContext();
      const requests: string[] = [];
      requestsByPolicy[policy] = requests;
      const engine = createWebAudioPlaybackEngine({
        audioContext,
        mediaPreparationPolicy: policy,
        async fetchAudioData(url) {
          requests.push(url);
          return new Uint8Array([24]).buffer;
        },
        scheduleInterval() { return {}; },
        clearScheduledInterval() {},
        onLoadError() {},
      });

      engine.loadMix([{
        channelNumber: 1,
        trackId: "policy-track",
        playbackDerivativeUrl: "/policy/playback-derivative",
        originalAudioUrl: "/policy/audio",
        volume: 1,
        enabled: true,
      }]);
      await waitForPlaybackReady(engine);
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await Promise.resolve();
      }
      engine.destroy?.();
    }

    tester.expect(requestsByPolicy["derivative-only"]).toEqual([
      "/policy/playback-derivative",
    ]);
    tester.expect(requestsByPolicy["derivative-plus-original"]).toEqual([
      "/policy/playback-derivative",
      "/policy/audio",
    ]);
  });

  tester.it("reports an unavailable required derivative without requesting the original", async () => {
    const audioContext = createFakeAudioContext();
    const fetchedUrls: string[] = [];
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      mediaPreparationPolicy: "derivative-only",
      async fetchAudioData(url) {
        fetchedUrls.push(url);
        return new Uint8Array([24]).buffer;
      },
      scheduleInterval() { return {}; },
      clearScheduledInterval() {},
      onLoadError() {},
    });

    engine.loadMix([{
      channelNumber: 1,
      trackId: "unavailable-derivative",
      playbackDerivativeUrl: null,
      originalAudioUrl: "/tracks/1/audio",
      volume: 1,
      enabled: true,
    }]);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await Promise.resolve();
    }

    tester.expect(engine.getSnapshot().preparation.status).toBe("failed");
    tester.expect(
      engine.getSnapshot().preparation.failure?.message,
    ).toBe("This track's audio is unavailable.");
    tester.expect(
      engine.getSnapshot().preparation.failure?.kind,
    ).toBe("derivative-unavailable");
    tester.expect(fetchedUrls).toEqual([]);
    engine.destroy?.();
  });

  tester.it("classifies non-ready lifecycle states without requesting any media fallback", async () => {
    for (const expectation of [
      {
        status: "pending" as const,
        kind: "derivative-not-ready",
        message: "This track's audio is still being prepared.",
      },
      {
        status: "processing" as const,
        kind: "derivative-not-ready",
        message: "This track's audio is still being prepared.",
      },
      {
        status: "failed" as const,
        kind: "derivative-generation-failed",
        message: "This track's audio could not be prepared.",
      },
    ] as const) {
      const audioContext = createFakeAudioContext();
      const fetchedUrls: string[] = [];
      const engine = createWebAudioPlaybackEngine({
        audioContext,
        mediaPreparationPolicy: "derivative-plus-original",
        async fetchAudioData(url) {
          fetchedUrls.push(url);
          return new Uint8Array([24]).buffer;
        },
        scheduleInterval() { return {}; },
        clearScheduledInterval() {},
        onLoadError() {},
      });

      engine.loadMix([{
        channelNumber: 1,
        trackId: `lifecycle-${expectation.status}`,
        playbackDerivativeUrl: null,
        playbackDerivativeStatus: expectation.status,
        originalAudioUrl: `/tracks/${expectation.status}/audio`,
        volume: 1,
        enabled: true,
      }]);
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await Promise.resolve();
      }

      let failure = engine.getSnapshot().preparation.failure;
      tester.expect(engine.getSnapshot().preparation.status).toBe("failed");
      tester.expect(failure?.kind).toBe(expectation.kind);
      tester.expect(failure?.message).toBe(expectation.message);
      tester.expect(fetchedUrls).toEqual([]);

      engine.retryPreparation?.();
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await Promise.resolve();
      }
      failure = engine.getSnapshot().preparation.failure;
      tester.expect(failure?.kind).toBe(expectation.kind);
      tester.expect(fetchedUrls).toEqual([]);
      engine.destroy?.();
    }
  });

  tester.it("promotes an original only after Stop starts a new transport run", async () => {
    const audioContext = createFakeAudioContext();
    const fetchedUrls: string[] = [];
    let resolveOriginal: ((audioData: ArrayBuffer) => void) | null = null;
    const originalAudio = new Promise<ArrayBuffer>((resolve) => {
      resolveOriginal = resolve;
    });
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      mediaPreparationPolicy: "derivative-plus-original",
      fetchAudioData(url) {
        fetchedUrls.push(url);
        return url.endsWith("/audio")
          ? originalAudio
          : Promise.resolve(new Uint8Array([24]).buffer);
      },
      scheduleInterval() { return {}; },
      clearScheduledInterval() {},
      onLoadError() {},
    });

    engine.loadMix([{
      channelNumber: 1,
      trackId: "dual-source-track",
      playbackDerivativeUrl: "/tracks/1/playback-derivative",
      originalAudioUrl: "/tracks/1/audio",
      volume: 1,
      enabled: true,
    }]);
    await waitForPlaybackReady(engine);

    const readyBeforeOriginal = engine.getSnapshot();
    tester.expect(readyBeforeOriginal.preparation.status).toBe("ready");
    tester.expect(
      readyBeforeOriginal.preparation.channels[0]?.preparedSources.original,
    ).toBe("fetching");
    tester.expect(fetchedUrls).toEqual([
      "/tracks/1/playback-derivative",
      "/tracks/1/audio",
    ]);

    await engine.play();
    const activeDerivativeBuffer = audioContext.sources[0]?.buffer;
    tester.expect(activeDerivativeBuffer?.duration).toBe(24);

    resolveOriginal!(new Uint8Array([60]).buffer);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (
        engine.getSnapshot().preparation.channels[0]
          ?.preparedSources.original === "ready"
      ) {
        break;
      }
      await Promise.resolve();
    }

    const afterOriginal = engine.getSnapshot().preparation.channels[0]!;
    tester.expect(afterOriginal.preparedSources.original).toBe("ready");
    tester.expect(afterOriginal.activeSource).toBe("playback-derivative");
    tester.expect(audioContext.sources.length).toBe(1);
    tester.expect(audioContext.sources[0]?.buffer).toBe(activeDerivativeBuffer);

    engine.setLoopEnabled(true);
    tester.expect(audioContext.sources.at(-1)?.buffer).toBe(activeDerivativeBuffer);

    engine.pause();
    tester.expect(
      engine.getSnapshot().preparation.channels[0]?.activeSource,
    ).toBe("playback-derivative");
    await engine.play();
    tester.expect(audioContext.sources.at(-1)?.buffer).toBe(activeDerivativeBuffer);

    engine.seek(4);
    tester.expect(audioContext.sources.at(-1)?.buffer).toBe(activeDerivativeBuffer);

    engine.stop();
    tester.expect(
      engine.getSnapshot().preparation.channels[0]?.activeSource,
    ).toBe(null);
    await engine.play();
    tester.expect(audioContext.sources.at(-1)?.buffer?.duration).toBe(60);
    tester.expect(
      engine.getSnapshot().preparation.channels[0]?.activeSource,
    ).toBe("original");
    engine.destroy?.();
  });

  tester.it("uses an already prepared original on the first plus-original run", async () => {
    const audioContext = createFakeAudioContext();
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      mediaPreparationPolicy: "derivative-plus-original",
      async fetchAudioData(url) {
        return new Uint8Array([url.endsWith("/audio") ? 60 : 24]).buffer;
      },
      scheduleInterval() { return {}; },
      clearScheduledInterval() {},
      onLoadError() {},
    });

    engine.loadMix([{
      channelNumber: 1,
      trackId: "prepared-original-track",
      playbackDerivativeUrl: "/tracks/1/playback-derivative",
      originalAudioUrl: "/tracks/1/audio",
      volume: 1,
      enabled: true,
      timelineOffsetSeconds: 8,
      alignmentOffsetSeconds: -0.25,
      mediaLeadInSeconds: 2,
    }]);
    await waitForPlaybackReady(engine);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (
        engine.getSnapshot().preparation.channels[0]
          ?.preparedSources.original === "ready"
      ) {
        break;
      }
      await Promise.resolve();
    }

    await engine.play();
    tester.expect(audioContext.sources[0]?.buffer?.duration).toBe(60);
    tester.expect(audioContext.sources[0]?.startWhen).toBe(18.03);
    tester.expect(audioContext.sources[0]?.startOffset).toBe(2.25);
    tester.expect(
      engine.getSnapshot().preparation.channels[0]?.activeSource,
    ).toBe("original");
    engine.destroy?.();
  });

  tester.it("keeps derivative playback ready when background original preparation fails", async () => {
    const audioContext = createFakeAudioContext();
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      mediaPreparationPolicy: "derivative-plus-original",
      fetchAudioData(url) {
        return url.endsWith("/audio")
          ? Promise.reject(new Error("Original unavailable"))
          : Promise.resolve(new Uint8Array([24]).buffer);
      },
      scheduleInterval() { return {}; },
      clearScheduledInterval() {},
      onLoadError() {},
    });

    engine.loadMix([{
      channelNumber: 1,
      trackId: "original-failure-track",
      playbackDerivativeUrl: "/tracks/1/playback-derivative",
      originalAudioUrl: "/tracks/1/audio",
      volume: 1,
      enabled: true,
    }]);
    await waitForPlaybackReady(engine);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (
        engine.getSnapshot().preparation.channels[0]
          ?.preparedSources.original === "failed"
      ) {
        break;
      }
      await Promise.resolve();
    }

    const snapshot = engine.getSnapshot();
    tester.expect(snapshot.preparation.status).toBe("ready");
    tester.expect(snapshot.hasLoadedChannels).toBe(true);
    tester.expect(
      snapshot.preparation.channels[0]?.preparedSources.original,
    ).toBe("failed");
    tester.expect(snapshot.preparation.failure).toBe(null);
    await engine.play();
    tester.expect(audioContext.sources.at(-1)?.buffer?.duration).toBe(24);
    engine.stop();
    await engine.startSynchronizedRecordingPlayback?.();
    tester.expect(audioContext.sources.at(-1)?.buffer?.duration).toBe(24);
    engine.destroy?.();
  });

  tester.it("keeps derivative playback ready when background original decoding fails", async () => {
    const audioContext = createFakeAudioContext();
    const decodeAudioData = audioContext.decodeAudioData.bind(audioContext);
    audioContext.decodeAudioData = (audioData) => {
      return new Uint8Array(audioData)[0] === 60
        ? Promise.reject(new Error("Original decode unavailable"))
        : decodeAudioData(audioData);
    };
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      mediaPreparationPolicy: "derivative-plus-original",
      async fetchAudioData(url) {
        return new Uint8Array([url.endsWith("/audio") ? 60 : 24]).buffer;
      },
      scheduleInterval() { return {}; },
      clearScheduledInterval() {},
      onLoadError() {},
    });

    engine.loadMix([{
      channelNumber: 1,
      trackId: "original-decode-failure-track",
      playbackDerivativeUrl: "/tracks/1/playback-derivative",
      originalAudioUrl: "/tracks/1/audio",
      volume: 1,
      enabled: true,
    }]);
    await waitForPlaybackReady(engine);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (
        engine.getSnapshot().preparation.channels[0]
          ?.preparedSources.original === "failed"
      ) break;
      await Promise.resolve();
    }

    tester.expect(engine.getSnapshot().preparation.status).toBe("ready");
    tester.expect(engine.getSnapshot().preparation.failure).toBe(null);
    await engine.play();
    tester.expect(audioContext.sources.at(-1)?.buffer?.duration).toBe(24);
    tester.expect(
      engine.getSnapshot().preparation.channels[0]?.activeSource,
    ).toBe("playback-derivative");
    engine.destroy?.();
  });

  tester.it("finishes all derivatives before background originals", async () => {
    const audioContext = createFakeAudioContext();
    const fetchedUrls: string[] = [];
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      mediaPreparationPolicy: "derivative-plus-original",
      async fetchAudioData(url) {
        fetchedUrls.push(url);
        return new Uint8Array([24]).buffer;
      },
      scheduleInterval() { return {}; },
      clearScheduledInterval() {},
      onLoadError() {},
    });

    engine.loadMix([
      {
        channelNumber: 1,
        trackId: "enabled",
        playbackDerivativeUrl: "/enabled/playback-derivative",
        originalAudioUrl: "/enabled/audio",
        volume: 1,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "disabled",
        playbackDerivativeUrl: "/disabled/playback-derivative",
        originalAudioUrl: "/disabled/audio",
        volume: 1,
        enabled: false,
      },
    ]);
    await waitForPlaybackReady(engine);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (
        engine.getSnapshot().preparation.channels.every((channel) =>
          channel.preparedSources.original === "ready"
        )
      ) {
        break;
      }
      await Promise.resolve();
    }

    tester.expect(fetchedUrls).toEqual([
      "/enabled/playback-derivative",
      "/disabled/playback-derivative",
      "/enabled/audio",
      "/disabled/audio",
    ]);
    tester.expect(engine.getSnapshot().preparation.status).toBe("ready");
    engine.destroy?.();
  });

  tester.it("ignores stale background originals and clears both representations on destroy", async () => {
    const audioContext = createFakeAudioContext();
    let resolveOldOriginal: ((audioData: ArrayBuffer) => void) | null = null;
    let resolveNewOriginal: ((audioData: ArrayBuffer) => void) | null = null;
    const oldOriginal = new Promise<ArrayBuffer>((resolve) => {
      resolveOldOriginal = resolve;
    });
    const newOriginal = new Promise<ArrayBuffer>((resolve) => {
      resolveNewOriginal = resolve;
    });
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      mediaPreparationPolicy: "derivative-plus-original",
      fetchAudioData(url) {
        if (url === "/old/audio") return oldOriginal;
        if (url === "/new/audio") return newOriginal;
        return Promise.resolve(new Uint8Array([24]).buffer);
      },
      scheduleInterval() { return {}; },
      clearScheduledInterval() {},
      onLoadError() {},
    });

    engine.loadMix([{
      channelNumber: 1,
      trackId: "old",
      playbackDerivativeUrl: "/old/playback-derivative",
      originalAudioUrl: "/old/audio",
      volume: 1,
      enabled: true,
    }]);
    await waitForPlaybackReady(engine);

    engine.loadMix([{
      channelNumber: 1,
      trackId: "new",
      playbackDerivativeUrl: "/new/playback-derivative",
      originalAudioUrl: "/new/audio",
      volume: 1,
      enabled: true,
    }]);
    await waitForPlaybackReady(engine);
    resolveOldOriginal!(new Uint8Array([90]).buffer);
    await Promise.resolve();
    await Promise.resolve();

    let currentChannel = engine.getSnapshot().preparation.channels[0]!;
    tester.expect(currentChannel.trackId).toBe("new");
    tester.expect(currentChannel.preparedSources.original).toBe("fetching");

    resolveNewOriginal!(new Uint8Array([60]).buffer);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      currentChannel = engine.getSnapshot().preparation.channels[0]!;
      if (currentChannel.preparedSources.original === "ready") break;
      await Promise.resolve();
    }
    tester.expect(currentChannel.preparedSources.original).toBe("ready");

    engine.destroy?.();
    tester.expect(engine.getSnapshot().preparation.channels).toEqual([]);
  });

  tester.it("loads enabled tracks concurrently before starting disabled background preparation", async () => {
    const { rawEngine, fetchedUrls } = createEngineHarness();
    rawEngine.loadMix([
      twoChannelMix[0]!,
      { ...twoChannelMix[1]!, enabled: false },
    ]);

    tester.expect(fetchedUrls).toEqual(["/drums.wav"]);
    await waitForPlaybackReady(rawEngine);
    tester.expect(fetchedUrls).toEqual(["/drums.wav", "/bass.wav"]);
    tester.expect(rawEngine.getSnapshot().preparation.status).toBe("ready");
    rawEngine.destroy?.();
  });

  tester.it("keeps ready playback running while a newly enabled channel prepares and joins", async () => {
    const audioContext = createFakeAudioContext();
    let resolveBass: ((audioData: ArrayBuffer) => void) | null = null;
    const bassAudio = new Promise<ArrayBuffer>((resolve) => {
      resolveBass = resolve;
    });
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      fetchAudioData(audioUrl) {
        return audioUrl === "/bass.wav"
          ? bassAudio
          : Promise.resolve(new Uint8Array([60]).buffer);
      },
      scheduleInterval() { return {}; },
      clearScheduledInterval() {},
      onLoadError() {},
    });

    engine.loadMix([
      twoChannelMix[0]!,
      { ...twoChannelMix[1]!, enabled: false },
    ]);
    await waitForPlaybackReady(engine);
    await engine.play();
    const playingSourceCount = audioContext.sources.length;
    tester.expect(
      engine.getSnapshot().preparation.channels[1]?.activeSource,
    ).toBe(null);

    engine.setChannelEnabled(2, true);
    tester.expect(engine.getSnapshot().preparation.status).toBe("preparing");
    tester.expect(engine.getSnapshot().isPlaying).toBe(true);
    tester.expect(audioContext.sources.length).toBe(playingSourceCount);

    audioContext.currentTime = 12;
    resolveBass!(new Uint8Array([60]).buffer);
    await waitForPlaybackReady(engine);
    tester.expect(engine.getSnapshot().isPlaying).toBe(true);
    tester.expect(audioContext.sources.length).toBe(playingSourceCount + 1);
    tester.expect(audioContext.sources[0]?.stopCallCount).toBe(0);
    tester.expect(Math.abs((audioContext.sources.at(-1)?.startOffset ?? 0) - 2) < 1e-9).toBe(true);
    tester.expect(
      engine.getSnapshot().preparation.channels[1]?.activeSource,
    ).toBe("playback-derivative");
    engine.destroy?.();
  });

  tester.it("hot-joins a prepared original without changing other run sources", async () => {
    const audioContext = createFakeAudioContext();
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      mediaPreparationPolicy: "derivative-plus-original",
      async fetchAudioData(url) {
        const duration = url === "/drums/audio"
          ? 90
          : url === "/bass/audio"
            ? 45
            : url === "/bass/playback-derivative"
              ? 30
              : 60;
        return new Uint8Array([duration]).buffer;
      },
      scheduleInterval() { return {}; },
      clearScheduledInterval() {},
      onLoadError() {},
    });

    engine.loadMix([
      {
        channelNumber: 1,
        trackId: "drums",
        playbackDerivativeUrl: "/drums/playback-derivative",
        originalAudioUrl: "/drums/audio",
        volume: 1,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "bass",
        playbackDerivativeUrl: "/bass/playback-derivative",
        originalAudioUrl: "/bass/audio",
        volume: 1,
        enabled: false,
      },
    ]);
    await waitForPlaybackReady(engine);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (engine.getSnapshot().preparation.channels.every((channel) =>
        channel.preparedSources.original === "ready"
      )) break;
      await Promise.resolve();
    }

    await engine.play();
    const drumsSource = audioContext.sources[0]!;
    tester.expect(drumsSource.buffer?.duration).toBe(90);
    tester.expect(engine.setChannelEnabled(2, true)).toBe(true);
    const bassSource = audioContext.sources.at(-1)!;
    tester.expect(bassSource.buffer?.duration).toBe(45);
    tester.expect(drumsSource.stopCallCount).toBe(0);
    tester.expect(
      engine.getSnapshot().preparation.channels.map(({ activeSource }) => activeSource),
    ).toEqual(["original", "original"]);
    engine.destroy?.();
  });

  tester.it("does not hot-swap a derivative selected when a channel joins", async () => {
    const audioContext = createFakeAudioContext();
    let resolveBassOriginal: ((audioData: ArrayBuffer) => void) | null = null;
    const bassOriginal = new Promise<ArrayBuffer>((resolve) => {
      resolveBassOriginal = resolve;
    });
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      mediaPreparationPolicy: "derivative-plus-original",
      fetchAudioData(url) {
        if (url === "/bass/audio") return bassOriginal;
        const duration = url === "/drums/audio"
          ? 90
          : url === "/bass/playback-derivative"
            ? 30
            : 60;
        return Promise.resolve(new Uint8Array([duration]).buffer);
      },
      scheduleInterval() { return {}; },
      clearScheduledInterval() {},
      onLoadError() {},
    });

    engine.loadMix([
      {
        channelNumber: 1,
        trackId: "drums",
        playbackDerivativeUrl: "/drums/playback-derivative",
        originalAudioUrl: "/drums/audio",
        volume: 1,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "bass",
        playbackDerivativeUrl: "/bass/playback-derivative",
        originalAudioUrl: "/bass/audio",
        volume: 1,
        enabled: false,
      },
    ]);
    await waitForPlaybackReady(engine);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const bass = engine.getSnapshot().preparation.channels[1];
      if (
        bass?.preparedSources.playbackDerivative === "ready" &&
        bass.preparedSources.original === "fetching"
      ) break;
      await Promise.resolve();
    }

    await engine.play();
    engine.setChannelEnabled(2, true);
    const joinedDerivative = audioContext.sources.at(-1)!;
    tester.expect(joinedDerivative.buffer?.duration).toBe(30);
    tester.expect(
      engine.getSnapshot().preparation.channels[1]?.activeSource,
    ).toBe("playback-derivative");

    const sourceCount = audioContext.sources.length;
    resolveBassOriginal!(new Uint8Array([45]).buffer);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (
        engine.getSnapshot().preparation.channels[1]
          ?.preparedSources.original === "ready"
      ) break;
      await Promise.resolve();
    }
    tester.expect(audioContext.sources.length).toBe(sourceCount);
    tester.expect(audioContext.sources.at(-1)).toBe(joinedDerivative);
    tester.expect(
      engine.getSnapshot().preparation.channels[1]?.activeSource,
    ).toBe("playback-derivative");

    engine.stop();
    await engine.play();
    tester.expect(
      audioContext.sources.slice(-2).map((source) => source.buffer?.duration),
    ).toEqual([90, 45]);
    tester.expect(
      engine.getSnapshot().preparation.channels.map(({ activeSource }) => activeSource),
    ).toEqual(["original", "original"]);
    engine.destroy?.();
  });

  tester.it("reports required failures, retries them, and does not let disabled failures tear down ready playback", async () => {
    const audioContext = createFakeAudioContext();
    let requiredAttempts = 0;
    const fetchedUrls: string[] = [];
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      fetchAudioData(audioUrl) {
        fetchedUrls.push(audioUrl);
        if (audioUrl === "/drums.wav" && requiredAttempts++ === 0) {
          return Promise.reject(new Error("Drums unavailable"));
        }
        if (audioUrl === "/bass.wav") {
          return Promise.reject(new Error("Bass unavailable"));
        }
        return Promise.resolve(new Uint8Array([60]).buffer);
      },
      scheduleInterval() { return {}; },
      clearScheduledInterval() {},
      onLoadError() {},
    });

    engine.loadMix([
      twoChannelMix[0]!,
      { ...twoChannelMix[1]!, enabled: false },
    ]);
    for (let attempt = 0; attempt < 10; attempt += 1) await Promise.resolve();
    tester.expect(engine.getSnapshot().preparation.status).toBe("failed");
    tester.expect(engine.getSnapshot().preparation.failure?.trackId).toBe("track-1");

    engine.retryPreparation?.();
    await waitForPlaybackReady(engine);
    for (let attempt = 0; attempt < 10; attempt += 1) await Promise.resolve();
    tester.expect(engine.getSnapshot().preparation.status).toBe("ready");
    tester.expect(
      engine.getSnapshot().preparation.channels.find(({ trackId }) => trackId === "track-2")?.status,
    ).toBe("failed");
    await engine.play();
    tester.expect(engine.getSnapshot().isPlaying).toBe(true);

    engine.setChannelEnabled(2, true);
    tester.expect(engine.getSnapshot().preparation.status).toBe("preparing");
    for (let attempt = 0; attempt < 10; attempt += 1) await Promise.resolve();
    tester.expect(engine.getSnapshot().preparation.status).toBe("failed");
    tester.expect(engine.getSnapshot().preparation.failure?.trackId).toBe("track-2");
    tester.expect(engine.getSnapshot().preparation.failure?.kind).toBe(
      "derivative-download-failed",
    );
    tester.expect(
      fetchedUrls.filter((url) => url === "/drums.wav").length,
    ).toBe(2);
    tester.expect(
      fetchedUrls.filter((url) => url === "/bass.wav").length,
    ).toBe(2);

    engine.setChannelEnabled(2, false);
    tester.expect(engine.getSnapshot().preparation.status).toBe("ready");
    engine.destroy?.();
  });

  tester.it("moves the same transient earlier or later by the signed amount in audition and saved-track playback", async () => {
    for (const alignmentOffsetSeconds of [-0.36, -0.1, -0.01, -0.001, 0, 0.001, 0.01, 0.1]) {
      const { engine, audioContext } = createEngineHarness();
      engine.loadMix(twoChannelMix);
      await engine.auditionRecordedTake!({
        capture: { bytes: new Uint8Array([10]), mimeType: "audio/webm" },
        projectStartSeconds: 8,
        mediaLeadInSeconds: 2,
        alignmentOffsetSeconds,
      });
      const audition = audioContext.sources[2]!;
      // A transient at media time 3 (two seconds lead-in + one second music).
      const auditionTransient = audition.startWhen! - audioContext.sources[0]!.startWhen! + 3 - audition.startOffset!;
      tester.expect(Math.abs(auditionTransient - (1 + alignmentOffsetSeconds)) < 1e-9).toBe(true);
      tester.expect(audioContext.gainNodes[0]!.gain.value).toBe(0.8);
      tester.expect(audioContext.gainNodes[1]!.gain.value).toBe(0.5);
      engine.destroy?.();

      const saved = createEngineHarness();
      saved.engine.loadMix([{
        channelNumber: 1, trackId: "saved", playbackDerivativeUrl: "/long-take.m4a",
        volume: 0.7, enabled: true, timelineOffsetSeconds: 8,
        mediaLeadInSeconds: 2, alignmentOffsetSeconds,
      }]);
      await saved.engine.play();
      const source = saved.audioContext.sources[0]!;
      const savedTransient = source.startWhen! - (10.03 + 8) + 3 - source.startOffset!;
      tester.expect(Math.abs(savedTransient - (1 + alignmentOffsetSeconds)) < 1e-9).toBe(true);
      tester.expect(Math.abs(savedTransient - auditionTransient) < 1e-9).toBe(true);
      saved.engine.destroy?.();
    }
  });
  tester.it("changes only temporary take gain, preserving timing and project levels across replay", async () => {
    const { audioContext, engine } = createEngineHarness();
    engine.loadMix(twoChannelMix);
    engine.setRecordedTakeAuditionVolume!(0.4);
    const options = { capture: { bytes: new Uint8Array([10]), mimeType: "audio/webm" }, projectStartSeconds: 30, alignmentOffsetSeconds: -0.26, mediaLeadInSeconds: 2.43 };
    await engine.auditionRecordedTake!(options);
    const gain = audioContext.gainNodes[2]!;
    const source = audioContext.sources[2]!;
    tester.expect(source.connectedDestination).toBe(gain);
    tester.expect(gain.gain.value).toBe(0.4);
    engine.setRecordedTakeAuditionVolume!(0);
    tester.expect(gain.gain.value).toBe(0);
    tester.expect(audioContext.gainNodes[0]!.gain.value).toBe(0.8);
    tester.expect(audioContext.gainNodes[1]!.gain.value).toBe(0.5);
    tester.expect(Math.abs(source.startOffset! - 2.69) < 1e-9).toBe(true);
    tester.expect(source.startWhen).toBe(audioContext.sources[0]!.startWhen);
    engine.stop();
    tester.expect(gain.disconnected).toBe(true);
    engine.setRecordedTakeAuditionVolume!(0.6);
    await engine.auditionRecordedTake!(options);
    const replayGain = audioContext.gainNodes[3]!;
    tester.expect(replayGain.gain.value).toBe(0.6);
    engine.setRecordedTakeAuditionVolume!(NaN);
    tester.expect(replayGain.gain.value).toBe(0.6);
    audioContext.sources[5]!.onended?.();
    tester.expect(replayGain.disconnected).toBe(true);
    engine.destroy?.();
  });
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

  tester.it("auditions a temporary recorded take on the exact saved-track Web Audio clock and alignment path", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix(twoChannelMix);
    await engine.auditionRecordedTake!({
      capture: {
        bytes: new Uint8Array([10]),
        mimeType: "audio/webm",
      },
      projectStartSeconds: 30,
      alignmentOffsetSeconds: -0.26,
      mediaLeadInSeconds: 2.43,
    });

    tester.expect(audioContext.sources.length).toBe(3);
    const projectSource = audioContext.sources[0];
    const takeSource = audioContext.sources[2];
    tester.expect(projectSource?.startWhen).toBe(10.03);
    tester.expect(takeSource?.startWhen).toBe(projectSource?.startWhen);
    tester.expect(projectSource?.startOffset).toBe(30);
    tester.expect(Math.abs((takeSource?.startOffset ?? 0) - 2.69) < 1e-9).toBe(true);
    tester.expect(engine.getSnapshot().currentTime).toBe(30);
    tester.expect(engine.getSnapshot().isPlaying).toBe(true);

    engine.stop();
    tester.expect(takeSource?.stopCallCount).toBe(1);
  });

  tester.it("preserves the working transport position when the project mix reloads", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix(twoChannelMix);
    await engine.play();
    engine.pause();
    engine.seek(22);
    tester.expect(engine.getSnapshot().currentTime).toBe(22);

    const sourceCountBeforeReload = audioContext.sources.length;
    engine.loadMix([...twoChannelMix, {
      channelNumber: 3,
      trackId: "track-3",
      playbackDerivativeUrl: "/long-take.m4a",
      volume: 1,
      enabled: true,
    }]);
    await engine.play();

    tester.expect(engine.getSnapshot().currentTime).toBe(22);
    const reloadedSources = audioContext.sources.slice(sourceCountBeforeReload);
    tester.expect(reloadedSources[0]?.startOffset).toBe(22);
    tester.expect(reloadedSources[1]?.startOffset).toBe(22);
    tester.expect(reloadedSources[2]?.startOffset).toBe(22);

    engine.destroy?.();
  });

  tester.it("seeks to a bar through the shared musical timeline without client-side time math", async () => {
    const { audioContext, engine } = createEngineHarness({
      bpm: 120,
      timeSignature: { numerator: 6, denominator: 8 },
    });

    engine.loadMix(twoChannelMix);
    await engine.play();
    engine.stop();

    engine.seekToMusicalPosition({ bar: 2, beat: 3 });
    tester.expect(engine.getSnapshot().currentTime).toBe(2);
    tester.expect(engine.getSnapshot().musicalPosition).toEqual({
      bar: 2,
      beat: 3,
    });

    audioContext.currentTime = 30;
    await engine.play();
    const generation = audioContext.sources.slice(-2);
    tester.expect(generation[0]?.startOffset).toBe(2);
    tester.expect(generation[1]?.startOffset).toBe(2);

    engine.seekToMusicalPosition({ bar: 3, beat: 1 });
    const playingSeekGeneration = audioContext.sources.slice(-2);
    tester.expect(playingSeekGeneration[0]?.startOffset).toBe(3);
    tester.expect(playingSeekGeneration[1]?.startOffset).toBe(3);
    tester.expect(engine.getSnapshot().musicalPosition).toEqual({
      bar: 3,
      beat: 1,
    });

    engine.destroy?.();
  });

  tester.it("schedules tracks at their saved project timeline offsets", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix([
      twoChannelMix[0]!,
      {
        channelNumber: 2,
        trackId: "recorded-take",
        playbackDerivativeUrl: "/recorded-take.webm",
        volume: 1,
        enabled: true,
        timelineOffsetSeconds: 3.5,
      },
    ]);
    await engine.play();

    tester.expect(audioContext.sources[0]?.startWhen).toBe(10.03);
    tester.expect(audioContext.sources[0]?.startOffset).toBe(0);
    tester.expect(audioContext.sources[1]?.startWhen).toBe(13.53);
    tester.expect(audioContext.sources[1]?.startOffset).toBe(0);
    tester.expect(engine.getSnapshot().duration).toBe(60);

    engine.stop();
    engine.seek(4);
    audioContext.currentTime = 20;
    await engine.play();

    const resumedSources = audioContext.sources.slice(-2);
    tester.expect(resumedSources[0]?.startWhen).toBe(20.03);
    tester.expect(resumedSources[0]?.startOffset).toBe(4);
    tester.expect(resumedSources[1]?.startWhen).toBe(20.03);
    tester.expect(resumedSources[1]?.startOffset).toBe(0.5);

    engine.destroy?.();
  });

  tester.it("keeps Bar 1 tracks at the musical origin even when legacy seconds are stale", async () => {
    const { audioContext, engine } = createEngineHarness({
      bpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
    });

    engine.loadMix([
      {
        channelNumber: 1,
        trackId: "legacy-seeded-track",
        playbackDerivativeUrl: "/legacy-seeded-track.wav",
        volume: 1,
        enabled: true,
        timelineOffsetSeconds: 3.5,
        musicalPlacement: {
          start: { bar: 1, beat: 1 },
          spanBeats: null,
        },
      },
    ]);

    await engine.play();

    tester.expect(audioContext.sources[0]?.startWhen).toBe(10.03);
    tester.expect(audioContext.sources[0]?.startOffset).toBe(0);

    engine.destroy?.();
  });

  tester.it("uses persisted musical placement as authoritative for later-starting tracks", async () => {
    const { audioContext, engine } = createEngineHarness({
      bpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
    });

    engine.loadMix([
      {
        channelNumber: 1,
        trackId: "legacy-default",
        playbackDerivativeUrl: "/drums.wav",
        volume: 1,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "later-track",
        playbackDerivativeUrl: "/recorded-take.webm",
        volume: 1,
        enabled: true,
        timelineOffsetSeconds: 99,
        musicalPlacement: {
          start: { bar: 2, beat: 1 },
          spanBeats: 4,
        },
      },
    ]);
    await engine.play();

    tester.expect(audioContext.sources[0]?.startWhen).toBe(10.03);
    tester.expect(audioContext.sources[0]?.startOffset).toBe(0);
    tester.expect(audioContext.sources[1]?.startWhen).toBe(12.03);
    tester.expect(audioContext.sources[1]?.startOffset).toBe(0);
    tester.expect(engine.getSnapshot().duration).toBe(60);

    engine.stop();
    engine.seekToMusicalPosition({ bar: 2, beat: 2 });
    audioContext.currentTime = 20;
    await engine.play();

    const resumed = audioContext.sources.slice(-2);
    tester.expect(resumed[0]?.startWhen).toBe(20.03);
    tester.expect(resumed[0]?.startOffset).toBe(2.5);
    tester.expect(resumed[1]?.startWhen).toBe(20.03);
    tester.expect(resumed[1]?.startOffset).toBe(0.5);

    engine.stop();
    await engine.play();
    const restarted = audioContext.sources.slice(-2);
    tester.expect(restarted[0]?.startOffset).toBe(0);
    tester.expect(restarted[1]?.startWhen).toBe(22.03);
    tester.expect(restarted[1]?.startOffset).toBe(0);

    engine.destroy?.();
  });

  tester.it("skips structural captured-media lead-in in Web Audio playback and duration", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix([{
      channelNumber: 1,
      trackId: "counted-in-take",
      playbackDerivativeUrl: "/recorded-take.webm",
      volume: 1,
      enabled: true,
      musicalPlacement: { start: { bar: 2, beat: 1 }, spanBeats: 2 },
      mediaLeadInSeconds: 1,
    }]);
    await engine.play();

    tester.expect(audioContext.sources[0]?.startWhen).toBe(12.03);
    tester.expect(audioContext.sources[0]?.startOffset).toBe(1);
    tester.expect(engine.getSnapshot().duration).toBe(3);

    engine.destroy?.();
  });

  tester.it("applies signed source alignment without changing authoritative musical placement", async () => {
    const earlierHarness = createEngineHarness();
    earlierHarness.engine.loadMix([{
      channelNumber: 1,
      trackId: "late-take",
      playbackDerivativeUrl: "/recorded-take.webm",
      volume: 1,
      enabled: true,
      musicalPlacement: { start: { bar: 2, beat: 1 }, spanBeats: 4 },
      alignmentOffsetSeconds: -0.16,
    }]);
    await earlierHarness.engine.play();

    tester.expect(earlierHarness.audioContext.sources[0]?.startWhen).toBe(12.03);
    tester.expect(earlierHarness.audioContext.sources[0]?.startOffset).toBe(0.16);
    tester.expect(earlierHarness.engine.getSnapshot().duration).toBe(3.84);
    earlierHarness.engine.destroy?.();

    const laterHarness = createEngineHarness();
    laterHarness.engine.loadMix([{
      channelNumber: 1,
      trackId: "early-take",
      playbackDerivativeUrl: "/recorded-take.webm",
      volume: 1,
      enabled: true,
      musicalPlacement: { start: { bar: 2, beat: 1 }, spanBeats: 4 },
      alignmentOffsetSeconds: 0.032,
    }]);
    await laterHarness.engine.play();

    tester.expect(laterHarness.audioContext.sources[0]?.startWhen).toBe(12.062);
    tester.expect(
      Math.abs(laterHarness.audioContext.sources[0]?.startOffset ?? 0) < 0.000001,
    ).toBe(true);
    tester.expect(laterHarness.engine.getSnapshot().duration).toBe(4.032);
    laterHarness.engine.destroy?.();
  });

  tester.it("records one bar of count-in before capture-safe project playback", async () => {
    const { audioContext, engine } = createEngineHarness();
    engine.loadMix(twoChannelMix);
    audioContext.currentTime = 20;

    const synchronizedStart = await engine.startSynchronizedRecordingPlayback?.();

    tester.expect(synchronizedStart?.marker.audioContextTimeSeconds).toBe(22.03);
    tester.expect(synchronizedStart?.marker.projectPositionSeconds).toBe(0);
    tester.expect(synchronizedStart?.marker.musicalPosition).toEqual({ bar: 1, beat: 1 });
    tester.expect(
      Math.abs((synchronizedStart?.mediaLeadInSeconds ?? 0) - 2.03) < 1e-9,
    ).toBe(true);
    tester.expect(synchronizedStart?.countIn).toEqual({
      bars: 1,
      beats: 4,
      durationSeconds: 2,
    });
    tester.expect(audioContext.sources[0]?.startWhen).toBe(22.03);
    tester.expect(audioContext.sources[1]?.startWhen).toBe(22.03);
    tester.expect(audioContext.oscillators.length).toBe(4);
    tester.expect(audioContext.oscillators.map((oscillator) => oscillator.startWhen)).toEqual([
      20.03,
      20.53,
      21.03,
      21.53,
    ]);
    tester.expect(audioContext.oscillators.map((oscillator) => oscillator.frequency.value)).toEqual([
      1760,
      880,
      880,
      880,
    ]);
    tester.expect(engine.getSnapshot().isPlaying).toBe(true);
    tester.expect(engine.getSynchronizedRecordingPlaybackSnapshot?.()).toEqual({
      phase: "count-in",
      countIn: {
        bars: 1,
        totalBeats: 4,
        currentBeat: 1,
        durationSeconds: 2,
      },
      elapsedRecordingSeconds: 0,
    });

    audioContext.currentTime = 20.6;
    tester.expect(
      engine.getSynchronizedRecordingPlaybackSnapshot?.()?.countIn.currentBeat,
    ).toBe(2);

    audioContext.currentTime = 22.28;
    tester.expect(engine.getSynchronizedRecordingPlaybackSnapshot?.()?.phase).toBe(
      "recording",
    );
    tester.expect(
      Math.abs(
        (engine.getSynchronizedRecordingPlaybackSnapshot?.()
          ?.elapsedRecordingSeconds ?? 0) - 0.25,
      ) < 1e-9,
    ).toBe(true);

    engine.stop();
    tester.expect(engine.getSynchronizedRecordingPlaybackSnapshot?.()).toBe(null);

    engine.destroy?.();
  });

  tester.it("classifies download and decode failures and retries only the failed derivative", async () => {
    for (const failureStage of ["download", "decode"] as const) {
      const audioContext = createFakeAudioContext();
      const decodeAudioData = audioContext.decodeAudioData.bind(audioContext);
      const fetchedUrls: string[] = [];
      let bassFetchAttempts = 0;
      let bassDecodeAttempts = 0;

      if (failureStage === "decode") {
        audioContext.decodeAudioData = (audioData) => {
          const duration = new Uint8Array(audioData)[0] ?? 0;
          if (duration === 30 && bassDecodeAttempts++ === 0) {
            return Promise.reject(new Error("Could not decode track audio"));
          }
          return decodeAudioData(audioData);
        };
      }

      const engine = createWebAudioPlaybackEngine({
        audioContext,
        mediaPreparationPolicy: "derivative-only",
        fetchAudioData(url) {
          fetchedUrls.push(url);
          if (
            url === "/bass/playback-derivative" &&
            failureStage === "download" &&
            bassFetchAttempts++ === 0
          ) {
            return Promise.reject(new Error("Track request interrupted"));
          }
          return Promise.resolve(
            new Uint8Array([url.startsWith("/bass/") ? 30 : 60]).buffer,
          );
        },
        scheduleInterval() { return {}; },
        clearScheduledInterval() {},
        onLoadError() {},
      });

      engine.loadMix([
        {
          channelNumber: 1,
          trackId: "drums",
          playbackDerivativeUrl: "/drums/playback-derivative",
          originalAudioUrl: "/drums/audio",
          volume: 1,
          enabled: true,
        },
        {
          channelNumber: 2,
          trackId: "bass",
          playbackDerivativeUrl: "/bass/playback-derivative",
          originalAudioUrl: "/bass/audio",
          volume: 1,
          enabled: true,
        },
      ]);
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (engine.getSnapshot().preparation.status === "failed") break;
        await Promise.resolve();
      }

      tester.expect(engine.getSnapshot().preparation.failure?.kind).toBe(
        failureStage === "download"
          ? "derivative-download-failed"
          : "derivative-decode-failed",
      );
      tester.expect(engine.getSnapshot().hasLoadedChannels).toBe(false);
      tester.expect(
        fetchedUrls.filter((url) => url === "/drums/playback-derivative").length,
      ).toBe(1);

      engine.retryPreparation?.();
      tester.expect(engine.getSnapshot().preparation.status).toBe("preparing");
      await waitForPlaybackReady(engine);
      tester.expect(
        fetchedUrls.filter((url) => url === "/drums/playback-derivative").length,
      ).toBe(1);
      tester.expect(
        fetchedUrls.filter((url) => url === "/bass/playback-derivative").length,
      ).toBe(2);
      tester.expect(fetchedUrls.some((url) => url.endsWith("/audio"))).toBe(false);

      await engine.startSynchronizedRecordingPlayback?.();
      tester.expect(engine.getSnapshot().isPlaying).toBe(true);
      engine.destroy?.();
    }
  });

  tester.it("freezes derivative backing for a recording run and promotes on the next recording run", async () => {
    const audioContext = createFakeAudioContext();
    let resolveOriginal: ((audioData: ArrayBuffer) => void) | null = null;
    const originalAudio = new Promise<ArrayBuffer>((resolve) => {
      resolveOriginal = resolve;
    });
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      mediaPreparationPolicy: "derivative-plus-original",
      fetchAudioData(url) {
        return url.endsWith("/audio")
          ? originalAudio
          : Promise.resolve(new Uint8Array([24]).buffer);
      },
      scheduleInterval() { return {}; },
      clearScheduledInterval() {},
      onLoadError() {},
    });

    engine.loadMix([{
      channelNumber: 1,
      trackId: "recording-backing-track",
      playbackDerivativeUrl: "/tracks/1/playback-derivative",
      originalAudioUrl: "/tracks/1/audio",
      volume: 1,
      enabled: true,
      alignmentOffsetSeconds: -0.25,
      mediaLeadInSeconds: 2,
    }]);
    await waitForPlaybackReady(engine);
    engine.seek(4);
    const firstStart = await engine.startSynchronizedRecordingPlayback?.();
    const derivativeBacking = audioContext.sources.at(-1)!;

    tester.expect(firstStart?.marker.projectPositionSeconds).toBe(4);
    tester.expect(firstStart?.marker.musicalPosition).toEqual({ bar: 3, beat: 1 });
    tester.expect(derivativeBacking.buffer?.duration).toBe(24);
    tester.expect(derivativeBacking.startOffset).toBe(6.25);
    tester.expect(
      engine.getSnapshot().preparation.channels[0]?.activeSource,
    ).toBe("playback-derivative");

    resolveOriginal!(new Uint8Array([60]).buffer);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (
        engine.getSnapshot().preparation.channels[0]
          ?.preparedSources.original === "ready"
      ) {
        break;
      }
      await Promise.resolve();
    }

    tester.expect(audioContext.sources.at(-1)).toBe(derivativeBacking);
    tester.expect(
      engine.getSnapshot().preparation.channels[0]?.activeSource,
    ).toBe("playback-derivative");

    engine.stop();
    engine.seek(4);
    const secondStart = await engine.startSynchronizedRecordingPlayback?.();
    const originalBacking = audioContext.sources.at(-1)!;

    tester.expect(secondStart?.marker.projectPositionSeconds).toBe(4);
    tester.expect(secondStart?.marker.musicalPosition).toEqual(
      firstStart?.marker.musicalPosition,
    );
    tester.expect(secondStart?.mediaLeadInSeconds).toBe(
      firstStart?.mediaLeadInSeconds,
    );
    tester.expect(originalBacking.buffer?.duration).toBe(60);
    tester.expect(originalBacking.startOffset).toBe(derivativeBacking.startOffset);
    tester.expect(
      engine.getSnapshot().preparation.channels[0]?.activeSource,
    ).toBe("original");
    engine.destroy?.();
  });

  tester.it("preserves a later requested musical start across the recording count-in", async () => {
    const { audioContext, engine } = createEngineHarness();
    engine.loadMix(twoChannelMix);
    engine.seekToMusicalPosition({ bar: 3, beat: 1 });
    audioContext.currentTime = 25;

    const synchronizedStart = await engine.startSynchronizedRecordingPlayback?.();

    tester.expect(synchronizedStart?.marker.projectPositionSeconds).toBe(4);
    tester.expect(synchronizedStart?.marker.musicalPosition).toEqual({ bar: 3, beat: 1 });
    tester.expect(synchronizedStart?.marker.audioContextTimeSeconds).toBe(27.03);
    tester.expect(audioContext.sources[0]?.startOffset).toBe(4);
    tester.expect(audioContext.sources[1]?.startOffset).toBe(4);
    tester.expect(
      Math.abs((synchronizedStart?.mediaLeadInSeconds ?? 0) - 2.03) < 1e-9,
    ).toBe(true);

    engine.destroy?.();
  });

  tester.it("uses denominator-aware beat units for a one-bar 6/8 recording count-in", async () => {
    const { audioContext, engine } = createEngineHarness({
      bpm: 120,
      timeSignature: { numerator: 6, denominator: 8 },
    });
    engine.loadMix(twoChannelMix);
    audioContext.currentTime = 30;

    const synchronizedStart = await engine.startSynchronizedRecordingPlayback?.();

    tester.expect(synchronizedStart?.countIn).toEqual({
      bars: 1,
      beats: 6,
      durationSeconds: 1.5,
    });
    tester.expect(synchronizedStart?.marker.audioContextTimeSeconds).toBe(31.53);
    tester.expect(audioContext.oscillators.map((oscillator) => oscillator.startWhen)).toEqual([
      30.03,
      30.28,
      30.53,
      30.78,
      31.03,
      31.28,
    ]);
    tester.expect(audioContext.oscillators[0]?.frequency.value).toBe(1760);
    tester.expect(audioContext.oscillators.slice(1).every((oscillator) => oscillator.frequency.value === 880)).toBe(true);

    engine.destroy?.();
  });

  tester.it("schedules an optional phase-aligned metronome with an accented bar downbeat", async () => {
    const { audioContext, engine, tickTransport } = createEngineHarness();
    engine.loadMix(twoChannelMix);
    engine.setMetronomeEnabled?.(true);

    await engine.play();

    tester.expect(audioContext.oscillators.slice(0, 2).map((oscillator) => oscillator.startWhen)).toEqual([
      10.03,
      10.53,
    ]);
    tester.expect(audioContext.oscillators[0]?.frequency.value).toBe(1760);
    tester.expect(audioContext.oscillators[1]?.frequency.value).toBe(880);

    audioContext.currentTime = 10.8;
    tickTransport();

    tester.expect(audioContext.oscillators.slice(0, 4).map((oscillator) => oscillator.startWhen)).toEqual([
      10.03,
      10.53,
      11.03,
      11.53,
    ]);

    engine.destroy?.();
  });

  tester.it("keeps metronome phase aligned after seek, restart, and a loop boundary", async () => {
    const seekHarness = createEngineHarness();
    seekHarness.engine.loadMix(twoChannelMix);
    seekHarness.engine.setMetronomeEnabled?.(true);
    await seekHarness.engine.play();

    seekHarness.audioContext.currentTime = 10.8;
    seekHarness.engine.seekToMusicalPosition({ bar: 2, beat: 2 });

    let recentClicks = seekHarness.audioContext.oscillators.slice(-2);
    tester.expect(
      Math.abs((recentClicks[0]?.startWhen ?? 0) - 10.83) < 1e-9,
    ).toBe(true);
    tester.expect(recentClicks[0]?.frequency.value).toBe(880);

    seekHarness.audioContext.currentTime = 20;
    seekHarness.engine.stop();
    await seekHarness.engine.play();

    recentClicks = seekHarness.audioContext.oscillators.slice(-2);
    tester.expect(
      Math.abs((recentClicks[0]?.startWhen ?? 0) - 20.03) < 1e-9,
    ).toBe(true);
    tester.expect(recentClicks[0]?.frequency.value).toBe(1760);
    seekHarness.engine.destroy?.();

    const loopHarness = createEngineHarness();
    loopHarness.engine.loadMix([{
      channelNumber: 1,
      trackId: "loop",
      playbackDerivativeUrl: "/loop.wav",
      volume: 1,
      enabled: true,
    }]);
    loopHarness.engine.setLoopEnabled(true);
    loopHarness.engine.setMetronomeEnabled?.(true);
    await loopHarness.engine.play();

    const firstSourceStart = loopHarness.audioContext.sources[0]?.startWhen ?? 0;
    const loopBoundary = firstSourceStart + 10;
    loopHarness.audioContext.currentTime = loopBoundary - 0.53;
    loopHarness.tickTransport();

    const loopDownbeat = loopHarness.audioContext.oscillators.find((oscillator) =>
      Math.abs((oscillator.startWhen ?? -1) - loopBoundary) < 1e-9,
    );
    tester.expect(loopDownbeat?.frequency.value).toBe(1760);

    loopHarness.engine.destroy?.();
  });

  tester.it("keeps the mandatory recording count-in independent from the optional metronome toggle", async () => {
    const { audioContext, engine } = createEngineHarness();
    engine.loadMix(twoChannelMix);
    audioContext.currentTime = 40;

    await engine.startSynchronizedRecordingPlayback?.();
    const countInStopTimes = audioContext.oscillators.map((oscillator) => oscillator.stopWhen);

    engine.setMetronomeEnabled?.(true);
    engine.setMetronomeEnabled?.(false);

    tester.expect(audioContext.oscillators.slice(0, 4).map((oscillator) => oscillator.stopWhen)).toEqual(
      countInStopTimes.slice(0, 4),
    );

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

  tester.it("supports seek while stopped and paused without starting sources until play resumes", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix(twoChannelMix);
    await engine.play();
    engine.stop();

    const sourceCountAfterStop = audioContext.sources.length;
    engine.seek(15);

    tester.expect(audioContext.sources.length).toBe(sourceCountAfterStop);
    tester.expect(engine.getSnapshot().currentTime).toBe(15);
    tester.expect(engine.getSnapshot().isPlaying).toBe(false);

    await engine.play();
    let generation = audioContext.sources.slice(-2);
    tester.expect(generation[0]?.startOffset).toBe(15);
    tester.expect(generation[1]?.startOffset).toBe(15);

    const resumedStart = generation[0]?.startWhen ?? 0;
    audioContext.currentTime = resumedStart + 5;
    engine.pause();
    const sourceCountAfterPause = audioContext.sources.length;

    engine.seek(30);
    tester.expect(audioContext.sources.length).toBe(sourceCountAfterPause);
    tester.expect(engine.getSnapshot().currentTime).toBe(30);
    tester.expect(engine.getSnapshot().isPlaying).toBe(false);

    await engine.play();
    generation = audioContext.sources.slice(-2);
    tester.expect(generation[0]?.startOffset).toBe(30);
    tester.expect(generation[1]?.startOffset).toBe(30);

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
        playbackDerivativeUrl: "/loop.wav",
        volume: 1,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "track-2",
        playbackDerivativeUrl: "/long-take.m4a",
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
        playbackDerivativeUrl: "/loop.wav",
        volume: 1,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "long-track",
        playbackDerivativeUrl: "/long-take.m4a",
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
    tester.expect(longSource?.onended).toBe(null);

    const sharedStartTime = longSource?.startWhen ?? 0;
    audioContext.currentTime = sharedStartTime + 20;

    tester.expect(engine.getSnapshot().duration).toBe(60);
    tester.expect(engine.getSnapshot().isPlaying).toBe(true);
    tester.expect(
      Math.abs(engine.getSnapshot().currentTime - 20) < 0.000001,
    ).toBe(true);

    engine.destroy?.();
  });

  tester.it("ends playback from the transport clock without relying on source onended callbacks", async () => {
    const { audioContext, engine, tickTransport } = createEngineHarness();

    engine.loadMix(twoChannelMix);
    await engine.play();

    const firstStartTime = audioContext.sources[0]?.startWhen ?? 0;
    tester.expect(audioContext.sources[0]?.onended).toBe(null);
    tester.expect(audioContext.sources[1]?.onended).toBe(null);

    audioContext.currentTime = firstStartTime + 60;
    tickTransport();

    tester.expect(engine.getSnapshot().currentTime).toBe(60);
    tester.expect(engine.getSnapshot().isPlaying).toBe(false);

    engine.destroy?.();
  });

  tester.it("pre-schedules loop boundaries on the shared Web Audio clock without onended callbacks", async () => {
    const { audioContext, engine, tickTransport } = createEngineHarness();

    engine.loadMix(twoChannelMix);
    engine.setLoopEnabled(true);
    await engine.play();

    const firstGeneration = audioContext.sources.slice(0, 2);
    const secondGeneration = audioContext.sources.slice(2, 4);
    const firstStartTime = firstGeneration[0]?.startWhen ?? 0;
    const secondStartTime = secondGeneration[0]?.startWhen ?? 0;

    tester.expect(audioContext.sources.length).toBe(4);
    tester.expect(firstGeneration[0]?.onended).toBe(null);
    tester.expect(firstGeneration[1]?.onended).toBe(null);
    tester.expect(secondGeneration[0]?.onended).toBe(null);
    tester.expect(secondGeneration[1]?.onended).toBe(null);
    tester.expect(firstGeneration[0]?.startWhen).toBe(
      firstGeneration[1]?.startWhen,
    );
    tester.expect(secondGeneration[0]?.startWhen).toBe(
      secondGeneration[1]?.startWhen,
    );
    tester.expect(
      Math.abs(secondStartTime - (firstStartTime + 60)) < 0.000001,
    ).toBe(true);
    tester.expect(secondGeneration[0]?.startOffset).toBe(0);
    tester.expect(secondGeneration[1]?.startOffset).toBe(0);

    audioContext.currentTime = secondStartTime - 0.5;
    tickTransport();

    const thirdGeneration = audioContext.sources.slice(-2);
    tester.expect(audioContext.sources.length).toBe(6);
    tester.expect(
      Math.abs(
        (thirdGeneration[0]?.startWhen ?? 0) - (secondStartTime + 60),
      ) < 0.000001,
    ).toBe(true);
    tester.expect(thirdGeneration[0]?.startWhen).toBe(
      thirdGeneration[1]?.startWhen,
    );

    audioContext.currentTime = secondStartTime;
    tester.expect(engine.getSnapshot().isPlaying).toBe(true);
    tester.expect(
      Math.abs(engine.getSnapshot().currentTime - 0) < 0.000001,
    ).toBe(true);

    audioContext.currentTime = secondStartTime + 1;
    tester.expect(
      Math.abs(engine.getSnapshot().currentTime - 1) < 0.000001,
    ).toBe(true);

    engine.destroy?.();
  });

  tester.it("cancels future loop generations when loop is disabled without stopping the current generation", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix(twoChannelMix);
    engine.setLoopEnabled(true);
    await engine.play();

    const firstGeneration = audioContext.sources.slice(0, 2);
    const futureLoopGeneration = audioContext.sources.slice(2, 4);
    const firstStartTime = firstGeneration[0]?.startWhen ?? 0;

    audioContext.currentTime = firstStartTime + 10;
    engine.setLoopEnabled(false);

    tester.expect(firstGeneration[0]?.stopCallCount).toBe(0);
    tester.expect(firstGeneration[1]?.stopCallCount).toBe(0);
    tester.expect(futureLoopGeneration[0]?.stopCallCount).toBe(1);
    tester.expect(futureLoopGeneration[1]?.stopCallCount).toBe(1);
    tester.expect(engine.getSnapshot().isPlaying).toBe(true);
    tester.expect(
      Math.abs(engine.getSnapshot().currentTime - 10) < 0.000001,
    ).toBe(true);

    engine.destroy?.();
  });

  tester.it("keeps repeated transport operations aligned across every replacement source generation", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix(twoChannelMix);
    await engine.play();

    const firstStart = audioContext.sources[0]?.startWhen ?? 0;
    audioContext.currentTime = firstStart + 8;
    engine.seek(20);

    let generation = audioContext.sources.slice(-2);
    tester.expect(generation[0]?.startWhen).toBe(generation[1]?.startWhen);
    tester.expect(generation[0]?.startOffset).toBe(20);
    tester.expect(generation[1]?.startOffset).toBe(20);

    const seekStart = generation[0]?.startWhen ?? 0;
    audioContext.currentTime = seekStart + 5;
    engine.pause();
    tester.expect(
      Math.abs(engine.getSnapshot().currentTime - 25) < 0.000001,
    ).toBe(true);

    await engine.play();
    generation = audioContext.sources.slice(-2);
    tester.expect(generation[0]?.startWhen).toBe(generation[1]?.startWhen);
    tester.expect(
      Math.abs((generation[0]?.startOffset ?? 0) - 25) < 0.000001,
    ).toBe(true);
    tester.expect(
      Math.abs((generation[1]?.startOffset ?? 0) - 25) < 0.000001,
    ).toBe(true);

    const resumeStart = generation[0]?.startWhen ?? 0;
    audioContext.currentTime = resumeStart + 3;
    engine.seekBy(7);
    generation = audioContext.sources.slice(-2);
    tester.expect(generation[0]?.startWhen).toBe(generation[1]?.startWhen);
    tester.expect(
      Math.abs((generation[0]?.startOffset ?? 0) - 35) < 0.000001,
    ).toBe(true);
    tester.expect(
      Math.abs((generation[1]?.startOffset ?? 0) - 35) < 0.000001,
    ).toBe(true);

    engine.stop();
    tester.expect(engine.getSnapshot().currentTime).toBe(0);
    tester.expect(engine.getSnapshot().isPlaying).toBe(false);

    await engine.play();
    generation = audioContext.sources.slice(-2);
    tester.expect(generation[0]?.startWhen).toBe(generation[1]?.startWhen);
    tester.expect(generation[0]?.startOffset).toBe(0);
    tester.expect(generation[1]?.startOffset).toBe(0);

    engine.destroy?.();
  });

  tester.it("marks recording start and stop against the same clock that schedules aligned sources", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix(twoChannelMix);
    await engine.play();

    tester.expect(typeof engine.markRecordingStart).toBe("function");
    tester.expect(typeof engine.markRecordingStop).toBe("function");

    if (!engine.markRecordingStart || !engine.markRecordingStop) {
      throw new Error("Web Audio engine must expose recording timeline markers.");
    }

    const firstGeneration = audioContext.sources.slice(0, 2);
    const sharedStartTime = firstGeneration[0]?.startWhen ?? 0;
    tester.expect(firstGeneration[0]?.startWhen).toBe(
      firstGeneration[1]?.startWhen,
    );

    audioContext.currentTime = sharedStartTime + 12;
    const start = engine.markRecordingStart();

    tester.expect(
      Math.abs(start.projectPositionSeconds - 12) < 0.000001,
    ).toBe(true);
    tester.expect(start.musicalPosition).toEqual({ bar: 7, beat: 1 });
    tester.expect(
      Math.abs(start.audioContextTimeSeconds - (sharedStartTime + 12)) <
        0.000001,
    ).toBe(true);

    audioContext.currentTime = sharedStartTime + 18.5;
    const result = engine.markRecordingStop(start);

    tester.expect(
      Math.abs(result.stop.projectPositionSeconds - 18.5) < 0.000001,
    ).toBe(true);
    tester.expect(result.stop.musicalPosition).toEqual({ bar: 10, beat: 2 });
    tester.expect(
      Math.abs(
        result.stop.audioContextTimeSeconds - (sharedStartTime + 18.5),
      ) < 0.000001,
    ).toBe(true);
    tester.expect(
      Math.abs(result.metadata.durationSeconds - 6.5) < 0.000001,
    ).toBe(true);
    tester.expect(
      Math.abs(result.metadata.timelineOffsetSeconds - 12) < 0.000001,
    ).toBe(true);

    engine.destroy?.();
  });

  tester.it("keeps recording markers mapped to project time across a clock-scheduled loop", async () => {
    const { audioContext, engine } = createEngineHarness();

    engine.loadMix(twoChannelMix);
    engine.setLoopEnabled(true);
    await engine.play();

    if (!engine.markRecordingStart || !engine.markRecordingStop) {
      throw new Error("Web Audio engine must expose recording timeline markers.");
    }

    const firstGeneration = audioContext.sources.slice(0, 2);
    const secondGeneration = audioContext.sources.slice(2, 4);
    const firstStartTime = firstGeneration[0]?.startWhen ?? 0;
    const secondStartTime = secondGeneration[0]?.startWhen ?? 0;

    tester.expect(secondGeneration[0]?.startWhen).toBe(
      secondGeneration[1]?.startWhen,
    );
    tester.expect(
      Math.abs(secondStartTime - (firstStartTime + 60)) < 0.000001,
    ).toBe(true);

    audioContext.currentTime = secondStartTime - 1;
    const start = engine.markRecordingStart();
    tester.expect(
      Math.abs(start.projectPositionSeconds - 59) < 0.000001,
    ).toBe(true);

    audioContext.currentTime = secondStartTime + 1;
    const result = engine.markRecordingStop(start);

    tester.expect(
      Math.abs(result.stop.projectPositionSeconds - 1) < 0.000001,
    ).toBe(true);
    tester.expect(result.metadata.durationSeconds).toBe(2);
    tester.expect(
      Math.abs(result.metadata.timelineOffsetSeconds - 59) < 0.000001,
    ).toBe(true);

    engine.destroy?.();
  });

  tester.it("reports the authoritative Web Audio playback schedule to recording diagnostics", async () => {
    const audioContext = Object.assign(createFakeAudioContext(), {
      getOutputTimestamp() {
        return { contextTime: 9.99, performanceTime: 5000 };
      },
      playbackStats: {
        averageLatency: 0.024,
        minimumLatency: 0.02,
        maximumLatency: 0.03,
        totalDuration: 1.5,
        underrunDuration: 0,
        underrunEvents: 0,
      },
    });
    let intervalHandler: (() => void) | null = null;
    const observations: RecordingAlignmentDiagnosticObservation[] = [];
    const diagnostics: RecordingAlignmentDiagnosticsPort = {
      beginAttempt() { return "recording-1"; },
      observe(observation) { observations.push(observation); },
      completeAttempt() {},
      getActiveAttemptId() { return "recording-1"; },
    };
    const engine = createWebAudioPlaybackEngine({
      audioContext,
      musicalTimeline: {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      },
      recordingAlignmentDiagnostics: diagnostics,
      async fetchAudioData() {
        return new Uint8Array([60]).buffer;
      },
      scheduleInterval(handler) {
        intervalHandler = handler;
        return { fakeInterval: true };
      },
      clearScheduledInterval() {},
      onLoadError(error) { throw error; },
    });

    engine.loadMix([twoChannelMix[0]!]);
    await waitForPlaybackReady(engine);
    await engine.play();

    const scheduled = observations.find((observation) =>
      observation.stage === "project-playback-scheduled"
    );
    tester.expect(scheduled?.audioContextTimeSeconds).toBe(10);
    tester.expect(scheduled?.scheduledAudioContextTimeSeconds).toBe(10.03);
    tester.expect(scheduled?.projectPositionSeconds).toBe(0);
    tester.expect(scheduled?.musicalPosition).toEqual({ bar: 1, beat: 1 });
    tester.expect(scheduled?.detail?.outputTimestampSupported).toBe(true);
    tester.expect(
      Math.round(Number(scheduled?.detail?.estimatedScheduledOutputPerformanceTimeMilliseconds ?? -1)),
    ).toBe(5040);
    tester.expect(scheduled?.detail?.audioContextOutputLatencyMilliseconds).toBe(23);
    tester.expect(scheduled?.detail?.audioPlaybackAverageLatencyMilliseconds).toBe(24);

    audioContext.currentTime = 10.3;
    (intervalHandler as (() => void) | null)?.();
    const outputSample = observations.find((observation) =>
      observation.stage === "project-output-clock-sample"
    );
    tester.expect(outputSample?.detail?.sampleOffsetFromPlaybackStartMilliseconds).toBe(250);
    tester.expect(
      Math.round(Number(outputSample?.detail?.outputTimestampCurrentTimeGapMilliseconds ?? -1)),
    ).toBe(310);

    engine.destroy?.();
  });

});
