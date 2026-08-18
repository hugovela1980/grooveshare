import { renderAudioPlayer } from "../templates/audio-player.js";
import { renderMobileNavigation } from "../templates/mobile-navigation.js";
import { renderProjectActionsMenu } from "../templates/project-actions-menu.js";
import { renderProjectInvitationPanel } from "../templates/project-invitation-controls.js";
import { renderProjectMembersPanel } from "../templates/project-members.js";
import { renderLoadingState } from "../templates/loading-state.js";
import {
  renderProjectEditDialog,
  renderTrackEditDialog,
} from "../templates/project-player-edit-dialogs.js";
import type { Project, ProjectRole, User } from "../types.js";

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

function isGuestProject(project: Project | null): boolean {
  return project?.access === "guest" && project.role == null;
}

function getProjectRole(project: Project | null): ProjectRole {
  // Existing legacy fixtures may omit role. A real Guest response is
  // distinguished by access="guest" and role=null before this fallback.
  return project?.role ?? "owner";
}

function getRoleLabel(project: Project | null): string {
  if (isGuestProject(project)) {
    return "Guest";
  }

  const role = getProjectRole(project);

  if (role === "owner") {
    return "Owner";
  }

  if (role === "contributor") {
    return "Contributor";
  }

  return "Viewer";
}

type ProjectPlayerPageOptions = {
  currentUser?: User | null;
  hasContributorInvitation?: boolean;
  statusMessage?: string;
};

export function renderProjectPlayerPage(
  project: Project | null = null,
  {
    currentUser = null,
    hasContributorInvitation = false,
    statusMessage = "",
  }: ProjectPlayerPageOptions = {},
): string {
  const heading = renderProjectHeading(project);
  const guest = isGuestProject(project);
  const role = guest ? null : getProjectRole(project);
  const canManageProject = Boolean(project) && role === "owner";
  const canEditTracks = Boolean(project) && (role === "owner" || role === "contributor");
  const canBecomeContributor = Boolean(
    project &&
    hasContributorInvitation &&
    role !== "owner" &&
    role !== "contributor",
  );
  const showBackButton = Boolean(currentUser) || !guest;
  const loadingHiddenAttribute = project ? "" : "hidden";
  const contentHiddenAttribute = project ? "hidden" : "";

  return /*html*/ `
    <main class="app-shell project-player-page mobile-project-player-page" data-page="project-player" ${guest ? 'data-project-access="guest"' : ""}>
      <header class="page-header project-player-header">
        <div class="project-player-header__actions ${showBackButton ? "" : "project-player-header__actions--guest-locked"}">
          ${showBackButton
            ? /*html*/ `
              <button
                id="player-back-button"
                class="button button--secondary project-player-header__back"
                type="button"
                aria-label="Go back"
              >
                <span class="project-player-header__back-mobile" aria-hidden="true">‹</span>
              </button>
            `
            : '<span class="project-player-header__actions-spacer" aria-hidden="true"></span>'}

          <div class="project-player-header__mobile-heading">
            <p
              class="project-player-header__mobile-title"
              data-project-mobile-title-display
            >${heading}</p>
            ${project
              ? `<span class="project-player-header__mobile-role${guest ? " project-player-header__mobile-role--guest" : ""}">${getRoleLabel(project)}</span>`
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
        ${statusMessage
          ? `<p class="status-message project-player-notice" role="status">${escapeHtml(statusMessage)}</p>`
          : ""}

        ${guest
          ? /*html*/ `
            <section id="guest-access-banner" class="guest-access-banner guest-message-card" aria-label="Guest access">
              <button
                id="dismiss-guest-access-button"
                class="icon-button guest-message-card__close"
                type="button"
                aria-label="Dismiss Guest listening message"
              >×</button>
              <div>
                <p class="eyebrow">Guest listening</p>
                <h2>You are viewing this project as a Guest.</h2>
                <p>Your mix stays on this browser. You cannot change the shared project or upload tracks.</p>
              </div>
            </section>
          `
          : ""}

        ${canBecomeContributor
          ? /*html*/ `
            <section id="contributor-invitation-card" class="contributor-invitation-card guest-message-card" aria-labelledby="contributor-invitation-heading">
              <button
                id="dismiss-contributor-invitation-button"
                class="icon-button guest-message-card__close"
                type="button"
                aria-label="Dismiss collaboration invitation message"
              >×</button>
              <div>
                <p class="eyebrow">Collaboration invitation</p>
                <h2 id="contributor-invitation-heading">Become a Contributor</h2>
                <p>${currentUser
                  ? "Accept this invitation to add tracks and collaborate through your account."
                  : "Log in or create an account, then explicitly accept this invitation to contribute."}</p>
              </div>
              <button id="become-contributor-button" class="button contributor-invitation-card__button" type="button">
                ${currentUser ? "Accept Contributor Invitation" : "Become a Contributor"}
              </button>
              <p id="contributor-invitation-status" class="status-message" aria-live="polite"></p>
            </section>
          `
          : ""}

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
        ${canManageProject ? renderProjectInvitationPanel({ hidden: true }) : ""}
      </div>

      ${canManageProject ? renderProjectEditDialog() : ""}
      ${canEditTracks ? renderTrackEditDialog() : ""}
      ${renderMobileNavigation({ mode: currentUser ? "authenticated" : "guest" })}
    </main>
  `;
}
