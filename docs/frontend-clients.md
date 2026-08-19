# GrooveShare Frontend Architecture

This document records the Version 2.2 shared frontend application boundary.

## Runtime surfaces

| Surface | Workspace/package | Responsibility |
| --- | --- | --- |
| Desktop/laptop/tablet browser | `client/` | Desktop/tablet presentation and interaction |
| Phone browser | `mobile-client/` | Phone/touch presentation and interaction |
| Shared application/domain layer | `packages/frontend-core/` | What GrooveShare means and what the application does |
| Shared browser adapter layer | `packages/frontend-browser/` | Browser transport, storage, history, sharing, multipart upload, and browser application shell |

Both presentation clients use the same Node server, PostgreSQL data, authentication model, roles, invitation behavior, shared application controller, and shared browser service implementations.

## Dependency direction

```txt
                          GrooveShare server
                                 ↑
                        shared service API
                                 ↑
                    packages/frontend-core
               domain + application + permissions
                   + mix + playback contracts
                                 ↑
                    packages/frontend-browser
               fetch/storage/history/browser shell
                         /               \
                        /                 \
                  client/           mobile-client/
             desktop + tablet            phone
```

Allowed dependency direction is downward toward shared packages. `client/` and `mobile-client/` must never import each other. `frontend-core` must never import either presentation or `frontend-browser`.

The root `npm run verify` gate runs an automated frontend-boundary audit in addition to tests/typechecks/builds.

## `frontend-core`: product and application behavior

`packages/frontend-core/` owns behavior whose meaning must be the same regardless of presentation:

- GrooveShare domain types: User, Project, Track, roles, membership, invitations, mix state.
- Project permission rules.
- Application state and route/action vocabulary.
- `GrooveShareApplicationController`.
- Authentication/session restoration coordination.
- Selected-project and Project Player application state.
- Projects/open-project navigation decisions.
- Invitation and Guest state machine.
- Guest → authenticated → Contributor continuation.
- Logout and expired-session recovery.
- Project, track, membership, auth, and invitation service behavior.
- Guest, Viewer, and pending mix persistence behavior.
- Playback contracts and shared playback implementations.
- Platform contracts such as `SessionProvider`, `StorageProvider`, API transport, and invitation-session persistence.

`frontend-core` does not render pages and does not contain desktop/mobile DOM, CSS, layout, or interaction assumptions.

A useful rule for future features is:

> If the code decides **what GrooveShare should do**, it belongs in `frontend-core` unless there is a strong platform-specific reason otherwise.

Recording should therefore begin with shared recording state/use-cases/contracts in `frontend-core`, not with two independent copies in the presentation clients.

## `frontend-browser`: browser mechanics shared by both presentations

`packages/frontend-browser/` owns browser-specific mechanisms that both web presentations use:

- `fetch` transport and cookie credentials.
- authentication-required/401 notification.
- `File`/`FormData` multipart upload adaptation.
- `localStorage` and `sessionStorage` adapters.
- browser invitation-session persistence.
- clipboard/invitation-link sharing.
- browser history/hash routing.
- the shared browser shell that connects browser history/page lifecycle to `GrooveShareApplicationController`.

The browser shell does not render desktop or mobile markup. Each client supplies a presentation-specific `initializePage` callback and `ApplicationPresentationPort` implementation.

A useful rule is:

> If the behavior is specifically about **how a browser provides a capability**, but is not desktop/mobile UI, it belongs in `frontend-browser`.

Future Capacitor/Electron/native wrappers may provide different adapters without changing application meaning in `frontend-core`.

## Presentation clients

`client/` and `mobile-client/` own how shared state is presented and manipulated on their target surfaces.

They are responsible for:

- pages/templates and HTML generation;
- CSS/layout;
- DOM querying and event wiring;
- device-specific navigation controls;
- desktop inline editing versus mobile modal/touch editing;
- desktop versus phone mixer presentation;
- file-picker interaction;
- page-controller composition;
- translating user interactions into shared controller/service operations.

The clients may intentionally diverge. Identical presentation files should not automatically move into a shared package merely because they happen to match today.

## Application flow

For example, opening a project now follows this shape:

```txt
Desktop click / Mobile tap
           ↓
 presentation page controller
           ↓
 shared browser application shell
           ↓
 GrooveShareApplicationController
           ↓
 shared ProjectsService
           ↓
 browser ApiTransport
           ↓
 server
```

The response flows back through shared application state and then the active presentation adapter:

```txt
server data
   ↓
shared application controller
   ↓
ApplicationPresentationPort.showProjectPlayer(...)
       /                              \
 desktop adapter                 mobile adapter
       ↓                              ↓
 desktop markup                   phone markup
```

## Tests

**`packages/frontend-core/tests/`** owns domain/application/service/workflow tests. Shared behaviors are tested once here rather than once per presentation.

**`packages/frontend-browser/tests/`** owns browser transport/storage/history/application-shell tests.

**`client/tests/`** owns desktop/tablet presentation unit tests and end-to-end frontend integration flows.

**`mobile-client/tests/`** owns phone presentation unit tests and end-to-end frontend integration flows.

The desktop and mobile integration suites intentionally retain overlapping product scenarios because they prove that two different presentations correctly consume the same shared application layer. Low-level shared service/router/storage tests are not duplicated in the clients.

## Verification

Focused commands:

```bash
npm run test-frontend-core
npm run test-frontend-browser
npm run test-client
npm run test-mobile
npm run frontend:boundaries
```

Full configured-environment gate:

```bash
npm run verify
```

The full gate checks server configuration/database connectivity, every workspace typecheck/test suite, frontend architecture boundaries, and production builds.

## Where future code should go

Use this decision order:

1. **Product/domain/application rule?** Put it in `frontend-core`.
2. **Shared browser mechanism?** Put it in `frontend-browser` behind or implementing a core contract.
3. **Desktop/tablet appearance or interaction?** Put it in `client/`.
4. **Phone appearance or interaction?** Put it in `mobile-client/`.
5. **Security/data authority?** Put it on the server; the frontend must not become the authority.

For recording, this means shared recording session/state transitions, permissions, synchronization contracts, persistence/use-case coordination, and recording-engine contracts should be designed in shared packages first. Desktop and mobile should then supply their own controls, layouts, permission prompts, and device-specific capture adapters as needed.
