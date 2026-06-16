export function renderProjectPlayerPage(): string {
    return /*html*/ `
        <main class="app-shell" data-page="project-player">
            <header class="page-header">
                <button id="player-back-button" type="button">Back</button>

                <div>
                    <p class="eyebrow">Player</p>
                    <h1>Project Player</h1>
                    <p class="description">
                        Listen to uploaded tracks for the selected project.
                    </p>
                </div>

                <button id="player-menu-button" type="button">Menu</button>
            </header>

            <section class="panel">
                <h2>Tracks</h2>
                <div id="player-track-list"></div>
            </section>

            <section class="panel" id="player-area">
                <h2>Audio Player</h2>
                <p class="empty-state">
                    Single-track playback will be added here.
                </p>
            </section>
        </main>
  `;
}