import type { MultipartFile } from "./multipart-form-data.js";

export const DEFAULT_MAX_AUDIO_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
  "audio/aac",
  "audio/mp4",
]);

type AudioUploadValidationOptions = {
  maxFileSizeBytes?: number;
};

export type AudioUploadValidationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      statusCode: number;
      error: string;
    };

export function validateAudioUploadFile(
  file: MultipartFile,
  { maxFileSizeBytes = DEFAULT_MAX_AUDIO_FILE_SIZE_BYTES }: AudioUploadValidationOptions = {},
): AudioUploadValidationResult {
  if (!SUPPORTED_AUDIO_MIME_TYPES.has(file.mimeType)) {
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
  };
}