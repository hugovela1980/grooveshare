import {
  canContribute,
  canManageProject,
  canManageTrack,
  canPersistMix,
} from "../src/permissions/project-permissions.js";
import type { Track } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

function createTrack(uploadedByUserId: string | null): Track {
  return {
    id: "track-1",
    projectId: "project-1",
    name: "Guitar",
    originalFilename: "guitar.wav",
    filePath: "uploads/guitar.wav",
    mimeType: "audio/wav",
    fileSize: 123,
    uploadedByUserId,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

tester.describe("project permissions", () => {
  tester.it("gives Owners project, contribution, mix, and all-track management", () => {
    tester.expect(canManageProject("owner")).toBe(true);
    tester.expect(canContribute("owner")).toBe(true);
    tester.expect(canPersistMix("owner")).toBe(true);
    tester.expect(
      canManageTrack({
        role: "owner",
        currentUserId: "owner-1",
        track: createTrack("someone-else"),
      }),
    ).toBe(true);
  });

  tester.it("lets Contributors manage only tracks they uploaded", () => {
    tester.expect(canManageProject("contributor")).toBe(false);
    tester.expect(canContribute("contributor")).toBe(true);
    tester.expect(canPersistMix("contributor")).toBe(true);

    tester.expect(
      canManageTrack({
        role: "contributor",
        currentUserId: "user-1",
        track: createTrack("user-1"),
      }),
    ).toBe(true);

    tester.expect(
      canManageTrack({
        role: "contributor",
        currentUserId: "user-1",
        track: createTrack("user-2"),
      }),
    ).toBe(false);

    tester.expect(
      canManageTrack({
        role: "contributor",
        currentUserId: "user-1",
        track: createTrack(null),
      }),
    ).toBe(false);
  });

  tester.it("keeps Viewers read/play only", () => {
    tester.expect(canManageProject("viewer")).toBe(false);
    tester.expect(canContribute("viewer")).toBe(false);
    tester.expect(canPersistMix("viewer")).toBe(false);
    tester.expect(
      canManageTrack({
        role: "viewer",
        currentUserId: "viewer-1",
        track: createTrack("viewer-1"),
      }),
    ).toBe(false);
  });
});
