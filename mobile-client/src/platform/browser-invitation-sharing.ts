export function buildBrowserInvitationShareLink(token: string): string {
  if (typeof window === "undefined") {
    return `#invite/${encodeURIComponent(token)}`;
  }

  const url = new URL(window.location.href);
  url.hash = `invite/${encodeURIComponent(token)}`;
  return url.toString();
}

export async function copyBrowserText(value: string): Promise<void> {
  const clipboard = globalThis.navigator?.clipboard;

  if (!clipboard?.writeText) {
    throw new Error("Clipboard access is not available.");
  }

  await clipboard.writeText(value);
}
