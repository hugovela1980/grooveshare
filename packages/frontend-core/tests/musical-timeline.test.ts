import {
  DEFAULT_PROJECT_MUSICAL_TIMELINE,
  PROJECT_MUSICAL_ORIGIN,
  PROJECT_MUSICAL_ORIGIN_TRANSPORT_SECONDS,
  getProjectMusicalTimeline,
  getSecondsPerBar,
  getSecondsPerMusicalBeat,
  musicalPositionToTransportSeconds,
  transportSecondsToMusicalPosition,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

tester.describe("musical timeline", () => {
  tester.it("defaults legacy projects to 120 BPM in 4/4", () => {
    tester.expect(getProjectMusicalTimeline({})).toEqual(
      DEFAULT_PROJECT_MUSICAL_TIMELINE,
    );
  });

  tester.it("defines bar 1 beat 1 as project time zero", () => {
    tester.expect(PROJECT_MUSICAL_ORIGIN).toEqual({ bar: 1, beat: 1 });
    tester.expect(PROJECT_MUSICAL_ORIGIN_TRANSPORT_SECONDS).toBe(0);
    tester.expect(
      musicalPositionToTransportSeconds(
        DEFAULT_PROJECT_MUSICAL_TIMELINE,
        PROJECT_MUSICAL_ORIGIN,
      ),
    ).toBe(PROJECT_MUSICAL_ORIGIN_TRANSPORT_SECONDS);
  });

  tester.it("maps 4/4 bars using quarter-note BPM", () => {
    const timeline = {
      bpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
    };

    tester.expect(getSecondsPerMusicalBeat(timeline)).toBe(0.5);
    tester.expect(getSecondsPerBar(timeline)).toBe(2);
    tester.expect(
      musicalPositionToTransportSeconds(timeline, { bar: 3, beat: 1 }),
    ).toBe(4);
  });

  tester.it("accounts for the time-signature denominator", () => {
    const timeline = {
      bpm: 120,
      timeSignature: { numerator: 6, denominator: 8 },
    };

    tester.expect(getSecondsPerMusicalBeat(timeline)).toBe(0.25);
    tester.expect(getSecondsPerBar(timeline)).toBe(1.5);
    tester.expect(
      musicalPositionToTransportSeconds(timeline, { bar: 2, beat: 1 }),
    ).toBe(1.5);
  });

  tester.it("converts transport time back to bar and fractional beat", () => {
    const position = transportSecondsToMusicalPosition(
      {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      },
      2.75,
    );

    tester.expect(position).toEqual({
      bar: 2,
      beat: 2.5,
    });
  });

  tester.it("rejects positions outside a bar", () => {
    let errorMessage = "";

    try {
      musicalPositionToTransportSeconds(
        DEFAULT_PROJECT_MUSICAL_TIMELINE,
        { bar: 1, beat: 5 },
      );
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "";
    }

    tester.expect(errorMessage).toBe(
      "Musical position is outside the project timeline.",
    );
  });
});
