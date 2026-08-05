export function renderAudioPlayer(): string {
    return /*html*/ `
      <section
        id="player-area"
        class="panel audio-player"
        aria-labelledby="audio-player-heading"
      >
      <div class="audio-player__header">
        <h2 id="audio-player-heading" class="audio-player__title">
          Audio Player
        </h2>

        <p id="audio-track-name" class="audio-player__track-name">
          No track loaded.
        </p>
      </div>

      <audio id="project-audio-player"></audio>

      <div class="audio-player__controls">
        <button
          id="audio-play-pause-button"
          class="button"
          type="button"
          disabled
        >
          Play
        </button>

        <button
          id="audio-stop-button"
          class="button button--secondary"
          type="button"
          disabled
        >
          Stop
        </button>

        <label class="audio-player__progress-label" for="audio-progress">
          Progress
        </label>

        <input
          id="audio-progress"
          class="audio-player__progress"
          type="range"
          min="0"
          max="100"
          step="0.1"
          value="0"
          disabled
        />

        <span id="audio-timestamp" class="audio-player__timestamp">
          00:00
        </span>
      </div>
    </section>
  `;
}