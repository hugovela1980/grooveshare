# @hugovela/frontend-core

`frontend-core` is the presentation-independent frontend boundary shared by GrooveShare presentation clients.

## Current shared responsibilities

The package owns behavior and contracts that have a clear reason to mean the same thing in every presentation:

- shared project, track, user, membership, invitation-access, invitation-session, and mix domain types;
- project permission rules;
- `SessionProvider` and `StorageProvider` platform contracts;
- `PlaybackEngine` and shared Web Audio playback;
- Viewer, pending, and Guest mix persistence behavior;
- shared application state, route/action, and presentation-port contracts;
- shared API/service contracts for authentication, projects, tracks, memberships, and invitations;
- shared API response/error handling and service-level request behavior.

The package deliberately does **not** own DOM rendering, CSS, dialogs, touch behavior, browser `fetch`, `File`, `FormData`, browser storage globals, browser history, URLs, or clipboard access.

## Version 2.2 application-layer direction

### Stage 1 — application contracts

Stage 1 established the vocabulary between application behavior and presentation: shared state, routes/actions, and `ApplicationPresentationPort` implementations supplied by desktop and mobile.

### Stage 2 — shared services and browser adapters

Stage 2 consolidates the service behavior that desktop and mobile had proven to be identical:

- authentication;
- projects and mix settings;
- tracks and Guest audio loading;
- project membership;
- invitation management and Guest resolution/acceptance.

Those services depend only on `ApiTransport` and, for browser file uploads, the abstract `MultipartBodyFactory` port. They do not call `fetch` or construct `FormData` themselves.

Guest mix key remapping and invitation-session validation are also shared here because their meaning is platform-independent.

The browser implementations now live in the separate `@hugovela/frontend-browser` adapter package. Both desktop and mobile use that same browser package while preserving their separate presentation code.

The major application workflow/state machines still remain in `client/src/app.ts` and `mobile-client/src/app.ts` at the end of Stage 2. Later Version 2.2 stages will move those workflows behind the contracts established here.

## Dependency direction

```text
frontend-core
    ↑
frontend-browser
    ↑            ↑
 client      mobile-client
```

`frontend-core` knows nothing about either client or the browser package. `frontend-browser` implements browser-specific ports using `frontend-core`. Desktop and mobile can then share browser infrastructure without becoming dependent on one another.
