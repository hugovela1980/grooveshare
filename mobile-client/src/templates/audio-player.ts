type AudioPlayerTemplateOptions = {
  showMicrophoneControl?: boolean;
};

export function renderAudioPlayer({
  showMicrophoneControl = false,
}: AudioPlayerTemplateOptions = {}): string {
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

      <audio id="project-audio-player" crossorigin="use-credentials"></audio>

      <div
        id="audio-playback-preparation"
        class="audio-player__preparation"
        role="status"
        aria-live="polite"
      >
        <span
          id="audio-playback-preparation-message"
          class="audio-player__preparation-message"
        >No tracks are available for playback.</span>
        <button
          id="audio-playback-preparation-retry"
          class="button audio-player__preparation-retry"
          type="button"
          hidden
          disabled
        >Try again</button>
      </div>

      <div class="audio-player__controls">
        <div class="audio-player__transport${showMicrophoneControl ? "" : " audio-player__transport--without-microphone"}" aria-label="Project transport">
        <div class="audio-player__seek-back-control">
          <button
            id="audio-seek-back-button"
            class="button audio-player__transport-button audio-player__seek-back-button"
            type="button"
            aria-label="Seek backward 5 seconds"
            disabled
          >
            <span aria-hidden="true">&lt;&lt;</span>
          </button>

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

        ${showMicrophoneControl ? /*html*/ `
          <button
            id="microphone-arm-button"
            class="button audio-player__transport-button audio-player__microphone-button"
            type="button"
            aria-label="Open recording workflow"
            aria-controls="microphone-recording-workspace"
            aria-pressed="false"
          >
            <svg class="audio-player__microphone-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 0 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Z" />
              <path d="M5.75 10.5v.5a6.25 6.25 0 0 0 12.5 0v-.5M12 17.25V21M9 21h6" />
            </svg>
            <span id="microphone-arm-button-label" class="visually-hidden">Open recording workflow</span>
          </button>
        ` : ""}

        <button
          id="audio-stop-button"
          class="button audio-player__transport-button audio-player__stop-button"
          type="button"
          aria-label="Stop mix"
          disabled
        >
          ■
        </button>

        <button
          id="audio-seek-forward-button"
          class="button audio-player__transport-button audio-player__seek-forward-button"
          type="button"
          aria-label="Seek forward 5 seconds"
          disabled
        >
          <span aria-hidden="true">&gt;&gt;</span>
        </button>
        </div>

        <div class="audio-player__switches">
        <label class="audio-player__loop-control">
          <input
            id="audio-loop-checkbox"
            type="checkbox"
            role="switch"
            data-audio-loop-checkbox
          />

          <span class="audio-player__control-caption">Loop</span>
          <span class="audio-player__switch" aria-hidden="true"></span>
        </label>

        <label class="audio-player__loop-control audio-player__metronome-control">
          <input
            id="audio-metronome-checkbox"
            type="checkbox"
            role="switch"
            data-audio-metronome-checkbox
          />

          <span class="audio-player__control-caption">Click</span>
          <span class="audio-player__switch" aria-hidden="true"></span>
        </label>
        </div>

        <div class="audio-player__timeline">
          <span id="audio-timestamp" class="audio-player__timestamp">00:00</span>
          <label class="visually-hidden" for="audio-progress">Seek project position</label>
          <input id="audio-progress" class="audio-player__progress" type="range" min="0" max="100" step="0.1" value="0" disabled />
          <span id="audio-duration" class="audio-player__duration">00:00</span>
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
        </div>

      </div>
    </section>
  `;
}
