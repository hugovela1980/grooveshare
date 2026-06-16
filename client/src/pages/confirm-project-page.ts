export function renderConfirmProjectPage(): string {
  return /*html*/ `
    <main class="app-shell" data-page="confirm-project">
      <header class="page-header">
        <p class="eyebrow">Project Created</p>
        <h1>Confirm Project</h1>
        <p class="description">
          Review the project details, then return to the Project Menu.
        </p>
      </header>

      <section class="panel" id="confirm-project">
        <h2>Project details</h2>
        <div id="confirm-project-details">
          <p class="empty-state">Project confirmation details will appear here.</p>
        </div>

        <button id="confirm-project-button" type="button">Submit</button>
      </section>
    </main>
  `;
}