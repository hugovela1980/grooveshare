export const MAX_MOBILE_AUDIO_FILE_SIZE_BYTES = 100 * 1024 * 1024;

export const MOBILE_AUDIO_FILE_ACCEPT = [
  "audio/*",
  ".wav",
  ".mp3",
  ".ogg",
  ".webm",
  ".flac",
  ".aac",
  ".m4a",
].join(",");

const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  ".wav",
  ".mp3",
  ".ogg",
  ".webm",
  ".flac",
  ".aac",
  ".m4a",
]);

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
  "audio/m4a",
  "audio/x-m4a",
]);

type FileLike = {
  name: string;
  type: string;
  size: number;
};

export type MobileAudioFileValidationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");

  if (dotIndex < 0) {
    return "";
  }

  return filename.slice(dotIndex).toLowerCase();
}

function hasSupportedAudioIdentity(file: FileLike): boolean {
  const extension = getExtension(file.name);
  const mimeType = file.type.trim().toLowerCase();

  if (SUPPORTED_AUDIO_MIME_TYPES.has(mimeType)) {
    return true;
  }

  if (extension === ".m4a" && mimeType === "video/mp4") {
    return true;
  }

  if (
    SUPPORTED_AUDIO_EXTENSIONS.has(extension) &&
    (mimeType === "" || mimeType === "application/octet-stream")
  ) {
    return true;
  }

  return false;
}

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const sizeKb = sizeBytes / 1024;

  if (sizeKb < 1024) {
    return `${sizeKb.toFixed(sizeKb >= 100 ? 0 : 1)} KB`;
  }

  const sizeMb = sizeKb / 1024;

  if (Number.isInteger(sizeMb)) {
    return `${sizeMb.toFixed(0)} MB`;
  }

  return `${sizeMb.toFixed(sizeMb >= 10 ? 1 : 2)} MB`;
}

export function getDefaultTrackNameFromAudioFile(file: Pick<FileLike, "name">): string {
  const extensionStartIndex = file.name.lastIndexOf(".");

  if (extensionStartIndex <= 0) {
    return file.name;
  }

  return file.name.slice(0, extensionStartIndex);
}

export function validateMobileAudioFile(
  file: FileLike,
  maxFileSizeBytes = MAX_MOBILE_AUDIO_FILE_SIZE_BYTES,
): MobileAudioFileValidationResult {
  if (file.size > maxFileSizeBytes) {
    return {
      ok: false,
      error: `${file.name} is ${formatFileSize(file.size)}. GrooveShare currently accepts audio files up to ${formatFileSize(maxFileSizeBytes)}.`,
    };
  }

  if (!hasSupportedAudioIdentity(file)) {
    return {
      ok: false,
      error: `${file.name} is not a supported audio file. Try WAV, MP3, M4A, AAC, OGG, WebM, or FLAC.`,
    };
  }

  return { ok: true };
}
