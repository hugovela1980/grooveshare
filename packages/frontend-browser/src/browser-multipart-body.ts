import type { MultipartBodyFactory } from "@hugovela/frontend-core";

export function createBrowserMultipartBodyFactory(): MultipartBodyFactory<File> {
  return {
    createTrackUploadBody({ trackName, audioFile }) {
      const formData = new FormData();
      formData.append("trackName", trackName);
      formData.append("audioFile", audioFile);
      return formData;
    },
  };
}
