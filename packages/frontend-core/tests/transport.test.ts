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
    transport.play({ leadTimeSeconds: 10 });

    harness.setClockTime(20);
    tester.expect(transport.getPosition()).toBe(12);

    harness.setClockTime(27.5);
    tester.expect(transport.getPosition()).toBe(19.5);
    tester.expect(transport.getSnapshot().playbackState).toBe("playing");

    transport.destroy();
  });


  tester.it("creates one shared playback scheduling instruction from the transport clock", () => {
    const harness = createTransportHarness();
    const { transport } = harness;

    transport.setDuration(75);
    transport.seek(18);
    transport.setLoopEnabled(true);
    harness.setClockTime(42);

    const instruction = transport.play({ leadTimeSeconds: 0.03 });

    tester.expect(instruction).toEqual({
      startAtClockTime: 42.03,
      endAtClockTime: 99.03,
      projectPositionSeconds: 18,
      durationSeconds: 75,
      loopEnabled: true,
    });

    harness.setClockTime(42.03);
    tester.expect(transport.getPosition()).toBe(18);
    harness.setClockTime(47.03);
    tester.expect(transport.getPosition()).toBe(23);

    transport.destroy();
  });

  tester.it("restarts an ended timeline from project zero when creating a new schedule", () => {
    const harness = createTransportHarness();
    const { transport } = harness;

    transport.setDuration(30);
    transport.seek(30);
    harness.setClockTime(50);

    const instruction = transport.play({ leadTimeSeconds: 0.02 });

    tester.expect(instruction?.startAtClockTime).toBe(50.02);
    tester.expect(
      Math.abs((instruction?.endAtClockTime ?? 0) - 80.02) < 0.000001,
    ).toBe(true);
    tester.expect(instruction?.projectPositionSeconds).toBe(0);
    tester.expect(instruction?.durationSeconds).toBe(30);
    tester.expect(instruction?.loopEnabled).toBe(false);
    tester.expect(transport.getSnapshot().playbackState).toBe("playing");

    transport.destroy();
  });

  tester.it("preserves position on pause and resets project time to zero on stop", () => {
    const harness = createTransportHarness();
    const { transport } = harness;

    transport.setDuration(90);
    transport.play();
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


  tester.it("supports seek semantics while stopped paused and playing", () => {
    const harness = createTransportHarness();
    const { transport } = harness;

    transport.setDuration(60);
    transport.seek(15);
    tester.expect(transport.getPosition()).toBe(15);
    tester.expect(transport.getSnapshot().playbackState).toBe("stopped");

    harness.setClockTime(20);
    const firstPlay = transport.play({ leadTimeSeconds: 0.03 });
    tester.expect(firstPlay?.projectPositionSeconds).toBe(15);

    harness.setClockTime(25.03);
    transport.pause();
    tester.expect(transport.getPosition()).toBe(20);
    tester.expect(transport.getSnapshot().playbackState).toBe("paused");

    transport.seek(35);
    tester.expect(transport.getPosition()).toBe(35);
    tester.expect(transport.getSnapshot().playbackState).toBe("paused");

    harness.setClockTime(30);
    transport.play({ leadTimeSeconds: 0.03 });
    harness.setClockTime(32.03);
    transport.seek(45);
    tester.expect(transport.getPosition()).toBe(45);
    tester.expect(transport.getSnapshot().playbackState).toBe("playing");

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
    harness.transport.play();

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

  tester.it("marks natural completion from the authoritative clock without an end callback", () => {
    const harness = createTransportHarness();
    const { transport } = harness;

    transport.setDuration(60);
    transport.play();
    harness.setClockTime(70);

    tester.expect(transport.getSnapshot()).toEqual({
      positionSeconds: 60,
      durationSeconds: 60,
      playbackState: "ended",
      loopEnabled: false,
    });

    transport.play({ leadTimeSeconds: 5 });
    tester.expect(transport.getSnapshot().positionSeconds).toBe(0);
    tester.expect(transport.getSnapshot().playbackState).toBe("playing");

    transport.destroy();
  });

  tester.it("wraps loop position from the audio clock and creates exact loop-boundary schedules", () => {
    const harness = createTransportHarness();
    const { transport } = harness;

    transport.setDuration(30);
    transport.seek(12);
    transport.setLoopEnabled(true);
    harness.setClockTime(20);

    const firstInstruction = transport.play({ leadTimeSeconds: 0.03 });

    tester.expect(firstInstruction !== null).toBe(true);
    tester.expect(firstInstruction?.startAtClockTime).toBe(20.03);
    tester.expect(firstInstruction?.projectPositionSeconds).toBe(12);
    tester.expect(
      Math.abs((firstInstruction?.endAtClockTime ?? 0) - 38.03) < 0.000001,
    ).toBe(true);

    const nextInstruction = firstInstruction
      ? transport.createNextLoopInstruction(firstInstruction)
      : null;

    tester.expect(nextInstruction?.startAtClockTime).toBe(
      firstInstruction?.endAtClockTime,
    );
    tester.expect(nextInstruction?.projectPositionSeconds).toBe(0);
    tester.expect(
      Math.abs((nextInstruction?.endAtClockTime ?? 0) - 68.03) < 0.000001,
    ).toBe(true);

    harness.setClockTime(38.03);
    tester.expect(
      Math.abs(transport.getPosition() - 0) < 0.000001,
    ).toBe(true);

    harness.setClockTime(43.03);
    tester.expect(
      Math.abs(transport.getPosition() - 5) < 0.000001,
    ).toBe(true);
    tester.expect(transport.getSnapshot().playbackState).toBe("playing");

    transport.destroy();
  });

  tester.it("rebases the running timeline when loop mode changes", () => {
    const harness = createTransportHarness();
    const { transport } = harness;

    transport.setDuration(30);
    transport.setLoopEnabled(true);
    transport.play();

    harness.setClockTime(45);
    tester.expect(transport.getPosition()).toBe(5);

    transport.setLoopEnabled(false);
    tester.expect(transport.getPosition()).toBe(5);

    harness.setClockTime(50);
    tester.expect(transport.getPosition()).toBe(10);
    tester.expect(transport.getSnapshot().playbackState).toBe("playing");

    transport.destroy();
  });

  tester.it("keeps repeated play seek pause resume stop transitions on one timeline", () => {
    const harness = createTransportHarness();
    const { transport } = harness;

    transport.setDuration(90);
    harness.setClockTime(10);
    transport.play({ leadTimeSeconds: 0.03 });

    harness.setClockTime(20.03);
    transport.seek(40);
    tester.expect(transport.getPosition()).toBe(40);

    harness.setClockTime(24.03);
    transport.pause();
    tester.expect(transport.getPosition()).toBe(44);

    harness.setClockTime(30);
    const resumed = transport.play({ leadTimeSeconds: 0.03 });
    tester.expect(resumed?.projectPositionSeconds).toBe(44);

    harness.setClockTime(35.03);
    transport.seekBy(6);
    tester.expect(transport.getPosition()).toBe(55);

    transport.stop();
    tester.expect(transport.getPosition()).toBe(0);
    tester.expect(transport.getSnapshot().playbackState).toBe("stopped");

    harness.setClockTime(40);
    const restarted = transport.play({ leadTimeSeconds: 0.03 });
    tester.expect(restarted?.projectPositionSeconds).toBe(0);

    transport.destroy();
  });
  tester.it("captures one exact timeline marker from the authoritative clock", () => {
    const harness = createTransportHarness();
    const { transport } = harness;

    transport.setDuration(60);
    transport.seek(12);
    harness.setClockTime(20);
    transport.play({ leadTimeSeconds: 0.03 });

    harness.setClockTime(27.53);
    tester.expect(transport.markTimelinePosition()).toEqual({
      clockTimeSeconds: 27.53,
      projectPositionSeconds: 19.5,
      playbackState: "playing",
    });

    transport.pause();
    harness.setClockTime(40);
    tester.expect(transport.markTimelinePosition()).toEqual({
      clockTimeSeconds: 40,
      projectPositionSeconds: 19.5,
      playbackState: "paused",
    });

    transport.destroy();
  });

});
