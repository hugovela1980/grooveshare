import { canRecord, getProjectMusicalTimeline } from "@hugovela/frontend-core";
import { renderAudioPlayer } from "../templates/audio-player.js";
import { renderMicrophoneRecordingControls } from "../templates/microphone-recording-controls.js";
import { renderProjectActionsMenu } from "../templates/project-actions-menu.js";
import { renderProjectInvitationPanel } from "../templates/project-invitation-controls.js";
import { renderProjectMembersPanel } from "../templates/project-members.js";
import { renderLoadingState } from "../templates/loading-state.js";
import type { Project, ProjectRole, User } from "../types.js";

function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function renderProjectHeading(project: Project | null): string { return project ? escapeHtml(project.title) : "Project Player"; }
function renderProjectDescription(project: Project | null): string { return project ? escapeHtml(project.description) : "Select a project from the Project Menu."; }
function isGuestProject(project: Project | null): boolean { return project?.access === "guest" && project.role == null; }
function getProjectRole(project: Project | null): ProjectRole { return project?.role ?? "owner"; }
function getRoleLabel(project: Project | null): string { if (isGuestProject(project)) return "Guest"; const role = getProjectRole(project); if (role === "owner") return "Owner"; if (role === "contributor") return "Contributor"; return "Viewer"; }
function renderMusicalTimelineSummary(project: Project | null): string {
  if (!project) return "";
  const timeline = getProjectMusicalTimeline(project);
  return `${timeline.bpm} BPM · ${timeline.timeSignature.numerator}/${timeline.timeSignature.denominator} · Bar 1 at project start`;
}

type ProjectPlayerPageOptions = { currentUser?: User | null; hasContributorInvitation?: boolean; statusMessage?: string };

export function renderProjectPlayerPage(project: Project | null = null, { currentUser = null, hasContributorInvitation = false, statusMessage = "" }: ProjectPlayerPageOptions = {}): string {
  const heading = renderProjectHeading(project);
  const description = renderProjectDescription(project);
  const musicalTimelineSummary = renderMusicalTimelineSummary(project);
  const guest = isGuestProject(project);
  const role = guest ? null : getProjectRole(project);
  const canManageProject = Boolean(project) && role === "owner";
  const canRecordProject = Boolean(project?.role && canRecord(project.role));
  const editableAttribute = canManageProject ? 'contenteditable="true"' : "";
  const editableClass = canManageProject ? " project-player-editable--enabled" : "";
  const canBecomeContributor = Boolean(project && hasContributorInvitation && role !== "owner" && role !== "contributor");
  const loadingHiddenAttribute = project ? "" : "hidden";
  const contentHiddenAttribute = project ? "hidden" : "";

  return /*html*/ `
    <main class="app-shell project-player-page desktop-project-player-page" data-page="project-player" ${guest ? 'data-project-access="guest"' : ""}>
      <header class="page-header project-player-header">
        <div class="project-player-header__actions">
          ${guest && !currentUser ? `<button id="player-guest-home-button" class="button button--secondary" type="button">Home</button><button id="player-login-button" class="button button--secondary" type="button">Log In</button>` : `<button id="player-back-button" class="button button--secondary" type="button">Back</button><button id="player-logout-button" class="button button--secondary" type="button">Log Out</button>`}
          ${canManageProject ? renderProjectActionsMenu() : ""}
        </div>
        <details class="project-player-header__details" data-project-details>
          <summary class="project-player-header__summary">
            <span class="project-player-header__summary-title" data-project-summary-title-display>${heading}</span>
            ${project ? `<span class="project-role-badge${guest ? " project-role-badge--guest" : ""}">${getRoleLabel(project)}</span>` : ""}
            <span class="project-player-header__disclosure" aria-hidden="true"></span>
          </summary>
          <div class="project-player-header__details-content">
            <div class="project-player-header__eyebrow-row"><p class="eyebrow">Project Details</p></div>
            <div class="project-player-editable project-player-editable--title${editableClass}"><h1 class="project-player-editable__text project-player-editable__title" ${editableAttribute} ${canManageProject ? 'role="textbox" aria-label="Edit project title"' : ""} spellcheck="false" data-project-title-display>${heading}</h1></div>
            <div class="project-player-editable project-player-editable--description${editableClass}"><p class="description project-player-editable__text project-player-editable__description" ${editableAttribute} ${canManageProject ? 'role="textbox" aria-label="Edit project description"' : ""} data-placeholder="No description provided." data-project-description-display>${description}</p></div>
            ${project ? `<p class="description project-musical-timeline-summary" data-project-musical-timeline-display>${musicalTimelineSummary}</p>` : ""}
          </div>
        </details>
      </header>
      <div id="project-player-loading" class="project-player-loading" ${loadingHiddenAttribute}>${renderLoadingState("Loading your project...", { className: "project-player-loading__state" })}</div>
      <div id="project-player-content" class="project-player-content" ${contentHiddenAttribute}>
        ${statusMessage ? `<p class="status-message project-player-notice" role="status">${escapeHtml(statusMessage)}</p>` : ""}
        ${guest ? `<section id="guest-access-banner" class="guest-access-banner guest-message-card" aria-label="Guest access"><button id="dismiss-guest-access-button" class="icon-button guest-message-card__close" type="button" aria-label="Dismiss Guest listening message">×</button><div><p class="eyebrow">Guest Listening</p><h2>You are viewing this project as a Guest.</h2><p>Your mix stays on this browser. You cannot change the shared project or upload tracks.</p></div></section>` : ""}
        ${canBecomeContributor ? `<section id="contributor-invitation-card" class="contributor-invitation-card guest-message-card" aria-labelledby="contributor-invitation-heading"><button id="dismiss-contributor-invitation-button" class="icon-button guest-message-card__close" type="button" aria-label="Dismiss collaboration invitation message">×</button><div><p class="eyebrow">Collaboration Invitation</p><h2 id="contributor-invitation-heading">Become a Contributor</h2><p>${currentUser ? "Accept this invitation to add tracks and collaborate through your account." : "Log in or create an account, then explicitly accept this invitation to contribute."}</p></div><button id="become-contributor-button" class="button contributor-invitation-card__button" type="button">${currentUser ? "Accept Contributor Invitation" : "Become a Contributor"}</button><p id="contributor-invitation-status" class="status-message" aria-live="polite"></p></section>` : ""}
        <div class="project-player-workspace">
          ${renderAudioPlayer({ showMicrophoneControl: canRecordProject })}
          ${canRecordProject ? renderMicrophoneRecordingControls() : ""}
          <section class="panel project-player-tracks-panel">
            <h2 class="visually-hidden">Tracks</h2>
            <div id="player-track-list"></div>
            <p id="project-player-status" class="status-message" aria-live="polite"></p>
          </section>
        </div>
        ${canManageProject ? renderProjectMembersPanel({ hidden: true }) : ""}
        ${canManageProject ? renderProjectInvitationPanel({ hidden: true }) : ""}
      </div>
    </main>`;
}
