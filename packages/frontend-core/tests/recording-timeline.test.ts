import {
  createRecordingTimeline,
  createTransport,
  getTrackTimelineOffsetSeconds,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

function createHarness() {
  let clockTime = 100;
  const transport = createTransport({
    getClockTime: () => clockTime,
    scheduleInterval() {
      return { fakeInterval: true };
    },
    clearScheduledInterval() {},
  });

  return {
    transport,
    recordingTimeline: createRecordingTimeline(transport),
    setClockTime(nextTime: number) {
      clockTime = nextTime;
    },
  };
}

tester.describe("recording timeline", () => {
  tester.it("maps recording start and stop to one authoritative audio clock", () => {
    const harness = createHarness();

    harness.transport.setDuration(90);
    harness.transport.seek(20);
    harness.transport.play();

    harness.setClockTime(105);
    const start = harness.recordingTimeline.markStart();

    tester.expect(start).toEqual({
      kind: "recording-start",
      projectPositionSeconds: 25,
      audioContextTimeSeconds: 105,
      playbackState: "playing",
    });

    harness.setClockTime(112.25);
    const result = harness.recordingTimeline.markStop(start);

    tester.expect(result.stop).toEqual({
      kind: "recording-stop",
      projectPositionSeconds: 32.25,
      audioContextTimeSeconds: 112.25,
      playbackState: "playing",
    });
    tester.expect(result.metadata).toEqual({
      startProjectPositionSeconds: 25,
      stopProjectPositionSeconds: 32.25,
      startAudioContextTimeSeconds: 105,
      stopAudioContextTimeSeconds: 112.25,
      durationSeconds: 7.25,
      timelineOffsetSeconds: 25,
    });

    harness.transport.destroy();
  });

  tester.it("uses clock duration even when project position wraps across a loop boundary", () => {
    const harness = createHarness();

    harness.transport.setDuration(30);
    harness.transport.seek(28);
    harness.transport.setLoopEnabled(true);
    harness.transport.play();

    harness.setClockTime(101);
    const start = harness.recordingTimeline.markStart();
    harness.setClockTime(103);
    const result = harness.recordingTimeline.markStop(start);

    tester.expect(start.projectPositionSeconds).toBe(29);
    tester.expect(result.stop.projectPositionSeconds).toBe(1);
    tester.expect(result.metadata.durationSeconds).toBe(2);
    tester.expect(result.metadata.timelineOffsetSeconds).toBe(29);

    harness.transport.destroy();
  });

  tester.it("defines zero as the default timeline offset for existing tracks", () => {
    tester.expect(getTrackTimelineOffsetSeconds({})).toBe(0);
    tester.expect(
      getTrackTimelineOffsetSeconds({ timelineOffsetSeconds: 12.5 }),
    ).toBe(12.5);
    tester.expect(
      getTrackTimelineOffsetSeconds({ timelineOffsetSeconds: -2 }),
    ).toBe(0);
  });
});
