import {
  RECORDING_ALIGNMENT_COMPENSATION_STORAGE_KEY,
  loadRecordingAlignmentCompensationMilliseconds,
  normalizeRecordingAlignmentCompensationMilliseconds,
  recordingAlignmentCompensationMillisecondsToSeconds,
  saveRecordingAlignmentCompensationMilliseconds,
  type StorageProvider,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

function createMemoryStorage(): StorageProvider & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

tester.describe("recording alignment compensation", () => {
  tester.it("normalizes to whole milliseconds and supports positive/negative values", () => {
    tester.expect(normalizeRecordingAlignmentCompensationMilliseconds(160.4)).toBe(160);
    tester.expect(normalizeRecordingAlignmentCompensationMilliseconds(-32.6)).toBe(-33);
    tester.expect(normalizeRecordingAlignmentCompensationMilliseconds(9000)).toBe(2000);
    tester.expect(normalizeRecordingAlignmentCompensationMilliseconds(-9000)).toBe(-2000);
    tester.expect(recordingAlignmentCompensationMillisecondsToSeconds(160)).toBe(0.16);
  });

  tester.it("persists one local browser/device compensation value without project coupling", () => {
    const storage = createMemoryStorage();
    saveRecordingAlignmentCompensationMilliseconds(163, storage);

    tester.expect(storage.values.get(RECORDING_ALIGNMENT_COMPENSATION_STORAGE_KEY)).toBe("163");
    tester.expect(loadRecordingAlignmentCompensationMilliseconds(storage)).toBe(163);
  });
});
