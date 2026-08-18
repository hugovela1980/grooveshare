import { renderMobileNavigation } from "../templates/mobile-navigation.js";
import { renderLoadingState } from "../templates/loading-state.js";
import type { User } from "../types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderProjectMenuPage(
  currentUser: User | null = null,
  { statusMessage = "" }: { statusMessage?: string } = {},
): string {
  const sessionMarkup = currentUser
    ? /*html*/ `
      <div class="project-menu-session">
        <div class="project-menu-session__avatar" aria-hidden="true">
          ${escapeHtml(currentUser.displayName.trim().slice(0, 1).toUpperCase() || "G")}
        </div>
        <p class="project-menu-session__identity">
          <span>Signed in as</span>
          <strong>${escapeHtml(currentUser.displayName)}</strong>
          <small>${escapeHtml(currentUser.email)}</small>
        </p>
      </div>
    `
    : "";

  return /*html*/ `
    <main class="project-menu-page" data-page="project-menu">
      <header class="project-menu-hero">
        <p class="eyebrow">Your workspace</p>
        <h1 class="project-menu-hero__title">GrooveShare</h1>
        <p class="project-menu-hero__tagline">Pick up where the music left off.</p>
      </header>

      ${sessionMarkup}

      <section class="panel project-menu-panel" aria-labelledby="current-projects-heading">
        <div class="project-menu-panel__header">
          <div>
            <p class="eyebrow">Projects</p>
            <h2 id="current-projects-heading" class="project-menu-panel__title">
              Current Projects
            </h2>
          </div>

          <button
            id="add-project-button"
            class="project-menu-actions__button"
            type="button"
          >
            <span aria-hidden="true">＋</span>
            New Project
          </button>
        </div>

        <div id="project-list" class="project-menu-panel__list">
          ${renderLoadingState("Loading projects...", { compact: true })}
        </div>

        <p
          id="project-menu-status"
          class="status-message"
          aria-live="polite"
        >${statusMessage ? escapeHtml(statusMessage) : ""}</p>
      </section>

      ${currentUser ? renderMobileNavigation({ activeItem: "home" }) : ""}
    </main>
  `;
}
