import { renderAudioPlayer } from "../templates/audio-player.js";
import type { Project } from "../types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderProjectHeading(project: Project | null): string {
  if (!project) {
    return "Project Player";
  }

  return escapeHtml(project.title);
}

function renderProjectDescription(project: Project | null): string {
  if (!project) {
    return "Select a project from the Project Menu.";
  }

  return escapeHtml(project.description);
}

export function renderProjectPlayerPage(project: Project | null = null): string {
  const heading = renderProjectHeading(project);
  const description = renderProjectDescription(project);
  const editableAttribute = project ? 'contenteditable="true"' : "";

  return /*html*/ `
    <main class="app-shell project-player-page" data-page="project-player">
      <header class="page-header project-player-header">
        <div class="project-player-header__actions">
          <button
            id="player-back-button"
            class="button button--secondary"
            type="button"
          >
            Back
          </button>

          <button
            id="delete-project-button"
            class="button button--danger"
            type="button"
          >
            Delete Project
          </button>
        </div>

        <div class="project-player-header__details">
          <p class="eyebrow">Project Player</p>

          <div class="project-player-editable project-player-editable--title${project ? " project-player-editable--enabled" : ""}">
            <h1
              class="project-player-editable__text project-player-editable__title"
              ${editableAttribute}
              role="textbox"
              aria-label="Edit project title"
              spellcheck="false"
              data-project-title-editor
            >${heading}</h1>
            ${project ? '<span class="project-player-editable__icon" aria-hidden="true" title="Edit project title">✎</span>' : ""}
          </div>

          <div class="project-player-editable project-player-editable--description${project ? " project-player-editable--enabled" : ""}">
            <p
              class="description project-player-editable__text project-player-editable__description"
              ${editableAttribute}
              role="textbox"
              aria-label="Edit project description"
              data-placeholder="No description provided."
              data-project-description-editor
            >${description}</p>
            ${project ? '<span class="project-player-editable__icon" aria-hidden="true" title="Edit project description">✎</span>' : ""}
          </div>
        </div>
      </header>

      ${renderAudioPlayer()}

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
