import {
  DEFAULT_TRACK_MUSICAL_PLACEMENT,
  getTrackMusicalEndPosition,
  getTrackMusicalPlacement,
  getTrackMusicalSpanSeconds,
  getTrackMusicalStartSeconds,
  getTrackTimelineOffsetSeconds,
  musicalSpanBarsToBeats,
  musicalSpanBeatsToBars,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

const timeline = {
  bpm: 120,
  timeSignature: { numerator: 4, denominator: 4 },
};

tester.describe("track musical placement", () => {
  tester.it("places legacy tracks at bar 1 beat 1 with unknown musical span", () => {
    tester.expect(getTrackMusicalPlacement(timeline, {})).toEqual(
      DEFAULT_TRACK_MUSICAL_PLACEMENT,
    );
  });

  tester.it("maps beat-precise starts onto project transport time", () => {
    const track = {
      musicalPlacement: {
        start: { bar: 3, beat: 2.5 },
        spanBeats: 8,
      },
    };

    tester.expect(getTrackMusicalStartSeconds(timeline, track)).toBe(4.75);
    tester.expect(getTrackTimelineOffsetSeconds(track, timeline)).toBe(4.75);
  });

  tester.it("keeps musical span independent from an audio file duration", () => {
    const track = {
      musicalPlacement: {
        start: { bar: 2, beat: 1 },
        spanBeats: 8,
      },
    };

    tester.expect(getTrackMusicalSpanSeconds(timeline, track)).toBe(4);
    tester.expect(getTrackMusicalEndPosition(timeline, track)).toEqual({
      bar: 4,
      beat: 1,
    });
  });

  tester.it("converts whole and fractional bars to beat spans", () => {
    tester.expect(musicalSpanBarsToBeats(timeline, 2.5)).toBe(10);
    tester.expect(musicalSpanBeatsToBars(timeline, 10)).toBe(2.5);
  });
});
