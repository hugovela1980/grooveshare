import type { Project } from "../types.js";

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function renderProjectDetails(project: Project | null): string {
    if (!project) {
        return /*html*/ `
      <p class="empty-state">Project confirmation details will appear here.</p>
    `;
    }

    const description = project.description.trim()
        ? escapeHtml(project.description)
        : "No description provided.";

    return /*html*/ `
    <dl class="project-summary">
      <div>
        <dt>Title</dt>
        <dd>${escapeHtml(project.title)}</dd>
      </div>

      <div>
        <dt>Description</dt>
        <dd>${description}</dd>
      </div>
    </dl>
  `;
}

export function renderConfirmProjectPage(project: Project | null = null): string {
    return /*html*/ `
    <main class="app-shell" data-page="confirm-project">
      <header class="page-header">
        <p class="eyebrow">Project Created</p>
        <h1>Confirm Project</h1>
        <p class="description">
          Review the project details, then return to the Project Menu.
        </p>
      </header>

      <section class="panel" id="confirm-project">
        <h2>Project details</h2>
        <div id="confirm-project-details">
          ${renderProjectDetails(project)}
        </div>

        <button id="confirm-project-button" type="button">Submit</button>
      </section>
    </main>
  `;
}