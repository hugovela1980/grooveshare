import {
  getAlignedSourceOffsetSeconds,
  getTrackSourceAlignmentWindow,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

tester.describe("track source alignment", () => {
  tester.it("advances late captured content by skipping source audio at the musical start", () => {
    const window = getTrackSourceAlignmentWindow({
      trackStartSeconds: 4,
      sourceDurationSeconds: 10,
      alignmentOffsetSeconds: 0.16,
    });

    tester.expect(window).toEqual({
      projectStartSeconds: 4,
      projectEndSeconds: 13.84,
      sourceOffsetAtProjectStartSeconds: 0.16,
    });
    tester.expect(getAlignedSourceOffsetSeconds({
      projectTimeSeconds: 6,
      trackStartSeconds: 4,
      alignmentOffsetSeconds: 0.16,
    })).toBe(2.16);
  });

  tester.it("always skips structural captured-media lead-in before applying signed alignment", () => {
    const window = getTrackSourceAlignmentWindow({
      trackStartSeconds: 4,
      sourceDurationSeconds: 12.43,
      mediaLeadInSeconds: 2.43,
      alignmentOffsetSeconds: 0.16,
    });

    tester.expect(window.projectStartSeconds).toBe(4);
    tester.expect(Math.abs(window.projectEndSeconds - 13.84) < 1e-9).toBe(true);
    tester.expect(
      Math.abs(window.sourceOffsetAtProjectStartSeconds - 2.59) < 1e-9,
    ).toBe(true);
    tester.expect(Math.abs(getAlignedSourceOffsetSeconds({
      projectTimeSeconds: 6,
      trackStartSeconds: 4,
      mediaLeadInSeconds: 2.43,
      alignmentOffsetSeconds: 0.16,
    }) - 4.59) < 1e-9).toBe(true);
  });

  tester.it("delays early captured content without changing the declared musical start", () => {
    const window = getTrackSourceAlignmentWindow({
      trackStartSeconds: 4,
      sourceDurationSeconds: 10,
      alignmentOffsetSeconds: -0.032,
    });

    tester.expect(window).toEqual({
      projectStartSeconds: 4.032,
      projectEndSeconds: 14.032,
      sourceOffsetAtProjectStartSeconds: 0,
    });
  });
});
