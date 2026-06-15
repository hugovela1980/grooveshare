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
    return /*html*/ `
      <p class="empty-state">No tracks uploaded for this project yet.</p>
    `;
  }

  return /*html*/ `
    <div class="track-list">
      ${tracks
        .map((track) => {
          return /*html*/ `
            <article class="track-card">
              <h3>${escapeHtml(track.name)}</h3>
              <p>${escapeHtml(track.originalFilename)}</p>
              <small>${escapeHtml(track.mimeType)}</small>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}