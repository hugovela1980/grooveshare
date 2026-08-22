import {
  type RecordingAlignmentDiagnosticObservation,
  type RecordingAlignmentDiagnosticsPort,
} from "@hugovela/frontend-core";
import { createBrowserMicrophonePcmAlignmentMonitor } from "../src/browser-microphone-pcm-alignment-monitor.js";
import { tester } from "./test-runner/tester.js";

class FakeConnectableNode {
  disconnectCalls = 0;
  connect(_destination: unknown): unknown {
    return _destination;
  }
  disconnect(): void {
    this.disconnectCalls += 1;
  }
}

class FakeGainNode extends FakeConnectableNode {
  readonly gain = { value: 1 };
}

class FakeAudioContext {
  static instance: FakeAudioContext | null = null;
  currentTime = 2;
  sampleRate = 48_000;
  state = "suspended";
  baseLatency = 0.004;
  outputLatency = 0.02;
  destination = {};
  closed = false;
  resumed = false;
  readonly sourceNode = new FakeConnectableNode();
  readonly gainNode = new FakeGainNode();
  readonly audioWorklet = {
    async addModule(_url: string) {},
  };

  constructor() {
    FakeAudioContext.instance = this;
  }

  createMediaStreamSource(_stream: MediaStream): FakeConnectableNode {
    return this.sourceNode;
  }

  createGain(): FakeGainNode {
    return this.gainNode;
  }

  async resume(): Promise<void> {
    this.resumed = true;
    this.state = "running";
  }

  async close(): Promise<void> {
    this.closed = true;
    this.state = "closed";
  }
}

class FakeAudioWorkletNode extends FakeConnectableNode {
  static instance: FakeAudioWorkletNode | null = null;
  readonly port: {
    onmessage: ((event: MessageEvent<unknown>) => void) | null;
  } = { onmessage: null };

  constructor(
    _context: unknown,
    _name: string,
    _options?: AudioWorkletNodeOptions,
  ) {
    super();
    FakeAudioWorkletNode.instance = this;
  }

  emitTransient(): void {
    this.port.onmessage?.({
      data: {
        type: "transient",
        transientIndex: 1,
        audioContextTimeSeconds: 2.4,
        audioFrame: 19_200,
        peakAmplitude: 0.75,
      },
    } as MessageEvent<unknown>);
  }
}

tester.describe("browser microphone PCM alignment monitor", () => {
  tester.beforeEach(() => {
    FakeAudioContext.instance = null;
    FakeAudioWorkletNode.instance = null;
  });

  tester.it("timestamps live PCM transients before MediaRecorder encoding", async () => {
    const observations: RecordingAlignmentDiagnosticObservation[] = [];
    const diagnostics: RecordingAlignmentDiagnosticsPort = {
      beginAttempt() { return "recording-1"; },
      observe(observation) { observations.push(observation); },
      completeAttempt() {},
      getActiveAttemptId() { return "recording-1"; },
    };
    const revokedUrls: string[] = [];
    const monitor = await createBrowserMicrophonePcmAlignmentMonitor({
      stream: {} as MediaStream,
      recordingAlignmentDiagnostics: diagnostics,
      AudioContextConstructor: FakeAudioContext,
      AudioWorkletNodeConstructor: FakeAudioWorkletNode,
      urlApi: {
        createObjectURL() { return "blob:pcm-monitor"; },
        revokeObjectURL(url) { revokedUrls.push(url); },
      },
      BlobConstructor: Blob,
    });

    tester.expect(monitor === null).toBe(false);
    tester.expect(FakeAudioContext.instance?.resumed).toBe(true);
    tester.expect(revokedUrls).toEqual(["blob:pcm-monitor"]);

    monitor?.markAttemptClockAnchor();
    FakeAudioWorkletNode.instance?.emitTransient();

    tester.expect(observations.map((observation) => observation.stage)).toEqual([
      "microphone-pcm-clock-anchor",
      "microphone-pcm-transient-detected",
    ]);
    tester.expect(observations[0]?.audioContextTimeSeconds).toBe(2);
    tester.expect(observations[1]?.audioContextTimeSeconds).toBe(2.4);
    tester.expect(observations[1]?.detail?.peakAmplitude).toBe(0.75);

    await monitor?.release();
    tester.expect(FakeAudioContext.instance?.closed).toBe(true);
  });
});
