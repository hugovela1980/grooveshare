export function renderProjectInvitationPanel({
  hidden = false,
}: { hidden?: boolean } = {}): string {
  return /*html*/ `
    <div
      id="project-invitation-panel"
      class="modal collaboration-link-modal"
      data-project-invitation-panel
      ${hidden ? "hidden" : ""}
    >
      <section
        class="modal__content collaboration-link-modal__content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-invitation-modal-heading"
        aria-describedby="project-invitation-modal-description"
      >
        <header class="modal__header collaboration-link-modal__header">
          <div>
            <p class="eyebrow">Project sharing</p>
            <h2 id="project-invitation-modal-heading">Collaboration Link</h2>
            <p id="project-invitation-modal-description" class="help-text">
              Create or revoke the reusable link that lets Guests listen to this project.
            </p>
          </div>

          <button
            id="close-project-invitation-button"
            class="icon-button"
            type="button"
            aria-label="Close Collaboration Link"
          >
            ×
          </button>
        </header>

        <section class="project-invitation-controls" aria-labelledby="project-invitation-heading">
          <div class="project-invitation-controls__heading">
            <h3 id="project-invitation-heading">Guest Listening Link</h3>
            <span class="project-invitation-controls__badge">Guest listening</span>
          </div>

          <p class="help-text project-invitation-controls__warning">
            Anyone possessing the active link can open this project and listen as a Guest. Guests cannot edit the project or upload tracks.
          </p>

          <input
            id="project-invitation-link"
            class="project-invitation-controls__link"
            type="text"
            readonly
            hidden
            aria-label="Collaboration invitation link"
          />

          <div class="project-invitation-controls__actions">
            <button id="generate-project-invitation-button" class="button" type="button">
              Generate Link
            </button>
            <button id="copy-project-invitation-button" class="button project-invitation-controls__secondary-action" type="button" hidden>
              Copy Link
            </button>
            <button id="regenerate-project-invitation-button" class="button project-invitation-controls__secondary-action" type="button" hidden>
              Regenerate Link
            </button>
            <button id="disable-project-invitation-button" class="button button--danger" type="button" hidden>
              Disable Guest Access
            </button>
          </div>

          <p
            id="project-invitation-status"
            class="status-message project-invitation-controls__status"
            aria-live="polite"
          ></p>
        </section>
      </section>
    </div>
  `;
}
