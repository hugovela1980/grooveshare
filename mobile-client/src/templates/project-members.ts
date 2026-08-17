import type { ProjectMember } from "../types.js";
import { renderLoadingState } from "./loading-state.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMemberRow(member: ProjectMember): string {
  const displayName = escapeHtml(member.user.displayName);
  const email = escapeHtml(member.user.email);
  const userId = escapeHtml(member.user.id);

  if (member.role === "owner") {
    return /*html*/ `
      <li class="project-member-row project-member-row--owner" data-project-member-row data-user-id="${userId}">
        <div class="project-member-row__identity">
          <strong>${displayName}</strong>
          <span>${email}</span>
        </div>

        <span class="project-member-row__role-badge">Owner</span>
      </li>
    `;
  }

  return /*html*/ `
    <li class="project-member-row" data-project-member-row data-user-id="${userId}">
      <div class="project-member-row__identity">
        <strong>${displayName}</strong>
        <span>${email}</span>
      </div>

      <label class="project-member-row__role-control">
        <span>Access</span>
        <select
          data-member-role-select
          data-user-id="${userId}"
          aria-label="Role for ${displayName}"
        >
          <option value="viewer" ${member.role === "viewer" ? "selected" : ""}>Viewer</option>
          <option value="contributor" ${member.role === "contributor" ? "selected" : ""}>Contributor</option>
        </select>
      </label>

      <button
        class="button button--danger project-member-row__remove-button"
        type="button"
        data-member-remove-button
        data-user-id="${userId}"
        data-member-name="${displayName}"
      >
        Remove Member
      </button>
    </li>
  `;
}

export function renderProjectMemberList(
  members: ProjectMember[],
): string {
  if (members.length === 0) {
    return '<p class="empty-state">No project members found.</p>';
  }

  return /*html*/ `
    <ul class="project-member-list">
      ${members.map(renderMemberRow).join("")}
    </ul>
  `;
}

export function renderProjectMembersPanel({
  hidden = false,
}: { hidden?: boolean } = {}): string {
  return /*html*/ `
    <div
      id="project-members-panel"
      class="modal owner-controls-modal"
      data-project-members-panel
      ${hidden ? "hidden" : ""}
    >
      <section
        class="modal__content owner-controls-modal__content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-members-heading"
        aria-describedby="project-members-description"
      >
        <header class="modal__header owner-controls-modal__header">
          <div>
            <p class="eyebrow">Owner Controls</p>
            <h2 id="project-members-heading">Project Members</h2>
            <p id="project-members-description" class="help-text">
              Add collaborators and choose whether they can listen or contribute tracks.
            </p>
          </div>

          <button
            id="close-owner-controls-button"
            class="icon-button"
            type="button"
            aria-label="Close Owner Controls"
          >
            ×
          </button>
        </header>

        <form id="project-member-form" class="project-member-form">
          <label class="project-member-form__field">
            <span>Member email</span>
            <input
              id="project-member-email"
              type="email"
              inputmode="email"
              autocomplete="email"
              autocapitalize="none"
              spellcheck="false"
              enterkeyhint="next"
              required
              placeholder="musician@example.com"
            />
          </label>

          <label class="project-member-form__field">
            <span>Access</span>
            <select id="project-member-role">
              <option value="viewer">Viewer — listen only</option>
              <option value="contributor">Contributor — add and edit own tracks</option>
            </select>
          </label>

          <button id="add-project-member-button" class="button owner-controls-modal__add-button" type="submit">
            Add Member
          </button>
        </form>

        <p
          id="project-member-status"
          class="status-message owner-controls-modal__status"
          aria-live="polite"
        ></p>

        <div id="project-member-list" class="owner-controls-modal__member-list">
          ${renderLoadingState("Loading project members...", { compact: true })}
        </div>
      </section>
    </div>
  `;
}
