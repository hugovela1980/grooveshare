export function renderCreateProjectPage(): string {
    return /*html*/ `
        <main class="app-shell" data-page="create-project">
            <header class="page-header">
                <button id="back-to-menu-button" type="button">Back</button>

                <div>
                    <p class="eyebrow">New Project</p>
                    <h1>Create Project</h1>
                    <p class="description">
                        Start a new GrooveShare project and add an initial track.
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
        </main>
  `;
}