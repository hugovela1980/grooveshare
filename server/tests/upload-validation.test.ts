import { validateAudioUploadFile } from "../src/uploads/upload-validation.js";
import { tester } from "./test-runner/tester.js";

function createFile({
  filename,
  mimeType,
  size = 12,
}: {
  filename: string;
  mimeType: string;
  size?: number;
}) {
  return {
    fieldName: "audioFile",
    filename,
    mimeType,
    data: Buffer.alloc(size),
    size,
  };
}

tester.describe("audio upload validation", () => {
  tester.it("normalizes common m4a MIME aliases to audio/mp4", () => {
    for (const mimeType of ["audio/mp4", "audio/m4a", "audio/x-m4a", "video/mp4"]) {
      const result = validateAudioUploadFile(
        createFile({ filename: "phone-recording.m4a", mimeType }),
      );

      tester.expect(result.ok).toBe(true);

      if (result.ok) {
        tester.expect(result.mimeType).toBe("audio/mp4");
      }
    }
  });

  tester.it("accepts a known audio extension when a mobile picker reports a generic MIME type", () => {
    const result = validateAudioUploadFile(
      createFile({
        filename: "voice-memo.m4a",
        mimeType: "application/octet-stream",
      }),
    );

    tester.expect(result.ok).toBe(true);

    if (result.ok) {
      tester.expect(result.mimeType).toBe("audio/mp4");
    }
  });

  tester.it("does not let a generic MIME type bypass the supported audio extension list", () => {
    const result = validateAudioUploadFile(
      createFile({
        filename: "notes.txt",
        mimeType: "application/octet-stream",
      }),
    );

    tester.expect(result.ok).toBe(false);

    if (!result.ok) {
      tester.expect(result.statusCode).toBe(415);
    }
  });

  tester.it("preserves the configured upload-size limit", () => {
    const result = validateAudioUploadFile(
      createFile({
        filename: "large.m4a",
        mimeType: "audio/mp4",
        size: 11,
      }),
      { maxFileSizeBytes: 10 },
    );

    tester.expect(result.ok).toBe(false);

    if (!result.ok) {
      tester.expect(result.statusCode).toBe(413);
    }
  });
});
