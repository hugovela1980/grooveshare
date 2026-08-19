import type { ApplicationPresentationPort } from "@hugovela/frontend-core";
import { renderAuthPage } from "../pages/auth-page.js";
import { renderCreateProjectPage } from "../pages/create-project-page.js";
import { renderProjectMenuPage } from "../pages/project-menu-page.js";
import { renderProjectPlayerPage } from "../pages/project-player-page.js";
import { renderAppLoadingState } from "../templates/loading-state.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Desktop/tablet presentation adapter. Stage 1 deliberately delegates to the
 * existing renderers so this contract boundary changes no UI behavior.
 */
export function createApplicationPresentationAdapter(): ApplicationPresentationPort<string> {
  return {
    showAuthentication({ message }) {
      return renderAuthPage({ message });
    },

    showProjects({ currentUser, statusMessage }) {
      return renderProjectMenuPage(currentUser, { statusMessage });
    },

    showCreateProject({ projectDraft }) {
      return renderCreateProjectPage(projectDraft);
    },

    showProjectPlayer({
      project,
      currentUser,
      hasContributorInvitation,
      statusMessage,
    }) {
      return renderProjectPlayerPage(project, {
        currentUser,
        hasContributorInvitation,
        statusMessage,
      });
    },

    showLoading({ message }) {
      return renderAppLoadingState(message);
    },

    showError({ message }) {
      return /*html*/ `
        <main class="app-shell app-error-page" data-page="error">
          <p class="status-message" role="alert">${escapeHtml(message)}</p>
        </main>
      `;
    },
  };
}
