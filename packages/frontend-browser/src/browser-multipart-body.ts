import type { MultipartBodyFactory } from "@hugovela/frontend-core";

export function createBrowserMultipartBodyFactory(): MultipartBodyFactory<File> {
  return {
    createTrackUploadBody({
      trackName,
      audioFile,
      musicalPlacement,
      alignmentOffsetSeconds,
    }) {
      const formData = new FormData();
      formData.append("trackName", trackName);
      formData.append("audioFile", audioFile);
      if (alignmentOffsetSeconds !== undefined) {
        formData.append("alignmentOffsetSeconds", String(alignmentOffsetSeconds));
      }
      if (musicalPlacement) {
        formData.append("musicalStartBar", String(musicalPlacement.start.bar));
        formData.append("musicalStartBeat", String(musicalPlacement.start.beat));
        if (musicalPlacement.spanBeats !== null) {
          formData.append("musicalSpanBeats", String(musicalPlacement.spanBeats));
        }
      }
      return formData;
    },
  };
}
