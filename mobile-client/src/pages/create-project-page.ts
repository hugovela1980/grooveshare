import { renderMobileNavigation } from "../templates/mobile-navigation.js";
import {
  formatFileSize,
  MAX_MOBILE_AUDIO_FILE_SIZE_BYTES,
  MOBILE_AUDIO_FILE_ACCEPT,
} from "../uploads/mobile-audio-files.js";
import type { CreateProjectInput } from "../types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderCreateProjectPage(
  projectDraft: CreateProjectInput | null = null,
): string {
  const title = escapeHtml(projectDraft?.title ?? "");
  const description = escapeHtml(projectDraft?.description ?? "");

  return /*html*/ `
    <main class="app-shell create-project-page" data-page="create-project">
      <header class="create-project-header">
        <button
          id="back-to-menu-button"
          class="button button--secondary create-project-header__back"
          type="button"
          aria-label="Back to projects"
        >
          <span aria-hidden="true">‹</span>
        </button>

        <div class="create-project-header__heading">
          <p class="eyebrow">New Project</p>
          <h1>Create Project</h1>
        </div>

        <span class="create-project-header__spacer" aria-hidden="true"></span>
      </header>

      <section class="panel create-project-panel">
        <form id="project-form" class="project-form create-project-form">
          <section class="create-project-form__section">
            <div class="create-project-section-heading">
              <h2>Project details</h2>
              <p>Give this idea a name. You can edit these details later.</p>
            </div>

            <label>
              <span>Project title</span>
              <input
                id="project-title"
                name="title"
                type="text"
                autocomplete="off"
                enterkeyhint="next"
                placeholder="Chorus Riff Idea"
                value="${title}"
                required
              />
            </label>

            <label>
              <span>Description <span class="form-optional">(optional)</span></span>
              <textarea
                id="project-description"
                name="description"
                rows="4"
                enterkeyhint="done"
                placeholder="Guitar riff with scratch drums"
              >${description}</textarea>
            </label>
          </section>

          <section class="create-project-form__section create-project-audio-section">
            <div class="create-project-section-heading">
              <h2>Audio tracks</h2>
              <p>
                Add up to four tracks now, or create the project first and add tracks later.
              </p>
            </div>

            <button
              id="add-audio-tracks-button"
              class="button button--secondary create-project-add-tracks-button"
              type="button"
            >
              <span aria-hidden="true">＋</span>
              Choose Audio Files
            </button>

            <p class="create-project-audio-help">
              WAV, MP3, M4A, AAC, OGG, WebM, or FLAC. Maximum ${formatFileSize(MAX_MOBILE_AUDIO_FILE_SIZE_BYTES)} per file.
            </p>

            <input
              id="pending-audio-files"
              name="audioFiles"
              type="file"
              accept="${MOBILE_AUDIO_FILE_ACCEPT}"
              multiple
              hidden
            />

            <section
              id="tracks-to-include-section"
              class="tracks-to-include-section"
              aria-labelledby="tracks-to-include-heading"
              hidden
            >
              <h3 id="tracks-to-include-heading">Tracks to Include</h3>
              <div id="pending-track-list"></div>
            </section>
          </section>

          <p id="project-status" class="status-message" aria-live="polite"></p>

          <div class="create-project-actions">
            <button id="review-create-project-button" type="submit">
              Review Project
            </button>
          </div>
        </form>
      </section>

      ${renderMobileNavigation()}

      <div id="create-project-confirmation-modal" class="modal" hidden>
        <section
          class="modal__content create-project-confirmation-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-project-confirmation-title"
          aria-describedby="create-project-confirmation-description"
        >
          <header class="modal__header">
            <div>
              <p class="eyebrow">Review Project</p>
              <h2 id="create-project-confirmation-title">Ready to create?</h2>
              <p id="create-project-confirmation-description" class="help-text">
                Check the project details and selected tracks before submitting.
              </p>
            </div>

            <button
              id="close-create-project-confirmation-button"
              class="icon-button"
              type="button"
              aria-label="Close confirmation"
            >
              ×
            </button>
          </header>

          <div class="create-project-confirmation-modal__body">
            <section class="create-project-confirmation-modal__section">
              <h3>Project details</h3>

              <dl class="create-project-confirmation-summary">
                <div>
                  <dt>Title</dt>
                  <dd id="create-project-confirmation-project-title"></dd>
                </div>

                <div>
                  <dt>Description</dt>
                  <dd id="create-project-confirmation-project-description"></dd>
                </div>
              </dl>
            </section>

            <section class="create-project-confirmation-modal__section">
              <h3>Tracks</h3>
              <div id="create-project-confirmation-track-list"></div>
            </section>
          </div>

          <p
            id="create-project-confirmation-status"
            class="status-message create-project-confirmation-status"
            aria-live="polite"
          ></p>

          <div class="modal__actions">
            <button
              id="edit-create-project-button"
              class="button button--secondary-light"
              type="button"
            >
              Keep Editing
            </button>

            <button
              id="submit-create-project-button"
              class="button"
              type="button"
            >
              Create Project
            </button>
          </div>
        </section>
      </div>
    </main>
  `;
}
