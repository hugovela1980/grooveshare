import type {
  PendingTrackDraft,
  ProjectDraft,
} from "../project-draft/project-draft-state.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type ConfirmProjectPageData = {
  project: ProjectDraft | null;
  pendingTracks: PendingTrackDraft[];
};

function renderProjectDetails(project: ProjectDraft | null): string {
  if (!project) {
    return /*html*/ `
      <p class="empty-state">Project confirmation details will appear here.</p>
    `;
  }

  const description = project.description.trim()
    ? escapeHtml(project.description)
    : "No description provided.";

  return /*html*/ `
    <dl class="project-summary">
      <div>
        <dt>Title</dt>
        <dd>${escapeHtml(project.title)}</dd>
      </div>

      <div>
        <dt>Description</dt>
        <dd>${description}</dd>
      </div>
    </dl>
  `;
}

function renderPendingTracks(pendingTracks: PendingTrackDraft[]): string {
  if (pendingTracks.length === 0) {
    return '<p class="empty-state">No tracks selected.</p>';
  }

  return /*html*/ `
    <ul class="track-list">
      ${pendingTracks
      .map((track) => {
        return /*html*/ `
            <li class="track-list__item">
              <strong>${escapeHtml(track.trackName)}</strong>
              <span>${escapeHtml(track.originalFilename)}</span>
            </li>
          `;
      })
      .join("")}
    </ul>
  `;
}

export function renderConfirmProjectPage({
  project,
  pendingTracks,
}: ConfirmProjectPageData = {
    project: null,
    pendingTracks: [],
  }): string {
  return /*html*/ `
    <main class="app-shell" data-page="confirm-project">
      <header class="page-header">
        <p class="eyebrow">Review Project</p>
        <h1>Confirm Project</h1>
        <p class="description">
          Review the project details and selected tracks before creating the project.
        </p>
      </header>

      <section class="panel" id="confirm-project">
        <h2>Project details</h2>
        <div id="confirm-project-details">
          ${renderProjectDetails(project)}
        </div>
      </section>

      <section class="panel">
        <h2>Tracks to upload</h2>
        <div id="confirm-pending-track-list">
          ${renderPendingTracks(pendingTracks)}
        </div>
      </section>

      <section class="panel">
        <button id="confirm-project-button" type="button">Submit</button>
        <p id="confirm-project-status" class="status-message" aria-live="polite"></p>
      </section>
    </main>
  `;
}