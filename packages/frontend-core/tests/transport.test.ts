import { createTransport } from "../src/index.js";
import { tester } from "./test-runner/tester.js";

function createTransportHarness() {
  let clockTime = 10;
  let intervalHandler: (() => void) | null = null;
  let scheduledMilliseconds: number | null = null;
  let clearCallCount = 0;

  const transport = createTransport({
    getClockTime: () => clockTime,
    scheduleInterval(handler, milliseconds) {
      intervalHandler = handler;
      scheduledMilliseconds = milliseconds;
      return { fakeInterval: true };
    },
    clearScheduledInterval() {
      clearCallCount += 1;
      intervalHandler = null;
    },
    snapshotIntervalMs: 100,
  });

  return {
    transport,
    setClockTime(nextTime: number) {
      clockTime = nextTime;
    },
    tick() {
      intervalHandler?.();
    },
    getScheduledMilliseconds() {
      return scheduledMilliseconds;
    },
    getClearCallCount() {
      return clearCallCount;
    },
  };
}

tester.describe("Transport", () => {
  tester.it("uses the supplied audio clock as the authoritative running timeline", () => {
    const harness = createTransportHarness();
    const { transport } = harness;

    transport.setDuration(60);
    transport.seek(12);
    transport.play(20);

    harness.setClockTime(20);
    tester.expect(transport.getPosition()).toBe(12);

    harness.setClockTime(27.5);
    tester.expect(transport.getPosition()).toBe(19.5);
    tester.expect(transport.getSnapshot().playbackState).toBe("playing");

    transport.destroy();
  });

  tester.it("preserves position on pause and resets project time to zero on stop", () => {
    const harness = createTransportHarness();
    const { transport } = harness;

    transport.setDuration(90);
    transport.play(10);
    harness.setClockTime(24.25);
    transport.pause();

    tester.expect(transport.getSnapshot()).toEqual({
      positionSeconds: 14.25,
      durationSeconds: 90,
      playbackState: "paused",
      loopEnabled: false,
    });

    harness.setClockTime(40);
    tester.expect(transport.getPosition()).toBe(14.25);

    transport.stop();
    tester.expect(transport.getSnapshot()).toEqual({
      positionSeconds: 0,
      durationSeconds: 90,
      playbackState: "stopped",
      loopEnabled: false,
    });

    transport.destroy();
  });

  tester.it("clamps seek and relative seek to the shared project timeline", () => {
    const { transport } = createTransportHarness();

    transport.setDuration(60);
    transport.seek(25);
    tester.expect(transport.getPosition()).toBe(25);

    transport.seekBy(-30);
    tester.expect(transport.getPosition()).toBe(0);

    transport.seekBy(100);
    tester.expect(transport.getPosition()).toBe(60);
    tester.expect(transport.getSnapshot().playbackState).toBe("ended");

    transport.seek(15);
    tester.expect(transport.getPosition()).toBe(15);
    tester.expect(transport.getSnapshot().playbackState).toBe("paused");

    transport.destroy();
  });

  tester.it("treats project duration as an explicit shared timeline boundary", () => {
    const harness = createTransportHarness();
    const { transport } = harness;

    transport.setDuration(120);
    transport.seek(80);
    transport.setDuration(45);

    tester.expect(transport.getSnapshot()).toEqual({
      positionSeconds: 45,
      durationSeconds: 45,
      playbackState: "ended",
      loopEnabled: false,
    });

    transport.setDuration(0);
    tester.expect(transport.getSnapshot()).toEqual({
      positionSeconds: 0,
      durationSeconds: 0,
      playbackState: "stopped",
      loopEnabled: false,
    });

    transport.destroy();
  });

  tester.it("publishes observational snapshots without using the UI ticker to advance time", () => {
    const harness = createTransportHarness();
    const snapshots: number[] = [];
    const unsubscribe = harness.transport.subscribe((snapshot) => {
      snapshots.push(snapshot.positionSeconds);
    });

    harness.transport.setDuration(60);
    harness.transport.play(10);

    tester.expect(harness.getScheduledMilliseconds()).toBe(100);

    harness.setClockTime(15);
    harness.tick();
    tester.expect(snapshots[snapshots.length - 1]).toBe(5);

    harness.setClockTime(18);
    tester.expect(harness.transport.getPosition()).toBe(8);
    tester.expect(snapshots[snapshots.length - 1]).toBe(5);

    harness.tick();
    tester.expect(snapshots[snapshots.length - 1]).toBe(8);

    unsubscribe();
    tester.expect(harness.getClearCallCount()).toBe(1);
    harness.transport.destroy();
  });

  tester.it("keeps loop state on the shared transport without changing timeline position", () => {
    const { transport } = createTransportHarness();

    transport.setDuration(30);
    transport.seek(12);
    transport.setLoopEnabled(true);

    tester.expect(transport.getSnapshot()).toEqual({
      positionSeconds: 12,
      durationSeconds: 30,
      playbackState: "stopped",
      loopEnabled: true,
    });

    transport.destroy();
  });

  tester.it("marks natural completion at the project duration without applying stop semantics", () => {
    const harness = createTransportHarness();
    const { transport } = harness;

    transport.setDuration(60);
    transport.play(10);
    harness.setClockTime(70);
    transport.complete();

    tester.expect(transport.getSnapshot()).toEqual({
      positionSeconds: 60,
      durationSeconds: 60,
      playbackState: "ended",
      loopEnabled: false,
    });

    transport.play(75);
    tester.expect(transport.getSnapshot().positionSeconds).toBe(0);
    tester.expect(transport.getSnapshot().playbackState).toBe("playing");

    transport.destroy();
  });
});
