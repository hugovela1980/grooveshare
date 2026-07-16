export function renderCreateProjectPage(): string {
    return /*html*/ `
    <main class="app-shell" data-page="create-project">
      <header class="page-header">
        <button id="back-to-menu-button" type="button">Back</button>

        <div>
          <p class="eyebrow">New Project</p>
          <h1>Create Project</h1>
          <p class="description">
            Start a new GrooveShare project. Track upload will be added after
            the project creation flow is stable.
          </p>
        </div>
      </header>

      <section class="panel">
        <h2>Project details</h2>

        <form id="project-form" class="project-form">
          <label>
            <span>Project title</span>
            <input
              id="project-title"
              name="title"
              type="text"
              placeholder="Chorus Riff Idea"
              required
            />
          </label>

          <label>
            <span>Description</span>
            <textarea
              id="project-description"
              name="description"
              rows="4"
              placeholder="Guitar riff with scratch drums"
            ></textarea>
          </label>

          <button type="submit">Create project</button>

          <p id="project-status" class="status-message" aria-live="polite"></p>
        </form>
      </section>
    </main>
  `;
}