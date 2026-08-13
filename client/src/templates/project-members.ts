import type { ProjectMember } from "../types.js";

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
      <li class="project-member-row" data-project-member-row data-user-id="${userId}">
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
        <span class="visually-hidden">Role for ${displayName}</span>
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
      >
        Remove
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

export function renderProjectMembersPanel(): string {
  return /*html*/ `
    <section
      class="panel project-members-panel"
      aria-labelledby="project-members-heading"
      data-project-members-panel
    >
      <div class="project-members-panel__header">
        <div>
          <p class="eyebrow">Owner Controls</p>
          <h2 id="project-members-heading">Project Members</h2>
          <p class="description">
            Add collaborators and choose whether they can only listen or contribute tracks.
          </p>
        </div>
      </div>

      <form id="project-member-form" class="project-member-form">
        <label class="project-member-form__field">
          <span>Email</span>
          <input
            id="project-member-email"
            type="email"
            autocomplete="email"
            required
            placeholder="musician@example.com"
          />
        </label>

        <label class="project-member-form__field">
          <span>Role</span>
          <select id="project-member-role">
            <option value="viewer">Viewer</option>
            <option value="contributor">Contributor</option>
          </select>
        </label>

        <button class="button" type="submit">Add Member</button>
      </form>

      <div id="project-member-list"></div>

      <p
        id="project-member-status"
        class="status-message"
        aria-live="polite"
      ></p>
    </section>
  `;
}
