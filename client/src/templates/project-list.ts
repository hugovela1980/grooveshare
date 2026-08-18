import type { Project, ProjectRole } from "../types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getRoleLabel(role: ProjectRole | null | undefined): string {
  if (role === "owner") return "Owner";
  if (role === "contributor") return "Contributor";
  if (role === "viewer") return "Viewer";
  return "Project";
}

type ProjectListOptions = {
  invitationProjectId?: string | null;
};

export function renderProjectList(
  projects: Project[],
  { invitationProjectId = null }: ProjectListOptions = {},
): string {
  if (projects.length === 0) {
    return '<p class="empty-state">No projects yet.</p>';
  }

  return /*html*/ `
    <ul class="project-list project-list--menu">
      ${projects
        .map((project) => {
          const description = project.description.trim()
            ? escapeHtml(project.description)
            : "No description provided.";
          const hasInvitation = invitationProjectId === project.id;
          const invitationOnly = project.access === "guest" && project.role == null;
          const roleLabel = invitationOnly ? "Guest" : getRoleLabel(project.role);
          const mayAcceptInvitation =
            hasInvitation &&
            project.role !== "owner" &&
            project.role !== "contributor";

          return /*html*/ `
            <li class="project-list__item${hasInvitation ? " project-list__item--invited" : ""}">
              <article class="project-card${hasInvitation ? " project-card--invited" : ""}">
                <div class="project-card__content">
                  <div class="project-card__heading">
                    <h3 class="project-list__title">${escapeHtml(project.title)}</h3>
                    <span class="project-list__role${hasInvitation ? " project-list__role--invited" : ""}">${roleLabel}</span>
                  </div>
                  <p class="project-list__description">${description}</p>
                </div>

                <div class="project-card__actions">
                  ${mayAcceptInvitation
                    ? `<button class="button project-list__invitation-action" type="button" data-accept-invitation-project-id="${escapeHtml(project.id)}">Become a Collaborator</button>`
                    : ""}

                  <button
                    class="project-list__open-button"
                    type="button"
                    data-project-id="${escapeHtml(project.id)}"
                    aria-label="Open ${escapeHtml(project.title)}"
                  >
                    <span>Open</span>
                    <span class="project-list__open-arrow" aria-hidden="true">→</span>
                  </button>
                </div>
              </article>
            </li>`;
        })
        .join("")}
    </ul>`;
}
