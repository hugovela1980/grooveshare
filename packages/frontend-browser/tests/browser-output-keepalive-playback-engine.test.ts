import type {
  PlaybackChannel,
  PlaybackEngine,
  PlaybackSnapshot,
  PlaybackStateListener,
  RecordedTakeAuditionOptions,
  RecordingStartMarker,
  SynchronizedRecordingPlaybackStart,
} from "@hugovela/frontend-core";
import {
  BROWSER_OUTPUT_KEEPALIVE_FREQUENCY_HZ,
  BROWSER_OUTPUT_KEEPALIVE_LEVEL_DB,
  BROWSER_OUTPUT_KEEPALIVE_RECENTLY_ACTIVE_MS,
  BROWSER_OUTPUT_KEEPALIVE_WARMUP_MS,
  createBrowserOutputKeepalivePlaybackEngine,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

class FakeGainParam {
  value = 1;
  ramps: Array<{ value: number; time: number }> = [];
  cancelScheduledValues(): void {}
  setValueAtTime(value: number): void {
    this.value = value;
  }
  linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.ramps.push({ value, time });
  }
}

class FakeGainNode {
  gain = new FakeGainParam();
  connectedTo: unknown = null;
  disconnectCalls = 0;
  connect(destination: unknown): void {
    this.connectedTo = destination;
  }
  disconnect(): void {
    this.disconnectCalls += 1;
  }
}

class FakeOscillatorNode {
  type = "sine";
  frequency = { value: 0 };
  connectedTo: unknown = null;
  startCalls = 0;
  stopCalls: number[] = [];
  disconnectCalls = 0;
  connect(destination: unknown): void {
    this.connectedTo = destination;
  }
  start(): void {
    this.startCalls += 1;
  }
  stop(when = 0): void {
    this.stopCalls.push(when);
  }
  disconnect(): void {
    this.disconnectCalls += 1;
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 10;
  state = "running";
  destination = { name: "destination" };
  gain = new FakeGainNode();
  oscillator = new FakeOscillatorNode();
  resumeCalls = 0;
  closeCalls = 0;

  constructor(_options?: { latencyHint?: "interactive" }) {
    FakeAudioContext.instances.push(this);
  }

  createGain(): FakeGainNode {
    return this.gain;
  }

  createOscillator(): FakeOscillatorNode {
    return this.oscillator;
  }

  async resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = "running";
  }

  async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class FakePlaybackEngine implements PlaybackEngine {
  playCalls = 0;
  pauseCalls = 0;
  stopCalls = 0;
  synchronizedPlayCalls = 0;
  auditionCalls = 0;
  stopAuditionCalls = 0;
  lastAuditionOptions: RecordedTakeAuditionOptions | null = null;
  metronomeValues: boolean[] = [];
  destroyCalls = 0;
  retryCalls = 0;
  snapshot: PlaybackSnapshot = {
    currentTime: 0,
    musicalPosition: { bar: 1, beat: 1 },
    duration: 16,
    isPlaying: false,
    hasLoadedChannels: true,
    preparation: {
      status: "ready",
      requiredChannelCount: 1,
      readyRequiredChannelCount: 1,
      channels: [],
      failure: null,
    },
  };
  listeners = new Set<PlaybackStateListener>();

  loadMix(_channels: PlaybackChannel[]): void {}
  retryPreparation(): void {
    this.retryCalls += 1;
  }

  async play(): Promise<void> {
    this.playCalls += 1;
    this.setPlaying(true);
  }

  pause(): void {
    this.pauseCalls += 1;
    this.setPlaying(false);
  }

  stop(): void {
    this.stopCalls += 1;
    this.setPlaying(false);
  }

  seek(seconds: number): void {
    this.snapshot = { ...this.snapshot, currentTime: seconds };
  }

  seekBy(seconds: number): void {
    this.seek(this.snapshot.currentTime + seconds);
  }

  seekToMusicalPosition(position: { bar: number; beat: number }): void {
    this.snapshot = { ...this.snapshot, musicalPosition: position };
  }

  setLoopEnabled(_enabled: boolean): void {}
  setMetronomeEnabled(enabled: boolean): void {
    this.metronomeValues.push(enabled);
  }
  setChannelVolume(_channelNumber: number, _volume: number): boolean {
    return true;
  }
  setChannelEnabled(_channelNumber: number, _enabled: boolean): boolean {
    return true;
  }

  getSnapshot(): PlaybackSnapshot {
    return this.snapshot;
  }

  subscribe(listener: PlaybackStateListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async startSynchronizedRecordingPlayback(): Promise<SynchronizedRecordingPlaybackStart> {
    this.synchronizedPlayCalls += 1;
    this.setPlaying(true);
    return {
      marker: {
        kind: "recording-start",
        projectPositionSeconds: this.snapshot.currentTime,
        musicalPosition: { ...this.snapshot.musicalPosition },
        audioContextTimeSeconds: 12.5,
        playbackState: "playing",
      },
      mediaLeadInSeconds: 2.03,
      countIn: { bars: 1, beats: 4, durationSeconds: 2 },
    };
  }

  async auditionRecordedTake(options: RecordedTakeAuditionOptions): Promise<void> {
    this.auditionCalls += 1;
    this.lastAuditionOptions = options;
    this.setPlaying(true);
  }

  stopRecordedTakeAudition(): void {
    this.stopAuditionCalls += 1;
  }

  auditionVolume = 1;
  setRecordedTakeAuditionVolume(volume: number): void {
    this.auditionVolume = volume;
  }

  markRecordingStart(): RecordingStartMarker {
    return {
      kind: "recording-start",
      projectPositionSeconds: this.snapshot.currentTime,
      musicalPosition: { ...this.snapshot.musicalPosition },
      audioContextTimeSeconds: 12.5,
      playbackState: "playing",
    };
  }

  markRecordingStop(start: RecordingStartMarker) {
    const stop = {
      kind: "recording-stop" as const,
      projectPositionSeconds: this.snapshot.currentTime + 0.5,
      musicalPosition: { ...this.snapshot.musicalPosition },
      audioContextTimeSeconds: 13,
      playbackState: "stopped" as const,
    };
    return {
      start,
      stop,
      metadata: {
        startProjectPositionSeconds: start.projectPositionSeconds,
        stopProjectPositionSeconds: stop.projectPositionSeconds,
        startAudioContextTimeSeconds: start.audioContextTimeSeconds,
        stopAudioContextTimeSeconds: stop.audioContextTimeSeconds,
        durationSeconds: 0.5,
        timelineOffsetSeconds: start.projectPositionSeconds,
      },
    };
  }

  destroy(): void {
    this.destroyCalls += 1;
  }

  setPlaying(isPlaying: boolean): void {
    this.snapshot = { ...this.snapshot, isPlaying };
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }
}

function createHarness() {
  FakeAudioContext.instances = [];
  const playbackEngine = new FakePlaybackEngine();
  const scheduled: Array<{ handler: () => void; milliseconds: number }> = [];
  let now = 1000;

  const engine = createBrowserOutputKeepalivePlaybackEngine({
    playbackEngine,
    AudioContextConstructor: FakeAudioContext,
    nowMilliseconds: () => now,
    scheduleTimeout(handler, milliseconds) {
      scheduled.push({ handler, milliseconds });
      return scheduled.length;
    },
  });

  return {
    engine,
    playbackEngine,
    scheduled,
    setNow(value: number) {
      now = value;
    },
    runNextTimer() {
      const timer = scheduled.shift();
      if (!timer) {
        throw new Error("Expected a scheduled timer.");
      }
      timer.handler();
      return timer;
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

tester.describe("browser output keepalive playback engine", () => {
  tester.it("uses the measured compatibility defaults", () => {
    tester.expect(BROWSER_OUTPUT_KEEPALIVE_FREQUENCY_HZ).toBe(20_000);
    tester.expect(BROWSER_OUTPUT_KEEPALIVE_LEVEL_DB).toBe(-54);
    tester.expect(BROWSER_OUTPUT_KEEPALIVE_WARMUP_MS).toBe(400);
    tester.expect(BROWSER_OUTPUT_KEEPALIVE_RECENTLY_ACTIVE_MS).toBe(400);
  });

  tester.it("refuses early Play before warming the output route and forwards preparation retry", async () => {
    const harness = createHarness();
    harness.playbackEngine.snapshot = {
      ...harness.playbackEngine.snapshot,
      hasLoadedChannels: false,
      preparation: {
        status: "preparing",
        requiredChannelCount: 1,
        readyRequiredChannelCount: 0,
        channels: [],
        failure: null,
      },
    };

    await harness.engine.play();
    tester.expect(harness.playbackEngine.playCalls).toBe(0);
    tester.expect(FakeAudioContext.instances.length).toBe(0);

    harness.engine.retryPreparation?.();
    tester.expect(harness.playbackEngine.retryCalls).toBe(1);
  });

  tester.it("warms a cold output route before delegating playback", async () => {
    const harness = createHarness();
    const playPromise = harness.engine.play();
    await flushMicrotasks();

    tester.expect(harness.playbackEngine.playCalls).toBe(0);
    tester.expect(FakeAudioContext.instances.length).toBe(1);
    tester.expect(FakeAudioContext.instances[0]?.oscillator.frequency.value).toBe(20_000);
    tester.expect(FakeAudioContext.instances[0]?.gain.gain.value).toBe(
      10 ** (-54 / 20),
    );
    tester.expect(harness.scheduled.length).toBe(1);
    tester.expect(harness.scheduled[0]?.milliseconds).toBe(400);

    harness.runNextTimer();
    await playPromise;

    tester.expect(harness.playbackEngine.playCalls).toBe(1);
    tester.expect(FakeAudioContext.instances[0]?.oscillator.startCalls).toBe(1);
  });

  tester.it("cancels a cold playback start when Stop is pressed during warm-up", async () => {
    const harness = createHarness();
    const playPromise = harness.engine.play();
    await flushMicrotasks();

    harness.engine.stop();
    harness.runNextTimer();
    await playPromise;
    await flushMicrotasks();

    tester.expect(harness.playbackEngine.playCalls).toBe(0);
    tester.expect(harness.playbackEngine.stopCalls).toBe(1);
    tester.expect(FakeAudioContext.instances[0]?.closeCalls).toBe(1);
  });

  tester.it("keeps the compatibility tone alive for synchronized recording playback", async () => {
    const harness = createHarness();
    const startPromise = harness.engine.startSynchronizedRecordingPlayback!();
    await flushMicrotasks();

    tester.expect(harness.playbackEngine.synchronizedPlayCalls).toBe(0);
    harness.runNextTimer();
    const result = await startPromise;

    tester.expect(harness.playbackEngine.synchronizedPlayCalls).toBe(1);
    tester.expect(result.marker.audioContextTimeSeconds).toBe(12.5);
    tester.expect(Math.abs(result.mediaLeadInSeconds - 2.43) < 1e-9).toBe(true);
    tester.expect(result.countIn).toEqual({ bars: 1, beats: 4, durationSeconds: 2 });
    tester.expect(FakeAudioContext.instances[0]?.closeCalls).toBe(0);
  });

  tester.it("warms the Android route before sample-accurate recorded-take audition", async () => {
    const harness = createHarness();
    harness.engine.setRecordedTakeAuditionVolume!(0.4);
    tester.expect(harness.playbackEngine.auditionVolume).toBe(0.4);
    const auditionPromise = harness.engine.auditionRecordedTake!({
      capture: { bytes: new Uint8Array([1, 2, 3]), mimeType: "audio/webm" },
      projectStartSeconds: 8,
      alignmentOffsetSeconds: 0.26,
      mediaLeadInSeconds: 2.43,
    });
    await flushMicrotasks();

    tester.expect(harness.playbackEngine.auditionCalls).toBe(0);
    tester.expect(harness.scheduled[0]?.milliseconds).toBe(400);

    harness.runNextTimer();
    await auditionPromise;

    tester.expect(harness.playbackEngine.auditionCalls).toBe(1);
    tester.expect(harness.playbackEngine.lastAuditionOptions?.alignmentOffsetSeconds).toBe(0.26);
    tester.expect(FakeAudioContext.instances[0]?.closeCalls).toBe(0);
  });

  tester.it("stops keepalive on Stop and skips warm-up during the measured residual-awake window", async () => {
    const harness = createHarness();
    const firstPlay = harness.engine.play();
    await flushMicrotasks();
    harness.runNextTimer();
    await firstPlay;

    harness.setNow(2000);
    harness.engine.stop();
    await flushMicrotasks();

    tester.expect(FakeAudioContext.instances[0]?.closeCalls).toBe(1);
    tester.expect(harness.playbackEngine.stopCalls).toBe(1);

    harness.setNow(2390);
    await harness.engine.play();

    tester.expect(harness.playbackEngine.playCalls).toBe(2);
    tester.expect(FakeAudioContext.instances.length).toBe(2);
    tester.expect(harness.scheduled.length).toBe(0);
  });

  tester.it("warms again after the residual-awake window expires", async () => {
    const harness = createHarness();
    const firstPlay = harness.engine.play();
    await flushMicrotasks();
    harness.runNextTimer();
    await firstPlay;

    harness.setNow(2000);
    harness.engine.stop();
    await flushMicrotasks();

    harness.setNow(2401);
    const secondPlay = harness.engine.play();
    await flushMicrotasks();

    tester.expect(harness.playbackEngine.playCalls).toBe(1);
    tester.expect(harness.scheduled.length).toBe(1);
    tester.expect(harness.scheduled[0]?.milliseconds).toBe(400);

    harness.runNextTimer();
    await secondPlay;
    tester.expect(harness.playbackEngine.playCalls).toBe(2);
  });

  tester.it("stops keepalive when playback ends naturally", async () => {
    const harness = createHarness();
    const playPromise = harness.engine.play();
    await flushMicrotasks();
    harness.runNextTimer();
    await playPromise;

    harness.setNow(5000);
    harness.playbackEngine.setPlaying(false);
    await flushMicrotasks();

    tester.expect(FakeAudioContext.instances[0]?.closeCalls).toBe(1);
  });

  tester.it("falls back to immediate playback when AudioContext keepalive is unavailable", async () => {
    const playbackEngine = new FakePlaybackEngine();
    const engine = createBrowserOutputKeepalivePlaybackEngine({
      playbackEngine,
      AudioContextConstructor: null,
    });

    await engine.play();
    tester.expect(playbackEngine.playCalls).toBe(1);
  });

  tester.it("delegates the optional metronome toggle without changing output keepalive lifecycle", () => {
    const harness = createHarness();

    harness.engine.setMetronomeEnabled?.(true);
    harness.engine.setMetronomeEnabled?.(false);

    tester.expect(harness.playbackEngine.metronomeValues).toEqual([true, false]);
    tester.expect(FakeAudioContext.instances.length).toBe(0);
  });

  tester.it("tears down the keepalive and delegated engine on destroy", async () => {
    const harness = createHarness();
    const playPromise = harness.engine.play();
    await flushMicrotasks();
    harness.runNextTimer();
    await playPromise;

    harness.engine.destroy?.();
    await flushMicrotasks();

    tester.expect(harness.playbackEngine.destroyCalls).toBe(1);
    tester.expect(FakeAudioContext.instances[0]?.closeCalls).toBe(1);
  });
});
