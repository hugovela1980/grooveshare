import type { Project } from "../types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderProjectDescription(project: Project | null): string {
  if (!project) {
    return "Select a project from the Project Menu.";
  }

  if (!project.description.trim()) {
    return "No description provided.";
  }

  return escapeHtml(project.description);
}

export function renderProjectPlayerPage(project: Project | null = null): string {
  const heading = project ? escapeHtml(project.title) : "Project Player";

  return /*html*/ `
    <main class="app-shell project-player-page" data-page="project-player">
      <header class="page-header project-player-header">
        <button id="player-back-button" type="button">Back</button>
        <button
          id="delete-project-button"
          class="button button--danger"
          type="button"
        >
          Delete Project
      </button>

        <div>
          <p class="eyebrow">Project Player</p>
          <h1>${heading}</h1>
          <p class="description">
            ${renderProjectDescription(project)}
          </p>
        </div>
      </header>

      <section
        class="panel player-placeholder"
        id="player-area"
        aria-labelledby="audio-player-heading"
      >
        <h2 id="audio-player-heading">Audio Player Placeholder</h2>
      </section>

      <section class="panel project-player-tracks-panel">
        <h2>Tracks</h2>
        <div id="player-track-list"></div>
        <p
          id="project-player-status"
          class="status-message"
          aria-live="polite"
      ></p>
      </section>
    </main>
  `;
}