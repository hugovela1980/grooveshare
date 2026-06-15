export function createAppShell(): string {
  return /*html*/ `
    <main class="app-shell">
      <section class="hero">
        <p class="eyebrow">GrooveShare</p>
        <h1>Share rough tracks with your bandmates.</h1>
        <p class="description">
          A lightweight music collaboration tool for sharing stems,
          practicing parts, and sending rough recordings back.
        </p>
      </section>

      <section class="panel">
        <h2>Create a project</h2>

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

      <section class="panel">
        <h2>Upload a track</h2>

        <form id="track-upload-form" class="project-form">
          <label>
            <span>Project</span>
            <select id="upload-project-select" name="projectId" required>
              <option value="">Select a project</option>
            </select>
          </label>

          <label>
            <span>Track name</span>
            <input
              id="track-name"
              name="trackName"
              type="text"
              placeholder="Guitar"
            />
          </label>

          <label>
            <span>Audio file</span>
            <input
              id="audio-file"
              name="audioFile"
              type="file"
              accept="audio/*"
              required
            />
          </label>

          <button type="submit">Upload track</button>

          <p id="track-upload-status" class="status-message" aria-live="polite"></p>

          <div id="track-list"></div>
        </form>
      </section>

      <section class="panel">
        <h2>Projects</h2>
        <div id="project-list"></div>
      </section>
    </main>
  `;
}