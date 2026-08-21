export function renderAudioPlayer(): string {
  return /*html*/ `
    <section
      id="player-area"
      class="audio-player"
      aria-labelledby="audio-player-heading"
    >
      <div class="audio-player__header">
        <h2 id="audio-player-heading" class="visually-hidden">
          Audio Player
        </h2>

        <p id="audio-track-name" class="audio-player__track-name">
          No track loaded.
        </p>
      </div>

      <audio id="project-audio-player" crossorigin="use-credentials"></audio>

      <div class="audio-player__controls">
        <div class="audio-player__transport">
          <div class="audio-player__seek-back-control">
            <button
              id="audio-seek-back-button"
              class="button audio-player__transport-button audio-player__seek-back-button"
              type="button"
              aria-label="Seek backward 5 seconds"
              disabled
            >
              <span aria-hidden="true">↶5</span>
            </button>

            <span class="audio-player__control-caption" aria-hidden="true">
              -5s
            </span>
          </div>

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

          <label class="audio-player__loop-control">
            <input
              id="audio-loop-checkbox"
              type="checkbox"
              data-audio-loop-checkbox
            />

            <span class="audio-player__loop-button" aria-hidden="true">
              ↻
            </span>

            <span class="audio-player__control-caption">
              Loop
            </span>
          </label>
        </div>

        <div class="audio-player__musical-timeline" aria-label="Musical timeline position">
          <span id="audio-musical-position" class="audio-player__musical-position">
            Bar 1 · Beat 1
          </span>

          <div class="audio-player__bar-jump">
            <label for="audio-seek-bar-input">Bar</label>
            <input
              id="audio-seek-bar-input"
              class="audio-player__bar-input"
              type="number"
              min="1"
              step="1"
              value="1"
              inputmode="numeric"
              disabled
            />
            <button
              id="audio-seek-bar-button"
              class="button button--secondary audio-player__bar-jump-button"
              type="button"
              disabled
            >
              Go
            </button>
          </div>
        </div>

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

          <span id="audio-duration" class="audio-player__duration">
            00:00
          </span>
        </div>
      </div>
    </section>
  `;
}
