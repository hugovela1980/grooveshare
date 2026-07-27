export function renderCreateProjectPage(): string {
  return /*html*/ `
    <main class="app-shell create-project-page" data-page="create-project">
      <header class="page-header create-project-header">
        <button id="back-to-menu-button" type="button">Back</button>

        <div>
          <p class="eyebrow">New Project</p>
          <h1>Create Project</h1>
          <p class="description">
            Start a new GrooveShare project and choose any tracks you want
            to include.
          </p>
        </div>
      </header>

      <section class="panel create-project-panel">
        <form id="project-form" class="project-form create-project-form">
          <section class="create-project-form__section">
            <h2>Project details</h2>

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
          </section>

          <section class="create-project-form__section">
            <h2>Tracks to include</h2>

            <label>
              <span>Track name</span>
              <input
                id="pending-track-name"
                name="trackName"
                type="text"
                placeholder="Guitar"
              />
            </label>

            <label>
              <span>Audio file</span>
              <input
                id="pending-audio-file"
                name="audioFile"
                type="file"
                accept="audio/*"
              />
            </label>
          </section>

          <div class="create-project-actions">
            <button type="submit">Create a New Project</button>
          </div>

          <p id="project-status" class="status-message" aria-live="polite"></p>
        </form>
      </section>
    </main>
  `;
}