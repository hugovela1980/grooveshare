export function renderMicrophoneRecordingControls(): string {
  return /*html*/ `
    <section
      class="panel microphone-recording"
      aria-labelledby="microphone-recording-heading"
    >
      <div class="microphone-recording__details">
        <p class="eyebrow">Microphone Take</p>
        <h2 id="microphone-recording-heading">Record against the project timeline</h2>
        <p class="microphone-recording__hint">
          Recording starts from the current project position while the existing mix plays.
        </p>
      </div>

      <div class="microphone-recording__actions">
        <button
          id="microphone-arm-button"
          class="button button--secondary"
          type="button"
        >
          Enable Microphone
        </button>
        <button
          id="microphone-record-button"
          class="button"
          type="button"
          disabled
        >
          Record
        </button>
        <button
          id="microphone-stop-button"
          class="button button--secondary"
          type="button"
          disabled
        >
          Stop Recording
        </button>
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

      <p
        id="microphone-recording-status"
        class="status-message microphone-recording__status"
        aria-live="polite"
      >
        Enable your microphone to prepare a take.
      </p>
    </section>
  `;
}
