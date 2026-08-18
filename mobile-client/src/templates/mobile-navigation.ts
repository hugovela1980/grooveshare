export type MobileNavigationItem = "home" | "library" | "settings" | "logout";

type MobileNavigationOptions = {
  activeItem?: Exclude<MobileNavigationItem, "logout"> | null;
  mode?: "authenticated" | "guest";
};

function renderHomeIcon(): string {
  return /*html*/ `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10.5V20h13v-9.5" />
      <path d="M9.5 20v-5.5h5V20" />
    </svg>
  `;
}

function renderLibraryIcon(): string {
  return /*html*/ `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.5 6.5h6l1.5 2h9.5V19h-17z" />
    </svg>
  `;
}

function renderSettingsIcon(): string {
  return /*html*/ `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2M12 19.2v2M21.2 12h-2M4.8 12h-2M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4M18.5 18.5l-1.4-1.4M6.9 6.9 5.5 5.5" />
    </svg>
  `;
}

function renderLogoutIcon(): string {
  return /*html*/ `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M10 4H4v16h6" />
      <path d="M13 8l4 4-4 4" />
      <path d="M8 12h9" />
    </svg>
  `;
}

function getActiveAttribute(
  activeItem: MobileNavigationOptions["activeItem"],
  item: Exclude<MobileNavigationItem, "logout">,
): string {
  return activeItem === item ? ' aria-current="page"' : "";
}

export function renderMobileNavigation({
  activeItem = null,
  mode = "authenticated",
}: MobileNavigationOptions = {}): string {
  const homeIsActive = activeItem === "home";
  const isGuest = mode === "guest";

  return /*html*/ `
    <nav class="mobile-navigation" aria-label="GrooveShare navigation">
      <button
        id="mobile-nav-home-button"
        class="mobile-navigation__item"
        type="button"
        ${homeIsActive ? "disabled" : ""}
        ${getActiveAttribute(activeItem, "home")}
      >
        <span class="mobile-navigation__icon">${renderHomeIcon()}</span>
        <span class="mobile-navigation__label">Home</span>
      </button>

      <button
        id="mobile-nav-library-button"
        class="mobile-navigation__item"
        type="button"
        disabled
        aria-disabled="true"
        title="Library is planned for a later GrooveShare version"
      >
        <span class="mobile-navigation__icon">${renderLibraryIcon()}</span>
        <span class="mobile-navigation__label">Library</span>
      </button>

      <button
        id="mobile-nav-settings-button"
        class="mobile-navigation__item"
        type="button"
        disabled
        aria-disabled="true"
        title="Settings are planned for a later GrooveShare version"
      >
        <span class="mobile-navigation__icon">${renderSettingsIcon()}</span>
        <span class="mobile-navigation__label">Settings</span>
      </button>

      <button
        id="${isGuest ? "mobile-nav-auth-button" : "mobile-nav-logout-button"}"
        class="mobile-navigation__item"
        type="button"
      >
        <span class="mobile-navigation__icon">${renderLogoutIcon()}</span>
        <span class="mobile-navigation__label">${isGuest ? "Log In" : "Log Out"}</span>
      </button>
    </nav>
  `;
}
