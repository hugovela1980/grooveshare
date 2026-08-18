import { renderLoadingState } from "../templates/loading-state.js";
import type { User } from "../types.js";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function renderProjectMenuPage(currentUser: User | null = null, { statusMessage = "" }: { statusMessage?: string } = {}): string {
  const sessionMarkup = currentUser ? /*html*/ `
    <div class="project-menu-session">
      <p class="project-menu-session__identity">Signed in as <strong>${escapeHtml(currentUser.displayName)}</strong> <span>${escapeHtml(currentUser.email)}</span></p>
      <button id="logout-button" class="button button--secondary" type="button">Log Out</button>
    </div>` : "";

  return /*html*/ `
    <main class="project-menu-page" data-page="project-menu">
      <header class="project-menu-hero"><h1 class="project-menu-hero__title">Grooveshare</h1><p class="project-menu-hero__tagline">Share tracks. Build songs together.</p></header>
      ${sessionMarkup}
      <section class="panel project-menu-panel" aria-labelledby="current-projects-heading">
        <h2 id="current-projects-heading" class="project-menu-panel__title">Current Projects</h2>
        <div id="project-list" class="project-menu-panel__list">${renderLoadingState("Loading projects...", { compact: true })}</div>
        <p id="project-menu-status" class="status-message" aria-live="polite">${statusMessage ? escapeHtml(statusMessage) : ""}</p>
      </section>
      <div class="project-menu-actions"><button id="add-project-button" class="project-menu-actions__button" type="button">Create a New Project</button></div>
    </main>`;
}
