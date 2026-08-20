import { normalizeMusicalTimeline } from "@hugovela/frontend-core";
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
  const musicalTimeline = normalizeMusicalTimeline(projectDraft?.musicalTimeline);
  const bpm = String(musicalTimeline.bpm);
  const numerator = String(musicalTimeline.timeSignature.numerator);
  const denominator = musicalTimeline.timeSignature.denominator;
  const denominatorOption = (value: number) =>
    `<option value="${value}"${denominator === value ? " selected" : ""}>${value}</option>`;

  return /*html*/ `
    <main class="app-shell create-project-page" data-page="create-project">
      <header class="page-header create-project-header">
        <button id="back-to-menu-button" type="button">Back</button>

        <div>
          <p class="eyebrow">New Project</p>
          <h1>Create Project</h1>
          <p class="description">
            Start a new GrooveShare project and choose any tracks you want
            to include.
          </p>
        </div>
      </header>

      <section class="panel create-project-panel">
        <form id="project-form" class="project-form create-project-form">
          <section class="create-project-form__section">
            <h2>Project details</h2>

            <label>
              <span>Project title</span>
              <input
                id="project-title"
                name="title"
                type="text"
                placeholder="Chorus Riff Idea"
                value="${title}"
                required
              />
            </label>

            <label>
              <span>Description</span>
              <textarea
                id="project-description"
                name="description"
                rows="4"
                placeholder="Guitar riff with scratch drums"
              >${description}</textarea>
            </label>
          </section>

          <section class="create-project-form__section project-musical-timeline-section">
            <div class="create-project-section-heading">
              <h2>Musical timeline</h2>
              <p>Bar 1, beat 1 begins at the start of the project.</p>
            </div>

            <label>
              <span>Tempo (BPM)</span>
              <input
                id="project-bpm"
                name="bpm"
                type="number"
                min="1"
                max="999"
                step="0.01"
                value="${bpm}"
                required
              />
            </label>

            <div class="project-time-signature-fields">
              <label>
                <span>Beats per bar</span>
                <input
                  id="project-time-signature-numerator"
                  name="timeSignatureNumerator"
                  type="number"
                  min="1"
                  max="32"
                  step="1"
                  value="${numerator}"
                  required
                />
              </label>

              <label>
                <span>Beat unit</span>
                <select
                  id="project-time-signature-denominator"
                  name="timeSignatureDenominator"
                  required
                >
                  ${denominatorOption(1)}
                  ${denominatorOption(2)}
                  ${denominatorOption(4)}
                  ${denominatorOption(8)}
                  ${denominatorOption(16)}
                  ${denominatorOption(32)}
                </select>
              </label>
            </div>
          </section>

          <section class="create-project-form__section">
            <div class="add-audio-tracks-header">
              <div>
                <h2>Add Audio Tracks</h2>
                <p class="description">
                  Add up to four audio tracks before creating the project.
                </p>
              </div>

              <button
                id="add-audio-tracks-button"
                class="icon-button"
                type="button"
                aria-label="Add audio tracks"
              >
                +
              </button>

              <input
                id="pending-audio-files"
                name="audioFiles"
                type="file"
                accept="audio/*"
                multiple
                hidden
              />
            </div>

            <section
              id="tracks-to-include-section"
              class="tracks-to-include-section"
              hidden
            >
              <h3>Tracks to Include</h3>

              <div id="pending-track-list"></div>
            </section>
          </section>

          <div class="create-project-actions">
            <button type="submit">Create a New Project</button>
          </div>

          <p id="project-status" class="status-message" aria-live="polite"></p>
        </form>
      </section>

      <div id="create-project-confirmation-modal" class="modal" hidden>
        <section
          class="modal__content create-project-confirmation-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-project-confirmation-title"
        >
          <header class="modal__header">
            <div>
              <p class="eyebrow">Review Project</p>
              <h2 id="create-project-confirmation-title">Confirm Project</h2>
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

                <div>
                  <dt>Musical timeline</dt>
                  <dd id="create-project-confirmation-musical-timeline"></dd>
                </div>
              </dl>
            </section>

            <section class="create-project-confirmation-modal__section">
              <h3>Tracks</h3>
              <div id="create-project-confirmation-track-list"></div>
            </section>
          </div>

          <div class="modal__actions">
            <button
              id="edit-create-project-button"
              class="button button--secondary-light"
              type="button"
            >
              Edit
            </button>

            <button
              id="submit-create-project-button"
              class="button"
              type="button"
            >
              Submit
            </button>
          </div>

          <p
            id="create-project-confirmation-status"
            class="status-message"
            aria-live="polite"
          ></p>
        </section>
      </div>
    </main>
  `;
}