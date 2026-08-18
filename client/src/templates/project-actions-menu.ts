export function renderProjectActionsMenu(): string {
  return /*html*/ `
    <div class="project-actions" data-project-actions>
      <button id="project-actions-button" class="project-actions__trigger" type="button" aria-label="Project actions" aria-haspopup="menu" aria-expanded="false" aria-controls="project-actions-menu">
        <span aria-hidden="true">⋮</span>
      </button>
      <div id="project-actions-menu" class="project-actions__menu" role="menu" hidden>
        <button id="manage-members-menu-item" class="project-actions__item" type="button" role="menuitem" aria-controls="project-members-panel" aria-expanded="false">Manage Members</button>
        <button id="collaboration-link-menu-item" class="project-actions__item" type="button" role="menuitem" aria-controls="project-invitation-panel" aria-expanded="false">Collaboration Link</button>
        <div class="project-actions__divider" role="separator"></div>
        <button id="delete-project-button" class="project-actions__item project-actions__item--danger" type="button" role="menuitem">Delete Project</button>
      </div>
    </div>
  `;
}
