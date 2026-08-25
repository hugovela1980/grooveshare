import type { Track, UploadTrackInput } from "@hugovela/frontend-core";
import { createBrowserRecordedTakeUploadAdapter } from "../src/index.js";
import { tester } from "./test-runner/tester.js";

class FakeFile {
  readonly name: string;
  readonly type: string;
  readonly bits: BlobPart[];

  constructor(bits: BlobPart[], name: string, options?: FilePropertyBag) {
    this.bits = bits;
    this.name = name;
    this.type = options?.type ?? "";
  }
}

function createTrack(input: UploadTrackInput<File>): Track {
  return {
    id: "track-recording-1",
    projectId: input.projectId,
    name: input.trackName,
    originalFilename: input.audioFile.name,
    filePath: `/uploads/${input.audioFile.name}`,
    mimeType: input.audioFile.type,
    fileSize: 3,
    musicalPlacement: input.musicalPlacement,
    alignmentOffsetSeconds: input.alignmentOffsetSeconds,
    mediaLeadInSeconds: input.mediaLeadInSeconds,
    createdAt: "2026-08-21T00:00:00.000Z",
  };
}

tester.describe("browser recorded-take upload adapter", () => {
  tester.it("converts browser-neutral capture bytes into a File and uses the normal track upload service", async () => {
    const uploadInputs: UploadTrackInput<File>[] = [];
    const adapter = createBrowserRecordedTakeUploadAdapter({
      tracksService: {
        async uploadTrack(input) {
          uploadInputs.push(input);
          return createTrack(input);
        },
      },
      FileConstructor: FakeFile as unknown as typeof File,
    });

    const savedTrack = await adapter.upload({
      projectId: "project-1",
      trackName: "Lead / Harmony",
      capture: {
        bytes: new Uint8Array([4, 5, 6]),
        mimeType: "audio/webm;codecs=opus",
      },
      musicalPlacement: {
        start: { bar: 3, beat: 2.5 },
        spanBeats: 6.25,
      },
      alignmentOffsetSeconds: 0.032,
      mediaLeadInSeconds: 2.43,
    });

    const uploadInput = uploadInputs[0];
    const audioFile = uploadInput?.audioFile as unknown as FakeFile | undefined;
    tester.expect(uploadInput?.projectId).toBe("project-1");
    tester.expect(uploadInput?.trackName).toBe("Lead / Harmony");
    tester.expect(uploadInput?.musicalPlacement).toEqual({
      start: { bar: 3, beat: 2.5 },
      spanBeats: 6.25,
    });
    tester.expect(uploadInput?.alignmentOffsetSeconds).toBe(0.032);
    tester.expect(uploadInput?.mediaLeadInSeconds).toBe(2.43);
    tester.expect(audioFile?.name).toBe("Lead - Harmony.webm");
    tester.expect(audioFile?.type).toBe("audio/webm");
    tester.expect(audioFile?.bits.length).toBe(1);
    tester.expect(Array.from(new Uint8Array(audioFile?.bits[0] as ArrayBuffer))).toEqual([4, 5, 6]);
    tester.expect(savedTrack.musicalPlacement).toEqual({
      start: { bar: 3, beat: 2.5 },
      spanBeats: 6.25,
    });
    tester.expect(savedTrack.mediaLeadInSeconds).toBe(2.43);
  });

  tester.it("rejects a capture format the normal server upload path cannot accept", async () => {
    let uploadCalls = 0;
    const adapter = createBrowserRecordedTakeUploadAdapter({
      tracksService: {
        async uploadTrack(input) {
          uploadCalls += 1;
          return createTrack(input);
        },
      },
      FileConstructor: FakeFile as unknown as typeof File,
    });

    let message = "";
    try {
      await adapter.upload({
        projectId: "project-1",
        trackName: "Unknown Take",
        capture: {
          bytes: new Uint8Array([1]),
          mimeType: "application/octet-stream",
        },
        musicalPlacement: {
          start: { bar: 1, beat: 1 },
          spanBeats: 1,
        },
        alignmentOffsetSeconds: 0,
        mediaLeadInSeconds: 2.03,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    tester.expect(message).toBe(
      "This recorded audio format cannot be uploaded as a project track.",
    );
    tester.expect(uploadCalls).toBe(0);
  });
});
