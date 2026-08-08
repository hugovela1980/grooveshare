export function renderAudioPlayer(): string {
  return /*html*/ `
    <section
      id="player-area"
      class="audio-player"
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
          class="button audio-player__transport-button audio-player__play-pause-button"
          type="button"
          aria-label="Play or pause mix"
          disabled
        >
          ▶
        </button>

        <button
          id="audio-stop-button"
          class="button audio-player__transport-button audio-player__stop-button"
          type="button"
          aria-label="Stop mix"
          disabled
        >
          ■
        </button>

        <label class="audio-player__loop-label">
          <span>Loop</span>

          <input
            id="audio-loop-checkbox"
            type="checkbox"
            data-audio-loop-checkbox
          />
        </label>

        <div class="audio-player__timeline">
          <span id="audio-timestamp" class="audio-player__timestamp">
            00:00
          </span>

          <label class="visually-hidden" for="audio-progress">
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
        </div>
      </div>
    </section>
  `;
}