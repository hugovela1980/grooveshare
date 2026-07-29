import type { Track } from "../types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderTrackList(tracks: Track[]): string {
  if (tracks.length === 0) {
    return '<p class="empty-state">No tracks yet.</p>';
  }

  return /*html*/ `
    <ul class="track-list">
      ${tracks
      .map((track) => {
        return /*html*/ `
            <li class="track-list__item">
              <div>
                <strong>${escapeHtml(track.name)}</strong>
                <span>${escapeHtml(track.originalFilename)}</span>
              </div>

              <button
                type="button"
                data-track-delete-button
                data-track-id="${escapeHtml(track.id)}"
              >
                Delete
              </button>
            </li>
          `;
      })
      .join("")}
    </ul>
  `;
}