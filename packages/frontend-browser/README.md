# @hugovela/frontend-browser

`frontend-browser` contains browser-specific adapters shared by GrooveShare's desktop/tablet and phone web presentations.

It is intentionally separate from `frontend-core` so the core application and service layer does not depend on DOM/browser APIs.

Current adapters include:

- `fetch` transport with cookie credentials and 401/session-expiration notification;
- browser `FormData` construction for track uploads;
- `localStorage` adaptation to `StorageProvider`;
- `sessionStorage` persistence for collaboration invitation sessions;
- browser invitation-link URL construction and clipboard copying;
- construction of the shared frontend service bundle for a browser client.

Presentation markup, CSS, page renderers, and device-specific interaction remain in `client/` and `mobile-client/`.
