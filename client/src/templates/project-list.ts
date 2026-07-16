import type { Project } from "../types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderProjectList(projects: Project[]): string {
  if (projects.length === 0) {
    return '<p class="empty-state">No projects yet.</p>';
  }

  return /*html*/ `
    <ul class="project-list">
      ${projects
        .map((project) => {
          const description = project.description.trim()
            ? escapeHtml(project.description)
            : "No description provided.";

          return /*html*/ `
              <li class="project-list__item">
                <button
                  class="project-list__button"
                  type="button"
                  data-project-id="${escapeHtml(project.id)}"
                >
                  <span class="project-list__title">${escapeHtml(project.title)}</span>
                  <span class="project-list__description">${description}</span>
                </button>
              </li>
            `;
        })
        .join("")}
    </ul>
  `;
}