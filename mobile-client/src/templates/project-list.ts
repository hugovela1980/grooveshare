import type { Project, ProjectRole } from "../types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getRoleLabel(role: ProjectRole | undefined): string {
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

export function renderProjectList(projects: Project[]): string {
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

        return /*html*/ `
            <li class="project-list__item">
              <button
                class="project-list__button project-list__button--menu"
                type="button"
                data-project-id="${escapeHtml(project.id)}"
                aria-label="Open ${escapeHtml(project.title)}"
              >
                <span class="project-list__card-heading">
                  <span class="project-list__title">${escapeHtml(project.title)}</span>
                  <span class="project-list__role">${getRoleLabel(project.role)}</span>
                </span>
                <span class="project-list__description">${description}</span>
                <span class="project-list__open" aria-hidden="true">Open <span>›</span></span>
              </button>
            </li>
          `;
      })
      .join("")}
    </ul>
  `;
}
