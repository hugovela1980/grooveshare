import { renderMicrophoneRecordingControls } from "./microphone-recording-controls.js";

type AudioPlayerTemplateOptions = {
  showMicrophoneControl?: boolean;
};

export function renderAudioPlayer({ showMicrophoneControl = false }: AudioPlayerTemplateOptions = {}): string {
  return /*html*/ `
    <section
      id="player-area"
      class="audio-player"
      aria-labelledby="audio-player-heading"
    >
      <div class="audio-player__header">
        <h2 id="audio-player-heading" class="audio-player__title">
          Project Player
        </h2>

        <p id="audio-track-name" class="audio-player__track-name">
          No track loaded.
        </p>
      </div>

      <audio id="project-audio-player" crossorigin="use-credentials"></audio>

      <div class="audio-player__controls">
        <div class="audio-player__transport">
          <div class="audio-player__transport-primary">
            <button
              id="audio-seek-back-button"
              class="button audio-player__transport-button audio-player__seek-back-button"
              type="button"
              aria-label="Seek backward 5 seconds"
              disabled
            >
              -5s
            </button>

            <button
              id="audio-play-pause-button"
              class="button audio-player__transport-button audio-player__play-pause-button"
              type="button"
              aria-label="Play or pause mix"
              disabled
            >
              ▶
            </button>

            ${showMicrophoneControl ? /*html*/ `
              <button
                id="microphone-arm-button"
                class="button audio-player__transport-button audio-player__microphone-button"
                type="button"
                aria-label="Prepare microphone"
                aria-controls="microphone-recording-workspace"
                aria-expanded="false"
                aria-pressed="false"
              >
                <svg class="audio-player__microphone-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 0 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Z" />
                  <path d="M5.75 10.5v.5a6.25 6.25 0 0 0 12.5 0v-.5M12 17.25V21M9 21h6" />
                </svg>
                <span id="microphone-arm-button-label" class="visually-hidden">Prepare microphone</span>
              </button>
            ` : ""}

            <button
              id="audio-stop-button"
              class="button audio-player__transport-button audio-player__stop-button"
              type="button"
              aria-label="Stop"
              disabled
            >
              <span class="audio-player__stop-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Stop</span>
            </button>

            <button
              id="audio-seek-forward-button"
              class="button audio-player__transport-button audio-player__seek-forward-button"
              type="button"
              aria-label="Seek forward 5 seconds"
              disabled
            >
              +5s
            </button>
          </div>

          <div class="audio-player__transport-secondary">
            <label class="audio-player__loop-control">
              <input
                id="audio-loop-checkbox"
                type="checkbox"
                data-audio-loop-checkbox
              />

              <span class="audio-player__loop-button">
                Loop<span class="audio-player__selected-indicator" aria-hidden="true"> ✓</span>
              </span>
            </label>

            <label class="audio-player__loop-control audio-player__metronome-control">
              <input
                id="audio-metronome-checkbox"
                type="checkbox"
                data-audio-metronome-checkbox
              />

              <span class="audio-player__loop-button">Click</span>
            </label>
          </div>
        </div>

        ${showMicrophoneControl ? renderMicrophoneRecordingControls() : ""}

        <div class="audio-player__timeline">
          <span id="audio-timestamp" class="audio-player__timestamp">
            00:00
          </span>

          <label class="visually-hidden" for="audio-progress">
            Seek project position
          </label>

          <input
            id="audio-progress"
            class="audio-player__progress"
            type="range"
            min="0"
            max="100"
            step="0.1"
            value="0"
            aria-valuetext="Bar 1 · Beat 1, 00:00 of 00:00"
            disabled
          />

          <span id="audio-duration" class="audio-player__duration">
            00:00
          </span>
        </div>

        <div class="audio-player__musical-timeline" aria-label="Musical timeline position">
          <span id="audio-musical-position" class="audio-player__musical-position">
            Bar 1 · Beat 1
          </span>

          <div class="audio-player__bar-jump">
            <span class="audio-player__go-label">Go to</span>
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
            <label for="audio-seek-beat-input">Beat</label>
            <input
              id="audio-seek-beat-input"
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
          <p id="audio-seek-status" class="audio-player__seek-status" role="status"></p>
        </div>


      </div>
    </section>
  `;
}
