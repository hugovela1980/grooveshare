import type { RecordingAlignmentDiagnosticsPort } from "@hugovela/frontend-core";

const PROCESSOR_NAME = "grooveshare-recording-alignment-pcm-monitor";
const DEFAULT_TRANSIENT_THRESHOLD = 0.04;
const DEFAULT_REFRACTORY_MILLISECONDS = 180;
const MAX_TRANSIENTS_PER_ATTEMPT = 64;

const PROCESSOR_SOURCE = `
class GrooveShareRecordingAlignmentPcmMonitor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = options && options.processorOptions ? options.processorOptions : {};
    this.threshold = Number.isFinite(processorOptions.threshold)
      ? processorOptions.threshold
      : ${DEFAULT_TRANSIENT_THRESHOLD};
    const refractoryMilliseconds = Number.isFinite(processorOptions.refractoryMilliseconds)
      ? processorOptions.refractoryMilliseconds
      : ${DEFAULT_REFRACTORY_MILLISECONDS};
    this.refractoryFrames = Math.max(1, Math.round(sampleRate * refractoryMilliseconds / 1000));
    this.framesSinceTransient = this.refractoryFrames;
    this.transientIndex = 0;
  }

  process(inputs) {
    const channels = inputs[0] || [];
    let peakAmplitude = 0;
    let blockFrames = 128;

    for (const channel of channels) {
      blockFrames = channel.length || blockFrames;
      for (let index = 0; index < channel.length; index += 1) {
        const amplitude = Math.abs(channel[index]);
        if (amplitude > peakAmplitude) {
          peakAmplitude = amplitude;
        }
      }
    }

    if (
      peakAmplitude >= this.threshold &&
      this.framesSinceTransient >= this.refractoryFrames
    ) {
      this.transientIndex += 1;
      this.port.postMessage({
        type: "transient",
        transientIndex: this.transientIndex,
        audioContextTimeSeconds: currentTime,
        audioFrame: currentFrame,
        peakAmplitude,
      });
      this.framesSinceTransient = 0;
    } else {
      this.framesSinceTransient += blockFrames;
    }

    return true;
  }
}

registerProcessor("${PROCESSOR_NAME}", GrooveShareRecordingAlignmentPcmMonitor);
`;

type AudioWorkletLike = {
  addModule(url: string): Promise<void>;
};

type MediaStreamAudioSourceNodeLike = {
  connect(destination: unknown): unknown;
  disconnect(): void;
};

type GainParamLike = {
  value: number;
};

type GainNodeLike = {
  gain: GainParamLike;
  connect(destination: unknown): unknown;
  disconnect(): void;
};

type AudioContextLike = {
  currentTime: number;
  sampleRate: number;
  state: string;
  baseLatency?: number;
  outputLatency?: number;
  destination: unknown;
  audioWorklet?: AudioWorkletLike;
  createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNodeLike;
  createGain(): GainNodeLike;
  resume(): Promise<void>;
  close(): Promise<void>;
};

type AudioContextConstructorLike = new () => AudioContextLike;

type MessagePortLike = {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
};

type AudioWorkletNodeLike = {
  port: MessagePortLike;
  connect(destination: unknown): unknown;
  disconnect(): void;
};

type AudioWorkletNodeConstructorLike = new (
  context: AudioContextLike,
  name: string,
  options?: AudioWorkletNodeOptions,
) => AudioWorkletNodeLike;

type UrlApiLike = {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
};

export type BrowserMicrophonePcmAlignmentMonitor = {
  markAttemptClockAnchor(): void;
  release(): Promise<void>;
};

export type BrowserMicrophonePcmAlignmentMonitorOptions = {
  stream: MediaStream;
  recordingAlignmentDiagnostics: RecordingAlignmentDiagnosticsPort;
  transientThreshold?: number;
  refractoryMilliseconds?: number;
  AudioContextConstructor?: AudioContextConstructorLike | null;
  AudioWorkletNodeConstructor?: AudioWorkletNodeConstructorLike | null;
  urlApi?: UrlApiLike | null;
  BlobConstructor?: typeof Blob | null;
};

type PcmTransientMessage = {
  type: "transient";
  transientIndex: number;
  audioContextTimeSeconds: number;
  audioFrame: number;
  peakAmplitude: number;
};

function getDefaultAudioContextConstructor(): AudioContextConstructorLike | null {
  const browserGlobal = globalThis as typeof globalThis & {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  const Constructor = browserGlobal.AudioContext ?? browserGlobal.webkitAudioContext;
  return Constructor
    ? (Constructor as unknown as AudioContextConstructorLike)
    : null;
}

function getDefaultAudioWorkletNodeConstructor(): AudioWorkletNodeConstructorLike | null {
  if (typeof AudioWorkletNode === "undefined") {
    return null;
  }

  return AudioWorkletNode as unknown as AudioWorkletNodeConstructorLike;
}

function getDefaultUrlApi(): UrlApiLike | null {
  if (typeof URL === "undefined") {
    return null;
  }

  return URL;
}

function getDefaultBlobConstructor(): typeof Blob | null {
  return typeof Blob === "undefined" ? null : Blob;
}

function isPcmTransientMessage(value: unknown): value is PcmTransientMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PcmTransientMessage>;
  return (
    candidate.type === "transient" &&
    typeof candidate.transientIndex === "number" &&
    typeof candidate.audioContextTimeSeconds === "number" &&
    typeof candidate.audioFrame === "number" &&
    typeof candidate.peakAmplitude === "number"
  );
}

/**
 * Diagnostic-only microphone PCM tap implemented with AudioWorklet.
 *
 * It observes the live getUserMedia stream before MediaRecorder encoding. The
 * node emits silence into a zero-gain branch so the graph stays rendered
 * without feeding the microphone back to the user.
 */
export async function createBrowserMicrophonePcmAlignmentMonitor({
  stream,
  recordingAlignmentDiagnostics,
  transientThreshold = DEFAULT_TRANSIENT_THRESHOLD,
  refractoryMilliseconds = DEFAULT_REFRACTORY_MILLISECONDS,
  AudioContextConstructor = getDefaultAudioContextConstructor(),
  AudioWorkletNodeConstructor = getDefaultAudioWorkletNodeConstructor(),
  urlApi = getDefaultUrlApi(),
  BlobConstructor = getDefaultBlobConstructor(),
}: BrowserMicrophonePcmAlignmentMonitorOptions): Promise<BrowserMicrophonePcmAlignmentMonitor | null> {
  if (
    !AudioContextConstructor ||
    !AudioWorkletNodeConstructor ||
    !urlApi ||
    !BlobConstructor
  ) {
    return null;
  }

  const audioContext = new AudioContextConstructor();

  if (!audioContext.audioWorklet) {
    await audioContext.close();
    return null;
  }

  let moduleUrl: string | null = null;
  let sourceNode: MediaStreamAudioSourceNodeLike | null = null;
  let workletNode: AudioWorkletNodeLike | null = null;
  let silentGainNode: GainNodeLike | null = null;
  let released = false;
  let transientCountForAttempt = 0;

  try {
    const moduleBlob = new BlobConstructor([PROCESSOR_SOURCE], {
      type: "text/javascript",
    });
    moduleUrl = urlApi.createObjectURL(moduleBlob);
    await audioContext.audioWorklet.addModule(moduleUrl);
    urlApi.revokeObjectURL(moduleUrl);
    moduleUrl = null;

    if (audioContext.state !== "running") {
      await audioContext.resume();
    }

    sourceNode = audioContext.createMediaStreamSource(stream);
    silentGainNode = audioContext.createGain();
    silentGainNode.gain.value = 0;
    workletNode = new AudioWorkletNodeConstructor(audioContext, PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: {
        threshold: transientThreshold,
        refractoryMilliseconds,
      },
    });

    workletNode.port.onmessage = (event) => {
      if (
        released ||
        transientCountForAttempt >= MAX_TRANSIENTS_PER_ATTEMPT ||
        !recordingAlignmentDiagnostics.getActiveAttemptId() ||
        !isPcmTransientMessage(event.data)
      ) {
        return;
      }

      transientCountForAttempt += 1;
      recordingAlignmentDiagnostics.observe({
        stage: "microphone-pcm-transient-detected",
        source: "microphone-pcm-monitor",
        audioContextTimeSeconds: event.data.audioContextTimeSeconds,
        detail: {
          transientIndex: transientCountForAttempt,
          processorTransientIndex: event.data.transientIndex,
          audioFrame: event.data.audioFrame,
          peakAmplitude: event.data.peakAmplitude,
        },
      });
    };

    sourceNode.connect(workletNode);
    workletNode.connect(silentGainNode);
    silentGainNode.connect(audioContext.destination);
  } catch (error) {
    if (moduleUrl) {
      urlApi.revokeObjectURL(moduleUrl);
    }
    workletNode?.disconnect();
    sourceNode?.disconnect();
    silentGainNode?.disconnect();
    await audioContext.close();
    throw error;
  }

  return {
    markAttemptClockAnchor() {
      if (released) {
        return;
      }

      transientCountForAttempt = 0;
      recordingAlignmentDiagnostics.observe({
        stage: "microphone-pcm-clock-anchor",
        source: "microphone-pcm-monitor",
        audioContextTimeSeconds: audioContext.currentTime,
        detail: {
          sampleRate: audioContext.sampleRate,
          contextState: audioContext.state,
          baseLatencyMilliseconds:
            typeof audioContext.baseLatency === "number"
              ? audioContext.baseLatency * 1000
              : null,
          outputLatencyMilliseconds:
            typeof audioContext.outputLatency === "number"
              ? audioContext.outputLatency * 1000
              : null,
          transientThreshold,
          refractoryMilliseconds,
        },
      });
    },

    async release() {
      if (released) {
        return;
      }

      released = true;
      if (workletNode) {
        workletNode.port.onmessage = null;
        workletNode.disconnect();
      }
      sourceNode?.disconnect();
      silentGainNode?.disconnect();
      await audioContext.close();
    },
  };
}
