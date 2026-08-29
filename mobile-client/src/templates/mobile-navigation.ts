export type MobileNavigationItem = "home" | "people" | "library" | "logout";

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

function renderPeopleIcon(): string {
  return /*html*/ `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="9" cy="8" r="3" />
      <circle cx="16.5" cy="9" r="2.5" />
      <path d="M3.5 20v-1.5A5.5 5.5 0 0 1 9 13h.5a5.5 5.5 0 0 1 5.5 5.5V20M15 14a4.5 4.5 0 0 1 5.5 4.4V20" />
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
        <span class="mobile-navigation__label">Projects</span>
      </button>

      <button
        id="mobile-nav-people-button"
        class="mobile-navigation__item"
        type="button"
        disabled
        aria-disabled="true"
        title="People is planned for a later GrooveShare version"
      >
        <span class="mobile-navigation__icon">${renderPeopleIcon()}</span>
        <span class="mobile-navigation__label">People</span>
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
        id="${isGuest ? "mobile-nav-auth-button" : "mobile-nav-logout-button"}"
        class="mobile-navigation__item"
        type="button"
      >
        <span class="mobile-navigation__icon">${renderLogoutIcon()}</span>
        <span class="mobile-navigation__label">${isGuest ? "Log In" : "Logout"}</span>
      </button>
    </nav>
  `;
}
