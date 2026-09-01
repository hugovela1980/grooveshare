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
        id="microphone-recovery-view"
        class="microphone-recording__view microphone-recording__view--failure"
        data-microphone-workflow-view="recovery"
        hidden
      >
        ${renderCloseButton("microphone-recovery-close-button", "Close recording recovery")}

        <div class="microphone-recording__hero" aria-hidden="true">
          <span class="microphone-recording__failure-ring">
            ${renderMicrophoneIcon()}
            <span class="microphone-recording__warning">!</span>
          </span>
        </div>

        <div class="microphone-recording__copy">
          <h2 id="microphone-recovery-heading">Recording draft unavailable</h2>
          <p id="microphone-recovery-message">The unfinished take could not be recovered safely.</p>
        </div>

        <button
          id="microphone-recovery-retry-button"
          class="button microphone-recording__primary-action"
          type="button"
        >
          Try recovery again
        </button>
        <button
          id="microphone-recovery-cancel-button"
          class="button button--secondary microphone-recording__secondary-action"
          type="button"
        >
          Close
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

      <div
        id="microphone-review-view"
        class="microphone-recording__view microphone-recording__view--review"
        data-microphone-workflow-view="review"
        hidden
      >
        ${renderCloseButton("microphone-review-close-button", "Close take review")}

        <div class="microphone-recording__review-card">
          <div class="microphone-recording__review-heading">
            <div>
              <h2 id="microphone-review-heading" tabindex="-1">Take ready</h2>
              <span
                id="microphone-review-recovered"
                class="microphone-recording__recovered-badge"
                role="status"
                aria-live="polite"
                hidden
              >Draft recovered</span>
            </div>
            <p id="microphone-review-position">Bar 1 · Beat 1</p>
          </div>

          <div
            id="microphone-review-timeline"
            class="microphone-recording__review-timeline"
            role="img"
            aria-label="Recorded take duration 00:00"
          >
            <span>Take length</span>
            <strong id="microphone-review-duration">00:00</strong>
            <span class="microphone-recording__review-timeline-rail" aria-hidden="true"></span>
          </div>

          <div class="microphone-recording__review-actions">
            <button
              id="microphone-retry-button"
              class="button button--secondary microphone-recording__review-action"
              type="button"
              disabled
              hidden
            >
              Retry
            </button>
            <button
              id="microphone-audition-button"
              class="button microphone-recording__review-action microphone-recording__review-action--primary"
              type="button"
              aria-pressed="false"
              disabled
              hidden
            >
              Audition
            </button>
            <button
              id="microphone-keep-button"
              class="button button--secondary microphone-recording__review-action"
              type="button"
              disabled
              hidden
            >
              Keep
            </button>
            <button
              id="microphone-discard-button"
              class="button microphone-recording__review-action microphone-recording__review-action--discard"
              type="button"
              aria-label="Discard Take"
              disabled
              hidden
            >
              Discard
            </button>
          </div>

          <label class="microphone-recording__audition-volume" for="microphone-audition-volume">
            <span>Audition volume</span>
            <output id="microphone-audition-volume-value" for="microphone-audition-volume">100%</output>
            <input
              id="microphone-audition-volume"
              type="range"
              min="0"
              max="100"
              step="1"
              value="100"
              disabled
            />
          </label>
        </div>

        <div class="microphone-recording__review-tabs">
          <div class="microphone-recording__tab-list" role="tablist" aria-label="Take review settings">
            <button
              id="microphone-alignment-tab"
              class="microphone-recording__tab"
              type="button"
              role="tab"
              aria-selected="true"
              aria-controls="microphone-alignment-panel"
            >
              Synchronize
            </button>
            <button
              id="microphone-playback-mix-tab"
              class="microphone-recording__tab"
              type="button"
              role="tab"
              aria-selected="false"
              aria-controls="microphone-playback-mix-panel"
              tabindex="-1"
            >
              Mix
            </button>
          </div>

          <div
            id="microphone-alignment-panel"
            class="microphone-recording__review-tab-panel"
            role="tabpanel"
            aria-labelledby="microphone-alignment-tab"
          >
            <div
              class="microphone-recording__alignment"
              aria-label="Recording alignment controls"
            >
              <p id="microphone-alignment-summary" class="microphone-recording__alignment-summary">Offset: 0 ms</p>
              <p class="microphone-recording__alignment-instruction">
                Sync your recording to playback in milliseconds
              </p>
              <div class="microphone-recording__alignment-direction" aria-hidden="true">
                <span class="microphone-recording__alignment-direction--earlier">← Move earlier</span>
                <span class="microphone-recording__alignment-direction--later">Move later →</span>
              </div>
              <div class="microphone-recording__alignment-actions">
                <button id="microphone-alignment-earlier-100" class="button button--secondary" type="button" aria-label="Move recording 100 milliseconds earlier">-100</button>
                <button id="microphone-alignment-earlier-10" class="button button--secondary" type="button" aria-label="Move recording 10 milliseconds earlier">-10</button>
                <button id="microphone-alignment-earlier-1" class="button button--secondary" type="button" aria-label="Move recording 1 millisecond earlier">-1</button>
                <button id="microphone-alignment-reset" class="button button--secondary" type="button" aria-label="Reset recording alignment to zero milliseconds">Reset</button>
                <button id="microphone-alignment-later-1" class="button button--secondary" type="button" aria-label="Move recording 1 millisecond later">+1</button>
                <button id="microphone-alignment-later-10" class="button button--secondary" type="button" aria-label="Move recording 10 milliseconds later">+10</button>
                <button id="microphone-alignment-later-100" class="button button--secondary" type="button" aria-label="Move recording 100 milliseconds later">+100</button>
              </div>
            </div>
          </div>

          <div
            id="microphone-playback-mix-panel"
            class="microphone-recording__review-tab-panel microphone-recording__review-tab-panel--mix"
            role="tabpanel"
            aria-labelledby="microphone-playback-mix-tab"
            hidden
          >
            <div
              id="microphone-review-mix-track-list"
              class="microphone-recording__review-mix-track-list"
              role="region"
              aria-label="Review playback mix tracks"
              tabindex="0"
            ></div>
          </div>
        </div>

        <p id="microphone-review-status" class="microphone-recording__review-status" role="status" aria-live="polite"></p>

      </div>

      <dialog
        id="microphone-keep-dialog"
        class="microphone-recording__confirmation-dialog"
        aria-labelledby="microphone-keep-heading"
      >
        <h2 id="microphone-keep-heading">Keep this take?</h2>
        <label for="microphone-take-name-input">Track name</label>
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
        <p id="microphone-keep-metadata" class="microphone-recording__confirmation-metadata"></p>
        <p id="microphone-keep-status" class="microphone-recording__confirmation-status" role="status" aria-live="polite"></p>
        <div class="microphone-recording__confirmation-actions">
          <button id="microphone-keep-cancel" class="button button--secondary" type="button">Cancel</button>
          <button id="microphone-keep-confirm" class="button" type="button">Keep track</button>
        </div>
      </dialog>

      <dialog
        id="microphone-discard-dialog"
        class="microphone-recording__confirmation-dialog"
        aria-labelledby="microphone-discard-heading"
      >
        <p class="microphone-recording__phase-label microphone-recording__phase-label--danger">Discard take</p>
        <h2 id="microphone-discard-heading">Discard this take?</h2>
        <p>This permanently removes the recoverable draft.</p>
        <p id="microphone-discard-status" class="microphone-recording__confirmation-status" role="status" aria-live="polite"></p>
        <div class="microphone-recording__confirmation-actions">
          <button id="microphone-discard-cancel" class="button button--secondary" type="button">Cancel</button>
          <button id="microphone-discard-confirm" class="button button--danger" type="button">Discard take</button>
        </div>
      </dialog>

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
