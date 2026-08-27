export function renderMicrophoneRecordingControls(): string {
  return /*html*/ `
    <div
      id="microphone-recording-workspace"
      class="microphone-recording microphone-recording__body"
      aria-labelledby="microphone-recording-heading"
      hidden
    >
      <button id="microphone-close-button" class="icon-button microphone-recording__close" type="button" aria-label="Close recording interface">×</button>
      <div class="microphone-recording__details">
        <h2 id="microphone-recording-heading">Prepare your microphone</h2>
        <p id="microphone-recording-status" class="status-message microphone-recording__status" aria-live="polite">Enable your microphone to prepare a take.</p>
      </div>

      <div class="microphone-recording__actions">
        <button id="microphone-prepare-retry-button" class="button button--secondary" type="button" hidden>Try microphone again</button>
        <button id="microphone-record-button" class="button" type="button" disabled>Record Take</button>
        <button id="microphone-stop-button" class="button microphone-recording__stop" type="button" disabled hidden>Stop Recording</button>
      </div>

      <div id="microphone-take-review" class="microphone-recording__review" hidden>
        <button id="microphone-retry-button" class="button button--secondary" type="button" disabled hidden>Retry</button>
        <div class="microphone-recording__audition">
          <button id="microphone-audition-button" class="button" type="button" disabled hidden>Audition</button>
          <label for="microphone-audition-volume">Audition volume <output id="microphone-audition-volume-value" for="microphone-audition-volume">100%</output></label>
          <input id="microphone-audition-volume" type="range" min="0" max="100" step="1" value="100" disabled />
        </div>
        <button id="microphone-keep-button" class="button microphone-recording__keep" type="button" disabled hidden>Keep</button>
      </div>

      <div
        id="microphone-legacy-alignment"
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

      <button id="microphone-discard-button" class="button button--danger microphone-recording__discard" type="button" disabled hidden>Discard take</button>
      <p id="microphone-recording-hint" class="microphone-recording__hint">For the cleanest recording, use wired headphones so project playback stays out of the microphone.</p>
      <dialog id="microphone-keep-dialog" class="microphone-recording__keep-dialog" aria-labelledby="microphone-keep-heading">
        <h2 id="microphone-keep-heading">Keep this take?</h2>
        <p>Name the track to add it to this project. Its placement and reviewed alignment will be preserved.</p>
        <label for="microphone-take-name-input">Track name</label>
        <input id="microphone-take-name-input" class="input microphone-recording__take-name" type="text" aria-label="Recorded take track name" maxlength="120" value="" autofocus disabled hidden />
        <p id="microphone-keep-status" role="status"></p>
        <div class="microphone-recording__actions">
          <button id="microphone-keep-cancel" class="button button--secondary" type="button">Cancel</button>
          <button id="microphone-keep-confirm" class="button microphone-recording__keep" type="button">Keep Take</button>
        </div>
      </dialog>
    </div>
  `;
}
