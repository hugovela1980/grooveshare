import type { PendingTrackDraft as CorePendingTrackDraft } from "@hugovela/frontend-core";

type PendingTrackDraft = CorePendingTrackDraft<File>;
import { formatFileSize } from "../uploads/mobile-audio-files.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderPendingTrackList(
  pendingTracks: PendingTrackDraft[],
): string {
  if (pendingTracks.length === 0) {
    return '<p class="empty-state">No tracks selected yet.</p>';
  }

  return /*html*/ `
    <div class="selected-audio-track-rows">
      ${pendingTracks
      .map((track) => {
        return /*html*/ `
            <div class="selected-audio-track-row" data-pending-track-row>
              <label>
                <span>Track name</span>
                <input
                  type="text"
                  value="${escapeHtml(track.trackName)}"
                  data-pending-track-name="${escapeHtml(track.id)}"
                  aria-label="Track name for ${escapeHtml(track.originalFilename)}"
                />
              </label>

              <div class="selected-audio-track-row__file">
                <span>File</span>
                <p>${escapeHtml(track.originalFilename)}</p>
                <small>${formatFileSize(track.audioFile.size)}</small>
              </div>

              <button
                class="button button--danger selected-audio-track-row__remove"
                type="button"
                data-pending-track-id="${escapeHtml(track.id)}"
              >
                Remove
              </button>
            </div>
          `;
      })
      .join("")}
    </div>
  `;
}
