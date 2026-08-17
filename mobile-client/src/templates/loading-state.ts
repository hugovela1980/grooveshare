function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type LoadingStateOptions = {
  compact?: boolean;
  className?: string;
};

export function renderLoadingState(
  message: string,
  {
    compact = false,
    className = "",
  }: LoadingStateOptions = {},
): string {
  const classes = [
    "loading-state",
    compact ? "loading-state--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return /*html*/ `
    <div class="${classes}" role="status" aria-live="polite">
      <span class="loading-state__spinner" aria-hidden="true"></span>
      <span class="loading-state__message">${escapeHtml(message)}</span>
    </div>
  `;
}

export function renderAppLoadingState(message: string): string {
  return /*html*/ `
    <main class="app-shell app-loading-page" data-page="loading">
      ${renderLoadingState(message, {
        className: "app-loading-page__state",
      })}
    </main>
  `;
}
