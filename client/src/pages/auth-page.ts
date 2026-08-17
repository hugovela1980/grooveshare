type AuthPageOptions = {
  message?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderAuthPage({
  message = "",
}: AuthPageOptions = {}): string {
  return /*html*/ `
    <main class="auth-page" data-page="auth">
      <header class="auth-page__hero">
        <h1 class="auth-page__title">Grooveshare</h1>
        <p class="auth-page__tagline">Share tracks. Build songs together.</p>
      </header>

      <div class="auth-page__forms">
        <section class="panel auth-card" aria-labelledby="login-heading">
          <h2 id="login-heading">Log in</h2>
          <p class="auth-card__intro">
            Sign in to open your projects and collaboration tools.
          </p>

          <form id="login-form" class="auth-form">
            <label>
              Email
              <input
                id="login-email"
                type="email"
                autocomplete="email"
                required
              />
            </label>

            <label>
              Password
              <input
                id="login-password"
                type="password"
                autocomplete="current-password"
                maxlength="128"
                required
              />
            </label>

            <button id="login-submit-button" type="submit">Log In</button>
          </form>
        </section>

        <section class="panel auth-card" aria-labelledby="register-heading">
          <h2 id="register-heading">Create an account</h2>
          <p class="auth-card__intro">
            Create an account to create projects and collaborate with other musicians.
          </p>

          <form id="register-form" class="auth-form">
            <label>
              Display name
              <input
                id="register-display-name"
                type="text"
                autocomplete="name"
                required
              />
            </label>

            <label>
              Email
              <input
                id="register-email"
                type="email"
                autocomplete="email"
                required
              />
            </label>

            <label>
              Password
              <input
                id="register-password"
                type="password"
                autocomplete="new-password"
                minlength="15"
                maxlength="128"
                required
              />
            </label>

            <p class="auth-form__hint">
              Passwords must be at least 15 characters.
            </p>

            <button id="register-submit-button" type="submit">Create Account</button>
          </form>
        </section>
      </div>

      <p
        id="auth-status"
        class="status-message auth-page__status"
        aria-live="polite"
      >${escapeHtml(message)}</p>
    </main>
  `;
}
