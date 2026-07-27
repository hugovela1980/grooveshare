import type { PendingTrackDraft } from "../project-draft/project-draft-state.js";

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
    <ul class="track-list">
      ${pendingTracks
            .map((track) => {
                return /*html*/ `
            <li class="track-list__item">
              <div>
                <strong>${escapeHtml(track.trackName)}</strong>
                <p>${escapeHtml(track.originalFilename)}</p>
              </div>

              <button
                type="button"
                data-pending-track-id="${escapeHtml(track.id)}"
              >
                Remove
              </button>
            </li>
          `;
            })
            .join("")}
    </ul>
  `;
}