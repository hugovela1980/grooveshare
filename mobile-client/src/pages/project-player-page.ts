import { renderAudioPlayer } from "../templates/audio-player.js";
import { renderMobileNavigation } from "../templates/mobile-navigation.js";
import { renderProjectActionsMenu } from "../templates/project-actions-menu.js";
import { renderProjectMembersPanel } from "../templates/project-members.js";
import { renderLoadingState } from "../templates/loading-state.js";
import {
  renderProjectEditDialog,
  renderTrackEditDialog,
} from "../templates/project-player-edit-dialogs.js";
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
  const role = getProjectRole(project);
  const canManageProject = Boolean(project) && role === "owner";
  const loadingHiddenAttribute = project ? "" : "hidden";
  const contentHiddenAttribute = project ? "hidden" : "";

  return /*html*/ `
    <main class="app-shell project-player-page mobile-project-player-page" data-page="project-player">
      <header class="page-header project-player-header">
        <div class="project-player-header__actions">
          <button
            id="player-back-button"
            class="button button--secondary project-player-header__back"
            type="button"
            aria-label="Go back"
          >
            <span class="project-player-header__back-mobile" aria-hidden="true">‹</span>
          </button>

          <div class="project-player-header__mobile-heading">
            <p
              class="project-player-header__mobile-title"
              data-project-mobile-title-display
            >${heading}</p>
            ${project
              ? `<span class="project-player-header__mobile-role">${getRoleLabel(role)}</span>`
              : ""}
          </div>

          ${canManageProject
            ? renderProjectActionsMenu()
            : '<span class="project-player-header__actions-spacer" aria-hidden="true"></span>'}
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
          <h2 class="visually-hidden">Tracks</h2>
          <div id="player-track-list"></div>
          <p
            id="project-player-status"
            class="status-message"
            aria-live="polite"
          ></p>
        </section>

        ${canManageProject ? renderProjectMembersPanel({ hidden: true }) : ""}
      </div>

      ${canManageProject ? renderProjectEditDialog() : ""}
      ${renderTrackEditDialog()}
      ${renderMobileNavigation()}
    </main>
  `;
}
