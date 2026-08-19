# @hugovela/frontend-browser

`frontend-browser` contains browser-specific adapters shared by GrooveShare's desktop/tablet and phone web presentations.

It is intentionally separate from `frontend-core`: application meaning stays in the core while browser mechanics live here.

Current responsibilities include:

- `fetch` transport with cookie credentials and 401/session-expiration notification;
- browser `FormData` construction for track uploads;
- `localStorage` adaptation to `StorageProvider`;
- `sessionStorage` persistence for collaboration invitation sessions;
- browser invitation-link URL construction and clipboard copying;
- browser hash/history routing;
- construction of the shared frontend service bundle;
- the shared browser application shell that connects browser history/page lifecycle to `GrooveShareApplicationController`.

The browser application shell receives presentation callbacks rather than rendering HTML. Markup, CSS, DOM page controllers, editing interactions, navigation controls, and device-specific layouts remain in `client/` and `mobile-client/`.

Dependency direction remains:

```text
frontend-core
    ↑
frontend-browser
    ↑            ↑
 client      mobile-client
```

`frontend-browser` must not import either presentation client.
