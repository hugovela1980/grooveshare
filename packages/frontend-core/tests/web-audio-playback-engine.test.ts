import {
  createWebAudioPlaybackEngine,
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

  const engine = createWebAudioPlaybackEngine({
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

  return {
    audioContext,
    engine,
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
        channelNumber: 1, trackId: "saved", audioUrl: "/long-take.m4a",
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
      audioUrl: "/long-take.m4a",
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
        audioUrl: "/recorded-take.webm",
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
        audioUrl: "/legacy-seeded-track.wav",
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
        audioUrl: "/drums.wav",
        volume: 1,
        enabled: true,
      },
      {
        channelNumber: 2,
        trackId: "later-track",
        audioUrl: "/recorded-take.webm",
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
      audioUrl: "/recorded-take.webm",
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
      audioUrl: "/recorded-take.webm",
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
      audioUrl: "/recorded-take.webm",
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
      audioUrl: "/loop.wav",
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
