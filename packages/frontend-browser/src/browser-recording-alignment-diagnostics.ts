import {
  analyzeRecordingAlignmentTrace,
  cloneRecordingAlignmentTrace,
  type RecordingAlignmentAttemptContext,
  type RecordingAlignmentAttemptOutcome,
  type RecordingAlignmentDiagnosticObservation,
  type RecordingAlignmentDiagnosticsPort,
  type RecordingAlignmentDiagnosticTrace,
} from "@hugovela/frontend-core";

export type BrowserRecordingAlignmentDiagnosticLogger = {
  info(message: string, details?: unknown): void;
  table?(data: unknown): void;
};

export type BrowserRecordingAlignmentDiagnosticsOptions = {
  getMonotonicTimeMilliseconds?: () => number;
  logger?: BrowserRecordingAlignmentDiagnosticLogger;
  maxCompletedTraces?: number;
};

export interface BrowserRecordingAlignmentDiagnostics
  extends RecordingAlignmentDiagnosticsPort {
  getCompletedTraces(): RecordingAlignmentDiagnosticTrace[];
  getActiveTrace(): RecordingAlignmentDiagnosticTrace | null;
  clearCompletedTraces(): void;
}

function getDefaultMonotonicTimeMilliseconds(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function getDefaultLogger(): BrowserRecordingAlignmentDiagnosticLogger {
  return {
    info(message, details) {
      console.info(message, details);
    },
    table(data) {
      console.table(data);
    },
  };
}

function normalizeMaxCompletedTraces(value: number | undefined): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return 20;
  }

  return Math.max(1, Math.floor(value ?? 20));
}

function formatEventRows(trace: RecordingAlignmentDiagnosticTrace) {
  return trace.events.map((event) => ({
    seq: event.sequence,
    stage: event.stage,
    source: event.source,
    browserMs: Number(event.observedAtMilliseconds.toFixed(3)),
    audioClockSeconds:
      event.audioContextTimeSeconds === undefined
        ? ""
        : Number(event.audioContextTimeSeconds.toFixed(6)),
    scheduledAudioClockSeconds:
      event.scheduledAudioContextTimeSeconds === undefined
        ? ""
        : Number(event.scheduledAudioContextTimeSeconds.toFixed(6)),
    projectSeconds:
      event.projectPositionSeconds === undefined
        ? ""
        : Number(event.projectPositionSeconds.toFixed(6)),
    musicalPosition: event.musicalPosition
      ? `Bar ${event.musicalPosition.bar}, Beat ${Number(event.musicalPosition.beat.toFixed(4))}`
      : "",
    detail: event.detail ?? "",
  }));
}

/**
 * Browser-side correlated recording trace collector.
 *
 * Every observation is stamped with the same monotonic performance clock while
 * Web Audio observations may additionally carry AudioContext time. Completed
 * traces are emitted as structured console output for desktop DevTools or
 * Android remote debugging and retained in memory for tests/debugging.
 */
export function createBrowserRecordingAlignmentDiagnostics({
  getMonotonicTimeMilliseconds = getDefaultMonotonicTimeMilliseconds,
  logger = getDefaultLogger(),
  maxCompletedTraces,
}: BrowserRecordingAlignmentDiagnosticsOptions = {}): BrowserRecordingAlignmentDiagnostics {
  let attemptCounter = 0;
  let activeTrace: RecordingAlignmentDiagnosticTrace | null = null;
  let completedTraces: RecordingAlignmentDiagnosticTrace[] = [];
  const completedTraceLimit = normalizeMaxCompletedTraces(maxCompletedTraces);

  function beginAttempt(
    context: RecordingAlignmentAttemptContext = {},
  ): string {
    if (activeTrace) {
      completeAttempt("aborted");
    }

    attemptCounter += 1;
    const attemptId = `recording-${attemptCounter}`;
    const startedAtMilliseconds = getMonotonicTimeMilliseconds();

    activeTrace = {
      attemptId,
      context: {
        projectId: context.projectId,
        musicalTimeline: context.musicalTimeline
          ? {
              bpm: context.musicalTimeline.bpm,
              timeSignature: { ...context.musicalTimeline.timeSignature },
            }
          : undefined,
      },
      startedAtMilliseconds,
      completedAtMilliseconds: null,
      outcome: null,
      events: [],
    };

    observe({
      stage: "attempt-started",
      source: "recording-session",
      detail: {
        bpm: context.musicalTimeline?.bpm ?? null,
        timeSignature: context.musicalTimeline
          ? `${context.musicalTimeline.timeSignature.numerator}/${context.musicalTimeline.timeSignature.denominator}`
          : "unknown",
      },
    });

    return attemptId;
  }

  function observe(
    observation: RecordingAlignmentDiagnosticObservation,
  ): void {
    if (!activeTrace) {
      return;
    }

    activeTrace.events.push({
      ...observation,
      musicalPosition: observation.musicalPosition
        ? { ...observation.musicalPosition }
        : undefined,
      detail: observation.detail ? { ...observation.detail } : undefined,
      attemptId: activeTrace.attemptId,
      sequence: activeTrace.events.length + 1,
      observedAtMilliseconds: getMonotonicTimeMilliseconds(),
    });
  }

  function completeAttempt(outcome: RecordingAlignmentAttemptOutcome): void {
    if (!activeTrace) {
      return;
    }

    const completionStage =
      outcome === "completed"
        ? "attempt-completed"
        : outcome === "failed"
          ? "attempt-failed"
          : "attempt-aborted";
    const lastStage = activeTrace.events.at(-1)?.stage;

    if (lastStage !== completionStage) {
      observe({
        stage: completionStage,
        source: "recording-session",
      });
    }

    activeTrace.completedAtMilliseconds = getMonotonicTimeMilliseconds();
    activeTrace.outcome = outcome;
    const completed = cloneRecordingAlignmentTrace(activeTrace);
    completedTraces.push(completed);

    if (completedTraces.length > completedTraceLimit) {
      completedTraces = completedTraces.slice(-completedTraceLimit);
    }

    const analysis = analyzeRecordingAlignmentTrace(completed);
    logger.info(
      `[GrooveShare][Recording Alignment] ${completed.attemptId} ${outcome}`,
      {
        context: completed.context,
        analysis,
        trace: completed,
      },
    );
    logger.table?.(formatEventRows(completed));
    activeTrace = null;
  }

  return {
    beginAttempt,
    observe,
    completeAttempt,
    getActiveAttemptId() {
      return activeTrace?.attemptId ?? null;
    },
    getCompletedTraces() {
      return completedTraces.map(cloneRecordingAlignmentTrace);
    },
    getActiveTrace() {
      return activeTrace ? cloneRecordingAlignmentTrace(activeTrace) : null;
    },
    clearCompletedTraces() {
      completedTraces = [];
    },
  };
}
