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
    <main class="app-shell" data-page="project-player">
      <header class="page-header">
        <button id="player-back-button" type="button">Back</button>

        <div>
          <p class="eyebrow">Project Player</p>
          <h1>${heading}</h1>
          <p class="description">
            ${renderProjectDescription(project)}
          </p>
        </div>

        <button id="player-menu-button" type="button">Menu</button>
      </header>

      <section class="panel">
        <h2>Tracks</h2>
        <div id="player-track-list"></div>
      </section>

      <section class="panel" id="player-area">
        <h2>Audio Player</h2>
        <p class="empty-state">
          Single-track playback will be added here.
        </p>
      </section>
    </main>
  `;
}