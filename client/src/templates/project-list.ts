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
    return /*html*/ `
      <p class="empty-state">No projects yet. Create your first GrooveShare project.</p>
    `;
  }

  return /*html*/ `
    <div class="project-list">
      ${projects
        .map((project) => {
          return /*html*/ `
            <article class="project-card">
              <h3>${escapeHtml(project.title)}</h3>
              <p>${escapeHtml(project.description || "No description yet.")}</p>
              <small>Created ${new Date(project.createdAt).toLocaleString()}</small>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}