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
  if (role === "owner") {
    return "Owner";
  }

  if (role === "contributor") {
    return "Contributor";
  }

  if (role === "viewer") {
    return "Viewer";
  }

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
    return /*html*/ `
      <div class="project-list-empty">
        <p class="empty-state">No projects yet.</p>
        <p>Create your first project to start sharing tracks.</p>
      </div>
    `;
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
          const roleLabel = invitationOnly
            ? "Invited Guest"
            : getRoleLabel(project.role);

          return /*html*/ `
            <li class="project-list__item${hasInvitation ? " project-list__item--invited" : ""}">
              <button
                class="project-list__button project-list__button--menu"
                type="button"
                data-project-id="${escapeHtml(project.id)}"
                aria-label="Open ${escapeHtml(project.title)}"
              >
                <span class="project-list__card-heading">
                  <span class="project-list__title">${escapeHtml(project.title)}</span>
                  <span class="project-list__role${hasInvitation ? " project-list__role--invited" : ""}">${roleLabel}</span>
                </span>
                <span class="project-list__description">${description}</span>
                ${hasInvitation
                  ? '<span class="project-list__invitation-note">Collaboration invitation available</span>'
                  : ""}
                <span class="project-list__open" aria-hidden="true">Open <span>›</span></span>
              </button>

              ${hasInvitation && project.role !== "owner" && project.role !== "contributor"
                ? /*html*/ `
                  <button
                    class="button project-list__invitation-action"
                    type="button"
                    data-accept-invitation-project-id="${escapeHtml(project.id)}"
                  >
                    Become a Collaborator
                  </button>
                `
                : ""}
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}
