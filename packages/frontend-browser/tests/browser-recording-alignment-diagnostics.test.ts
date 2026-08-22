import {
  createBrowserRecordingAlignmentDiagnostics,
  type BrowserRecordingAlignmentDiagnosticLogger,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

tester.describe("browser recording alignment diagnostics", () => {
  tester.it("correlates one attempt on a shared monotonic clock and logs the completed trace", () => {
    let now = 100;
    const infoCalls: unknown[][] = [];
    const tableCalls: unknown[] = [];
    const logger: BrowserRecordingAlignmentDiagnosticLogger = {
      info(message, details) {
        infoCalls.push([message, details]);
      },
      table(data) {
        tableCalls.push(data);
      },
    };
    const diagnostics = createBrowserRecordingAlignmentDiagnostics({
      getMonotonicTimeMilliseconds: () => now,
      logger,
    });

    const attemptId = diagnostics.beginAttempt({
      projectId: "project-1",
      musicalTimeline: {
        bpm: 90,
        timeSignature: { numerator: 6, denominator: 8 },
      },
    });
    now = 108;
    diagnostics.observe({
      stage: "microphone-capture-start-requested",
      source: "recording-session",
    });
    now = 117;
    diagnostics.observe({
      stage: "media-recorder-start-event",
      source: "microphone-adapter",
    });
    now = 200;
    diagnostics.completeAttempt("completed");

    const completed = diagnostics.getCompletedTraces()[0];
    tester.expect(attemptId).toBe("recording-1");
    tester.expect(completed?.outcome).toBe("completed");
    tester.expect(completed?.events.map((event) => event.stage)).toEqual([
      "attempt-started",
      "microphone-capture-start-requested",
      "media-recorder-start-event",
      "attempt-completed",
    ]);
    tester.expect(completed?.events[1]?.observedAtMilliseconds).toBe(108);
    tester.expect(infoCalls.length).toBe(1);
    tester.expect(tableCalls.length).toBe(1);
    tester.expect(diagnostics.getActiveAttemptId()).toBe(null);
  });

  tester.it("aborts an unfinished attempt before starting the next one", () => {
    let now = 1;
    const diagnostics = createBrowserRecordingAlignmentDiagnostics({
      getMonotonicTimeMilliseconds: () => now++,
      logger: { info() {} },
    });

    diagnostics.beginAttempt();
    const secondId = diagnostics.beginAttempt();

    tester.expect(secondId).toBe("recording-2");
    tester.expect(diagnostics.getCompletedTraces()[0]?.outcome).toBe("aborted");
  });
});
