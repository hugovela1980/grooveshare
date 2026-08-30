function renderMicrophoneIcon(className = "microphone-recording__microphone-icon"): string {
  return /*html*/ `
    <svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 0 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Z" />
      <path d="M5.75 10.5v.5a6.25 6.25 0 0 0 12.5 0v-.5M12 17.25V21M9 21h6" />
    </svg>
  `;
}

function renderCloseButton(id: string, label: string): string {
  return /*html*/ `
    <button
      id="${id}"
      class="microphone-recording__close"
      type="button"
      aria-label="${label}"
    >
      <span aria-hidden="true">×</span>
    </button>
  `;
}

export function renderMicrophoneRecordingControls(): string {
  return /*html*/ `
    <section
      id="microphone-recording-workspace"
      class="microphone-recording"
      aria-label="Recording workflow"
      hidden
    >
      <span class="microphone-recording__handle" aria-hidden="true"></span>

      <div
        id="microphone-preparing-view"
        class="microphone-recording__view microphone-recording__view--preparing"
        data-microphone-workflow-view="preparing"
        hidden
      >
        ${renderCloseButton("microphone-preparing-close-button", "Cancel microphone preparation")}

        <div class="microphone-recording__hero" aria-hidden="true">
          <span class="microphone-recording__preparing-ring">
            ${renderMicrophoneIcon()}
          </span>
        </div>

        <div class="microphone-recording__copy">
          <h2 id="microphone-recording-heading">Preparing microphone</h2>
          <p>Allow microphone access to record a take.</p>
        </div>

        <button
          id="microphone-cancel-button"
          class="button button--secondary microphone-recording__secondary-action"
          type="button"
        >
          Cancel
        </button>
      </div>

      <div
        id="microphone-ready-view"
        class="microphone-recording__view microphone-recording__view--ready"
        data-microphone-workflow-view="ready"
        hidden
      >
        ${renderCloseButton("microphone-ready-close-button", "Close microphone recording workflow")}

        <div class="microphone-recording__hero" aria-hidden="true">
          <span class="microphone-recording__ready-ring">
            ${renderMicrophoneIcon()}
          </span>
        </div>

        <div class="microphone-recording__copy">
          <h2>Microphone ready</h2>
        </div>

        <button
          id="microphone-start-position-button"
          class="microphone-recording__start-position"
          type="button"
          aria-expanded="false"
          aria-controls="microphone-start-position-editor"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
            <circle cx="12" cy="10" r="2" />
          </svg>
          <span id="microphone-start-position-label">Start at Bar 1 · Beat 1</span>
          <span class="microphone-recording__start-position-chevron" aria-hidden="true">›</span>
        </button>

        <div id="microphone-start-position-editor" class="microphone-recording__start-editor" hidden>
          <div class="microphone-recording__start-fields">
            <label>
              <span>Bar</span>
              <input
                id="microphone-start-bar-input"
                class="input"
                type="number"
                min="1"
                step="1"
                value="1"
                inputmode="numeric"
              />
            </label>
            <label>
              <span>Beat</span>
              <input
                id="microphone-start-beat-input"
                class="input"
                type="number"
                min="1"
                step="1"
                value="1"
                inputmode="numeric"
              />
            </label>
          </div>
          <button
            id="microphone-start-position-apply-button"
            class="button button--secondary microphone-recording__apply-position"
            type="button"
          >
            Set position
          </button>
          <p id="microphone-start-position-status" class="microphone-recording__field-status" aria-live="polite"></p>
        </div>

        <button
          id="microphone-record-button"
          class="button microphone-recording__primary-action"
          type="button"
          disabled
        >
          Start recording
        </button>

        <p
          id="microphone-recording-start-status"
          class="microphone-recording__start-status"
          role="status"
          aria-live="polite"
        ></p>

        <p class="microphone-recording__headphones-hint">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H4v-6ZM17 14h3v6h-3v-6Z" />
          </svg>
          <span>Use wired headphones<br />for the best experience.</span>
        </p>
      </div>

      <div
        id="microphone-failure-view"
        class="microphone-recording__view microphone-recording__view--failure"
        data-microphone-workflow-view="failure"
        hidden
      >
        ${renderCloseButton("microphone-failure-close-button", "Close microphone error")}

        <div class="microphone-recording__hero" aria-hidden="true">
          <span class="microphone-recording__failure-ring">
            ${renderMicrophoneIcon()}
            <span class="microphone-recording__warning">!</span>
          </span>
        </div>

        <div class="microphone-recording__copy">
          <h2 id="microphone-failure-heading">Microphone access needed</h2>
          <p id="microphone-failure-message">Allow microphone access in your browser settings, then try again.</p>
        </div>

        <button
          id="microphone-retry-permission-button"
          class="button microphone-recording__primary-action"
          type="button"
        >
          Try again
        </button>
        <button
          id="microphone-failure-cancel-button"
          class="button button--secondary microphone-recording__secondary-action"
          type="button"
        >
          Cancel
        </button>
      </div>

      <div
        id="microphone-count-in-view"
        class="microphone-recording__view microphone-recording__view--count-in"
        data-microphone-workflow-view="count-in"
        hidden
      >
        <p class="microphone-recording__phase-label">Count-in</p>
        <strong id="microphone-count-in-number" class="microphone-recording__count-in-number">1</strong>
        <p class="microphone-recording__phase-copy">Get ready</p>
        <div
          id="microphone-count-in-beats"
          class="microphone-recording__count-in-beats"
          aria-label="Count-in beat 1 of 4"
        ></div>
        <p id="microphone-count-in-position" class="microphone-recording__phase-position">
          Recording starts at Bar 1 · Beat 1
        </p>
        <button
          id="microphone-count-in-cancel-button"
          class="button button--secondary microphone-recording__secondary-action"
          type="button"
        >
          Cancel
        </button>
      </div>

      <div
        id="microphone-active-recording-view"
        class="microphone-recording__view microphone-recording__view--active"
        data-microphone-workflow-view="recording"
        hidden
      >
        <p class="microphone-recording__phase-label microphone-recording__phase-label--recording">
          <span aria-hidden="true"></span> Recording
        </p>
        <div class="microphone-recording__recording-copy">
          <h2>Recording…</h2>
          <strong id="microphone-recording-elapsed" class="microphone-recording__elapsed">00:00</strong>
          <p id="microphone-recording-position" class="microphone-recording__phase-position">
            From Bar 1 · Beat 1
          </p>
        </div>
        <button
          id="microphone-stop-button"
          class="button microphone-recording__stop-action"
          type="button"
          disabled
        >
          <span aria-hidden="true"></span>
          Stop recording
        </button>
      </div>

      <div
        id="microphone-processing-view"
        class="microphone-recording__view microphone-recording__view--processing"
        data-microphone-workflow-view="processing"
        hidden
      >
        <p class="microphone-recording__phase-label">Processing</p>
        <span class="microphone-recording__processing-spinner" aria-hidden="true"></span>
        <div class="microphone-recording__copy">
          <h2>Finishing take…</h2>
          <p>Saving a recoverable draft</p>
        </div>
        <button
          class="button microphone-recording__stop-action"
          type="button"
          disabled
        >
          <span aria-hidden="true"></span>
          Stop recording
        </button>
        <p class="microphone-recording__processing-hint">You can review this take next.</p>
      </div>

      <!--
        Compatibility presentation retained for stopped-take review states.
        Tasks 4-6 replace this with the approved meter and review experiences.
      -->
      <div
        id="microphone-legacy-view"
        class="microphone-recording__view microphone-recording__view--legacy"
        data-microphone-workflow-view="legacy"
        hidden
      >
        <div class="microphone-recording__details">
          <p class="eyebrow">Microphone Take</p>
          <h2>Record against the project timeline</h2>
          <p class="microphone-recording__hint">
            For the cleanest recording, use wired headphones so project playback stays out of the microphone.
          </p>
        </div>

        <div
          class="microphone-recording__alignment"
          aria-labelledby="microphone-alignment-heading"
        >
          <div class="microphone-recording__alignment-header">
            <strong id="microphone-alignment-heading">Recording alignment</strong>
            <span id="microphone-alignment-value">0 ms</span>
          </div>
          <p class="microphone-recording__alignment-hint">
            Nudge a reviewed take earlier or later. Small and coarse steps use the same saved local compensation.
          </p>
          <div class="microphone-recording__alignment-actions">
            <span class="microphone-recording__alignment-label">Earlier</span>
            <button id="microphone-alignment-earlier-100" class="button button--secondary" type="button">100 ms</button>
            <button id="microphone-alignment-earlier-10" class="button button--secondary" type="button">10 ms</button>
            <button id="microphone-alignment-earlier-1" class="button button--secondary" type="button">1 ms</button>
            <button id="microphone-alignment-reset" class="button button--secondary" type="button">Reset</button>
            <span class="microphone-recording__alignment-label">Later</span>
            <button id="microphone-alignment-later-1" class="button button--secondary" type="button">1 ms</button>
            <button id="microphone-alignment-later-10" class="button button--secondary" type="button">10 ms</button>
            <button id="microphone-alignment-later-100" class="button button--secondary" type="button">100 ms</button>
          </div>
        </div>

        <div class="microphone-recording__actions">
          <button
            id="microphone-audition-button"
            class="button"
            type="button"
            disabled
            hidden
          >
            Audition Take
          </button>
          <button
            id="microphone-retry-button"
            class="button button--secondary"
            type="button"
            disabled
            hidden
          >
            Retry
          </button>
          <input
            id="microphone-take-name-input"
            class="input microphone-recording__take-name"
            type="text"
            aria-label="Recorded take track name"
            maxlength="120"
            value=""
            disabled
            hidden
          />
          <button
            id="microphone-keep-button"
            class="button"
            type="button"
            disabled
            hidden
          >
            Keep Take
          </button>
          <button
            id="microphone-discard-button"
            class="button button--danger"
            type="button"
            disabled
            hidden
          >
            Discard
          </button>
        </div>
      </div>

      <p
        id="microphone-recording-status"
        class="visually-hidden"
        aria-live="polite"
      >
        Open the recording workflow to prepare a take.
      </p>
    </section>
  `;
}
