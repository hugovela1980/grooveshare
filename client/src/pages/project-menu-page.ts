export function renderProjectMenuPage(): string {
    return /*html*/ `
        <main class="project-menu-page" data-page="project-menu">
        <header class="project-menu-hero">
            <h1 class="project-menu-hero__title">Grooveshare</h1>
            <p class="project-menu-hero__tagline">Share tracks. Build songs together.</p>
        </header>

        <section class="panel project-menu-panel" aria-labelledby="current-projects-heading">
            <h2 id="current-projects-heading" class="project-menu-panel__title">
            Current Projects
            </h2>

            <div id="project-list" class="project-menu-panel__list"></div>

            <p
                id="project-menu-status"
                class="status-message"
                aria-live="polite"
            ></p>
        </section>

        <div class="project-menu-actions">
            <button
            id="add-project-button"
            class="project-menu-actions__button"
            type="button"
            >
            Create a New Project
            </button>
        </div>
        </main>
  `;
}