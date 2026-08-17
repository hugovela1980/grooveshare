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
        <p class="eyebrow">Music collaboration</p>
        <h1 class="auth-page__title">GrooveShare</h1>
        <p class="auth-page__tagline">Share tracks. Build songs together.</p>
      </header>

      <div class="auth-mode-switch" role="tablist" aria-label="Account access">
        <button
          id="show-login-button"
          class="auth-mode-switch__button"
          type="button"
          role="tab"
          aria-selected="true"
          aria-controls="login-card"
        >
          Log In
        </button>
        <button
          id="show-register-button"
          class="auth-mode-switch__button"
          type="button"
          role="tab"
          aria-selected="false"
          aria-controls="register-card"
        >
          Create Account
        </button>
      </div>

      <div class="auth-page__forms">
        <section
          id="login-card"
          class="panel auth-card"
          aria-labelledby="login-heading"
        >
          <h2 id="login-heading">Welcome back</h2>
          <p class="auth-card__intro">
            Sign in to open your projects and collaboration tools.
          </p>

          <form id="login-form" class="auth-form">
            <label>
              Email
              <input
                id="login-email"
                type="email"
                inputmode="email"
                autocomplete="email"
                autocapitalize="none"
                spellcheck="false"
                enterkeyhint="next"
                required
              />
            </label>

            <label>
              Password
              <input
                id="login-password"
                type="password"
                autocomplete="current-password"
                enterkeyhint="go"
                maxlength="128"
                required
              />
            </label>

            <button id="login-submit-button" type="submit">Log In</button>
          </form>
        </section>

        <section
          id="register-card"
          class="panel auth-card"
          aria-labelledby="register-heading"
          hidden
        >
          <h2 id="register-heading">Create an account</h2>
          <p class="auth-card__intro">
            Create an account to make projects and collaborate with other musicians.
          </p>

          <form id="register-form" class="auth-form">
            <label>
              Display name
              <input
                id="register-display-name"
                type="text"
                autocomplete="name"
                enterkeyhint="next"
                required
              />
            </label>

            <label>
              Email
              <input
                id="register-email"
                type="email"
                inputmode="email"
                autocomplete="email"
                autocapitalize="none"
                spellcheck="false"
                enterkeyhint="next"
                required
              />
            </label>

            <label>
              Password
              <input
                id="register-password"
                type="password"
                autocomplete="new-password"
                enterkeyhint="done"
                minlength="15"
                maxlength="128"
                required
              />
            </label>

            <p class="auth-form__hint">
              Use at least 15 characters.
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
