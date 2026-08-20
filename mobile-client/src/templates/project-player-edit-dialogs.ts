export function renderProjectEditDialog(): string {
  return /*html*/ `
    <div id="project-edit-modal" class="modal" hidden>
      <div
        class="modal__content project-player-edit-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-edit-dialog-title"
      >
        <div class="modal__header">
          <div>
            <p class="eyebrow">Project Actions</p>
            <h2 id="project-edit-dialog-title">Edit Project</h2>
          </div>

          <button
            id="close-project-edit-button"
            class="icon-button"
            type="button"
            aria-label="Close project editor"
          >
            ×
          </button>
        </div>

        <form id="project-edit-form" class="project-player-edit-form">
          <label class="project-player-edit-form__field">
            <span>Project title</span>
            <input
              id="project-edit-title-input"
              type="text"
              required
              autocomplete="off"
              enterkeyhint="next"
            />
          </label>

          <label class="project-player-edit-form__field">
            <span>Description</span>
            <textarea
              id="project-edit-description-input"
              rows="5"
              enterkeyhint="enter"
            ></textarea>
          </label>

          <p
            id="project-edit-status"
            class="status-message"
            aria-live="polite"
          ></p>

          <div class="modal__actions">
            <button
              id="cancel-project-edit-button"
              class="button button--secondary-light"
              type="button"
            >
              Cancel
            </button>

            <button
              id="save-project-edit-button"
              class="button"
              type="submit"
            >
              Save Project
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function renderTrackEditDialog(): string {
  return /*html*/ `
    <div id="track-edit-modal" class="modal" hidden>
      <div
        class="modal__content project-player-edit-dialog project-player-edit-dialog--track"
        role="dialog"
        aria-modal="true"
        aria-labelledby="track-edit-dialog-title"
      >
        <div class="modal__header">
          <div>
            <p class="eyebrow">Track Actions</p>
            <h2 id="track-edit-dialog-title">Edit Track</h2>
          </div>

          <button
            id="close-track-edit-button"
            class="icon-button"
            type="button"
            aria-label="Close track editor"
          >
            ×
          </button>
        </div>

        <form id="track-edit-form" class="project-player-edit-form">
          <label class="project-player-edit-form__field">
            <span>Track name</span>
            <input
              id="track-edit-name-input"
              type="text"
              required
              autocomplete="off"
              enterkeyhint="done"
            />
          </label>

          <div class="project-player-edit-form__timing-grid">
            <label class="project-player-edit-form__field">
              <span>Start bar</span>
              <input id="track-edit-start-bar-input" type="number" min="1" step="1" required inputmode="numeric" />
            </label>

            <label class="project-player-edit-form__field">
              <span>Start beat</span>
              <input id="track-edit-start-beat-input" type="number" min="1" step="any" required inputmode="decimal" />
            </label>
          </div>

          <label class="project-player-edit-form__field">
            <span>Musical length (bars, optional)</span>
            <input id="track-edit-length-bars-input" type="number" min="0" step="any" inputmode="decimal" placeholder="Unknown" />
          </label>

          <p class="description project-player-edit-form__hint">Musical placement is separate from the raw audio-file duration.</p>

          <p
            id="track-edit-status"
            class="status-message"
            aria-live="polite"
          ></p>

          <div class="modal__actions">
            <button
              id="cancel-track-edit-button"
              class="button button--secondary-light"
              type="button"
            >
              Cancel
            </button>

            <button
              id="save-track-edit-button"
              class="button"
              type="submit"
            >
              Save Track
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}
