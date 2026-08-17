import path from "node:path";
import type { MultipartFile } from "./multipart-form-data.js";

export const DEFAULT_MAX_AUDIO_FILE_SIZE_BYTES = 100 * 1024 * 1024;

const CANONICAL_AUDIO_MIME_BY_EXTENSION = new Map([
  [".wav", "audio/wav"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".webm", "audio/webm"],
  [".flac", "audio/flac"],
  [".aac", "audio/aac"],
  [".m4a", "audio/mp4"],
]);

const CANONICAL_AUDIO_MIME_BY_MIME_TYPE = new Map([
  ["audio/wav", "audio/wav"],
  ["audio/wave", "audio/wav"],
  ["audio/x-wav", "audio/wav"],
  ["audio/mpeg", "audio/mpeg"],
  ["audio/mp3", "audio/mpeg"],
  ["audio/ogg", "audio/ogg"],
  ["audio/webm", "audio/webm"],
  ["audio/flac", "audio/flac"],
  ["audio/aac", "audio/aac"],
  ["audio/mp4", "audio/mp4"],
  ["audio/m4a", "audio/mp4"],
  ["audio/x-m4a", "audio/mp4"],
]);

type AudioUploadValidationOptions = {
  maxFileSizeBytes?: number;
};

export type AudioUploadValidationResult =
  | {
      ok: true;
      mimeType: string;
    }
  | {
      ok: false;
      statusCode: number;
      error: string;
    };

function getCanonicalAudioMimeType(file: MultipartFile): string | null {
  const mimeType = file.mimeType.trim().toLowerCase();
  const extension = path.extname(file.filename).toLowerCase();
  const canonicalByMime = CANONICAL_AUDIO_MIME_BY_MIME_TYPE.get(mimeType);

  if (canonicalByMime) {
    return canonicalByMime;
  }

  if (extension === ".m4a" && mimeType === "video/mp4") {
    return "audio/mp4";
  }

  if (mimeType === "application/octet-stream" || mimeType === "") {
    return CANONICAL_AUDIO_MIME_BY_EXTENSION.get(extension) ?? null;
  }

  return null;
}

export function validateAudioUploadFile(
  file: MultipartFile,
  { maxFileSizeBytes = DEFAULT_MAX_AUDIO_FILE_SIZE_BYTES }: AudioUploadValidationOptions = {},
): AudioUploadValidationResult {
  const mimeType = getCanonicalAudioMimeType(file);

  if (!mimeType) {
    return {
      ok: false,
      statusCode: 415,
      error: "Unsupported audio file type.",
    };
  }

  if (file.size > maxFileSizeBytes) {
    return {
      ok: false,
      statusCode: 413,
      error: "Audio file is too large.",
    };
  }

  return {
    ok: true,
    mimeType,
  };
}
