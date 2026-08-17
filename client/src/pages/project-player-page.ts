import { renderAudioPlayer } from "../templates/audio-player.js";
import { renderMobileNavigation } from "../templates/mobile-navigation.js";
import { renderProjectActionsMenu } from "../templates/project-actions-menu.js";
import { renderProjectMembersPanel } from "../templates/project-members.js";
import { renderLoadingState } from "../templates/loading-state.js";
import type { Project, ProjectRole } from "../types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderProjectHeading(project: Project | null): string {
  return project ? escapeHtml(project.title) : "Project Player";
}

function renderProjectDescription(project: Project | null): string {
  return project
    ? escapeHtml(project.description)
    : "Select a project from the Project Menu.";
}

function getProjectRole(project: Project | null): ProjectRole {
  // Existing tests and legacy project objects may omit role. Real Version 2
  // project responses include it; owner preserves the previous editable UI
  // for those legacy objects while server authorization remains authoritative.
  return project?.role ?? "owner";
}

function getRoleLabel(role: ProjectRole): string {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "contributor") {
    return "Contributor";
  }

  return "Viewer";
}

export function renderProjectPlayerPage(project: Project | null = null): string {
  const heading = renderProjectHeading(project);
  const description = renderProjectDescription(project);
  const role = getProjectRole(project);
  const canManageProject = Boolean(project) && role === "owner";
  const editableAttribute = canManageProject
    ? 'contenteditable="true"'
    : "";
  const editableClass = canManageProject
    ? " project-player-editable--enabled"
    : "";
  const loadingHiddenAttribute = project ? "" : "hidden";
  const contentHiddenAttribute = project ? "hidden" : "";

  return /*html*/ `
    <main class="app-shell project-player-page" data-page="project-player">
      <header class="page-header project-player-header">
        <div class="project-player-header__actions">
          <button
            id="player-back-button"
            class="button button--secondary project-player-header__back"
            type="button"
            aria-label="Go back"
          >
            <span class="project-player-header__back-desktop">Back</span>
            <span class="project-player-header__back-mobile" aria-hidden="true">‹</span>
          </button>

          <p class="project-player-header__mobile-title">${heading}</p>

          <button
            id="player-logout-button"
            class="button button--secondary project-player-header__desktop-logout"
            type="button"
          >
            Log Out
          </button>

          ${canManageProject ? renderProjectActionsMenu() : '<span class="project-player-header__actions-spacer" aria-hidden="true"></span>'}
        </div>

        <div class="project-player-header__details">
          <div class="project-player-header__eyebrow-row">
            <p class="eyebrow">Project Player</p>
            ${project
              ? `<span class="project-role-badge">${getRoleLabel(role)}</span>`
              : ""}
          </div>

          <div class="project-player-editable project-player-editable--title${editableClass}">
            <h1
              class="project-player-editable__text project-player-editable__title"
              ${editableAttribute}
              ${canManageProject ? 'role="textbox" aria-label="Edit project title"' : ""}
              spellcheck="false"
              data-project-title-editor
            >${heading}</h1>
          </div>

          <div class="project-player-editable project-player-editable--description${editableClass}">
            <p
              class="description project-player-editable__text project-player-editable__description"
              ${editableAttribute}
              ${canManageProject ? 'role="textbox" aria-label="Edit project description"' : ""}
              data-placeholder="No description provided."
              data-project-description-editor
            >${description}</p>
          </div>
        </div>
      </header>

      <div
        id="project-player-loading"
        class="project-player-loading"
        ${loadingHiddenAttribute}
      >
        ${renderLoadingState("Loading your project...", {
          className: "project-player-loading__state",
        })}
      </div>

      <div
        id="project-player-content"
        class="project-player-content"
        ${contentHiddenAttribute}
      >
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

        ${canManageProject ? renderProjectMembersPanel({ hidden: true }) : ""}
      </div>

      ${renderMobileNavigation()}
    </main>
  `;
}
