import type {
  RecordedAudioCapture,
  RecordedTakeUploadPort,
  TracksService,
} from "@hugovela/frontend-core";

const FILE_EXTENSION_BY_MIME_TYPE = new Map([
  ["audio/webm", ".webm"],
  ["audio/ogg", ".ogg"],
  ["audio/mp4", ".m4a"],
  ["audio/aac", ".aac"],
  ["audio/wav", ".wav"],
  ["audio/mpeg", ".mp3"],
  ["audio/flac", ".flac"],
]);

type FileConstructorLike = new (
  fileBits: BlobPart[],
  fileName: string,
  options?: FilePropertyBag,
) => File;

export type BrowserRecordedTakeUploadAdapterOptions = {
  tracksService: Pick<TracksService<File>, "uploadTrack">;
  FileConstructor?: FileConstructorLike | null;
};

function getDefaultFileConstructor(): FileConstructorLike | null {
  return typeof File === "undefined"
    ? null
    : File as unknown as FileConstructorLike;
}

function getCanonicalMimeType(capture: RecordedAudioCapture): string {
  return capture.mimeType.split(";", 1)[0]?.trim().toLowerCase() || "";
}

function getRecordingFilename(trackName: string, mimeType: string): string {
  const extension = FILE_EXTENSION_BY_MIME_TYPE.get(mimeType);

  if (!extension) {
    throw new Error("This recorded audio format cannot be uploaded as a project track.");
  }

  const baseName = trackName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ") || "Recorded Take";

  return `${baseName}${extension}`;
}

/**
 * Browser adapter that feeds reviewed microphone bytes into the existing
 * TracksService upload path. File construction and MIME normalization stay in
 * frontend-browser so frontend-core remains free of Blob/File dependencies.
 */
export function createBrowserRecordedTakeUploadAdapter({
  tracksService,
  FileConstructor = getDefaultFileConstructor(),
}: BrowserRecordedTakeUploadAdapterOptions): RecordedTakeUploadPort {
  return {
    async upload({
      projectId,
      trackName,
      capture,
      musicalPlacement,
      alignmentOffsetSeconds,
      mediaLeadInSeconds,
    }) {
      if (!FileConstructor) {
        throw new Error("Browser file uploads are unavailable in this environment.");
      }

      const mimeType = getCanonicalMimeType(capture);
      const filename = getRecordingFilename(trackName, mimeType);
      const bytes = new ArrayBuffer(capture.bytes.byteLength);
      new Uint8Array(bytes).set(capture.bytes);
      const audioFile = new FileConstructor([bytes], filename, { type: mimeType });

      return tracksService.uploadTrack({
        projectId,
        trackName,
        audioFile,
        musicalPlacement: {
          start: { ...musicalPlacement.start },
          spanBeats: musicalPlacement.spanBeats,
        },
        alignmentOffsetSeconds,
        mediaLeadInSeconds,
      });
    },
  };
}
