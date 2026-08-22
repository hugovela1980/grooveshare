import {
  analyzeRecordingAlignmentTrace,
  cloneRecordingAlignmentTrace,
  type RecordingAlignmentDiagnosticTrace,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

const trace: RecordingAlignmentDiagnosticTrace = {
  attemptId: "recording-1",
  context: {
    projectId: "project-1",
    musicalTimeline: {
      bpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
    },
  },
  startedAtMilliseconds: 1000,
  completedAtMilliseconds: 3000,
  outcome: "completed",
  events: [
    {
      attemptId: "recording-1",
      sequence: 1,
      observedAtMilliseconds: 1000,
      stage: "project-playback-scheduled",
      source: "playback-engine",
      audioContextTimeSeconds: 10,
      scheduledAudioContextTimeSeconds: 10.03,
      projectPositionSeconds: 4,
      musicalPosition: { bar: 3, beat: 1 },
      playbackState: "playing",
    },
    {
      attemptId: "recording-1",
      sequence: 2,
      observedAtMilliseconds: 1004,
      stage: "microphone-capture-start-requested",
      source: "recording-session",
    },
    {
      attemptId: "recording-1",
      sequence: 3,
      observedAtMilliseconds: 1015,
      stage: "media-recorder-start-event",
      source: "microphone-adapter",
    },
    {
      attemptId: "recording-1",
      sequence: 4,
      observedAtMilliseconds: 1017,
      stage: "recording-start-marker-captured",
      source: "recording-session",
      audioContextTimeSeconds: 10.017,
      projectPositionSeconds: 4,
      musicalPosition: { bar: 3, beat: 1 },
      playbackState: "playing",
    },
    {
      attemptId: "recording-1",
      sequence: 5,
      observedAtMilliseconds: 2500,
      stage: "media-recorder-stop-called",
      source: "microphone-adapter",
    },
    {
      attemptId: "recording-1",
      sequence: 6,
      observedAtMilliseconds: 2510,
      stage: "media-recorder-stop-event",
      source: "microphone-adapter",
    },
    {
      attemptId: "recording-1",
      sequence: 7,
      observedAtMilliseconds: 2520,
      stage: "take-placement-created",
      source: "recording-session",
      projectPositionSeconds: 4,
      musicalPosition: { bar: 3, beat: 1 },
    },
  ],
};

tester.describe("recording alignment diagnostics", () => {
  tester.it("derives software timing deltas without claiming acoustic latency", () => {
    const analysis = analyzeRecordingAlignmentTrace(trace);

    tester.expect(Math.round(analysis.playbackScheduleLeadMilliseconds ?? -1)).toBe(30);
    tester.expect(Math.round(analysis.markerRelativeToScheduledPlaybackMilliseconds ?? 0)).toBe(-13);
    tester.expect(analysis.mediaRecorderStartSignalDelayMilliseconds).toBe(11);
    tester.expect(analysis.markerRelativeToMediaRecorderStartEventMilliseconds).toBe(2);
    tester.expect(analysis.mediaRecorderStopSignalDelayMilliseconds).toBe(10);
    tester.expect(analysis.placementDeltaFromStartMarkerMilliseconds).toBe(0);
  });

  tester.it("clones traces deeply enough for diagnostic consumers", () => {
    const cloned = cloneRecordingAlignmentTrace(trace);

    cloned.context.musicalTimeline!.timeSignature.numerator = 7;
    cloned.events[0]!.musicalPosition!.bar = 99;

    tester.expect(trace.context.musicalTimeline?.timeSignature.numerator).toBe(4);
    tester.expect(trace.events[0]?.musicalPosition?.bar).toBe(3);
  });
});
