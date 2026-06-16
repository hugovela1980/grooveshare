export function renderProjectMenuPage(): string {
    return /*html*/ `
        <main class="app-shell" data-page="project-menu">
            <header class="page-header">
                <div>
                    <p class="eyebrow">GrooveShare</p>
                    <h1>Project Menu</h1>
                    <p class="description">
                        Choose a project to open, or create a new one.
                    </p>
                </div>

                <button id="add-project-button" type="button">Add Project</button>
            </header>

            <section class="panel">
                <h2>Projects</h2>
                <div id="project-list"></div>
            </section>
        </main>
  `;
}