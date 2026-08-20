# GrooveShare Frontend Architecture

This document describes the current shared frontend boundary used by the desktop/tablet and phone clients.

The boundary was established in Version 2.2 and is now also the foundation for Version 3 audio/recording work.

## Runtime surfaces

| Surface | Workspace/package | Responsibility |
| --- | --- | --- |
| Desktop/laptop/tablet browser | `client/` | Desktop/tablet presentation and interaction |
| Phone browser | `mobile-client/` | Phone/touch presentation and interaction |
| Shared product/application/audio layer | `packages/frontend-core/` | What GrooveShare means and what the application does |
| Shared browser adapter layer | `packages/frontend-browser/` | Browser transport, storage, history, multipart upload, sharing, and browser application shell |

Both presentation clients use the same Node server, PostgreSQL data, authentication model, roles, invitation behavior, shared application controller, service implementations, permissions, mix-persistence rules, and playback engine contracts.

## Dependency direction

```txt
                          GrooveShare server
                                 ↑
                        shared service API
                                 ↑
                    packages/frontend-core
             domain + application + services + audio
                                 ↑
                    packages/frontend-browser
               fetch/storage/history/browser shell
                         /               \
                        /                 \
                  client/           mobile-client/
             desktop + tablet            phone
```

Rules:

- `client/` and `mobile-client/` must not import each other.
- `frontend-core` must not import either presentation client.
- `frontend-core` must not depend on `frontend-browser`.
- `frontend-browser` may depend on `frontend-core`, but must not import either presentation client.
- Presentation-specific HTML, CSS, DOM manipulation, and device interaction stay out of `frontend-core`.

The repository enforces these rules through:

```bash
npm run frontend:boundaries
```

That check is part of `npm run verify`.

## `frontend-core`: product, application, and audio meaning

`packages/frontend-core/` owns behavior whose meaning should be the same regardless of how it is presented.

Current responsibilities include:

- shared User, Project, Track, membership, invitation, mix, and access types;
- project permission rules;
- application state, screen/route/action vocabulary, and presentation-port contracts;
- `GrooveShareApplicationController`;
- authentication/session restoration coordination;
- selected-project and Projects/Project Player application state;
- project-loading and application-level navigation decisions;
- invitation/Guest state machine and Guest → Contributor continuation;
- logout and expired-session recovery;
- project, track, membership, authentication, and invitation service behavior;
- Viewer/Contributor/Owner/Guest mix-persistence rules;
- project-draft behavior;
- `PlaybackEngine` contracts and shared playback implementations;
- shared `Transport`, playback scheduling instructions, and project timeline semantics;
- recording timeline markers/metadata that future microphone capture will use;
- abstract ports such as `SessionProvider`, `StorageProvider`, `ApiTransport`, `MultipartBodyFactory`, and invitation-session persistence.

`frontend-core` does **not** render a page and does not know whether the active presentation is desktop or phone.

A useful rule is:

> If the code decides **what GrooveShare should do or what a GrooveShare concept means**, it probably belongs in `frontend-core`.

## `frontend-browser`: browser mechanics shared by both presentations

`packages/frontend-browser/` owns browser-specific mechanisms that are useful to both web clients:

- `fetch` transport with cookie credentials;
- 401/authentication-required notification;
- `File`/`FormData` multipart upload adaptation;
- `localStorage` and `sessionStorage` adapters;
- collaboration invitation-session persistence;
- invitation-link construction and clipboard copying;
- hash/history routing;
- construction of the shared frontend service bundle;
- the browser application shell that connects history/page lifecycle to `GrooveShareApplicationController`.

The browser shell accepts presentation callbacks instead of rendering markup itself.

A useful rule is:

> If the behavior is specifically **how the browser supplies a capability**, but is not desktop/mobile UI, it belongs in `frontend-browser`.

This boundary leaves room for future Capacitor/native adapters without changing product meaning in `frontend-core`.

## Presentation clients

`client/` and `mobile-client/` own how shared state is presented and manipulated on their target surfaces.

They own:

- pages/templates and HTML generation;
- CSS/layout;
- DOM querying and event wiring;
- desktop/tablet versus phone navigation;
- desktop inline editing versus phone-oriented modal/touch interactions;
- desktop versus mobile mixer layout;
- file-picker interaction;
- page-controller composition;
- device-specific controls and feedback;
- translation of user actions into shared controller/service/playback operations.

The two clients are intentionally allowed to diverge. A presentation file should not move to a shared package merely because the desktop and phone versions happen to be identical today.

## Application flow

Opening a project follows this general path:

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

The response returns through the application layer:

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

The controller knows that GrooveShare should show the Project Player. It does not know how either Project Player is rendered.

## Collaboration invitation flow

Invitation behavior is shared application logic rather than presentation logic:

```txt
invitation URL/session
      ↓
InvitationGuestWorkflow
      ↓
resolve/revalidate invitation
      ↓
Guest state or authenticated continuation
      ↓
GrooveShareApplicationController
      ↓
presentation state
      ↓
desktop or mobile invitation UI
```

The shared workflow owns revocation/invalid-link handling, pending Contributor intent, post-auth continuation, and explicit invitation acceptance. Desktop/mobile own only the visual controls and interaction wiring.

## Mix persistence boundary

Mix behavior is also presentation-independent:

- Owners/Contributors can persist the shared project mix to the server.
- pending shared-mix changes receive browser recovery copies and are debounced before server persistence;
- controlled navigation can flush pending persistence;
- Viewers use browser-local personal mix storage;
- Guests use the same read-only mix behavior through a distinct Guest local-storage key.

The presentation decides when the user changes a mixer control; `frontend-core` decides how that change is persisted.

## Audio boundary

Both presentations use the same `PlaybackEngine` seam.

The primary implementation is the shared `WebAudioPlaybackEngine`:

```txt
presentation transport controls
            ↓
       PlaybackEngine
            ↓
         Transport
            ↓
PlaybackScheduleInstruction
            ↓
 WebAudioPlaybackEngine
            ↓
shared AudioContext clock
```

Current shared audio responsibilities include:

- project timeline position/duration/state;
- play, pause, stop, seek, relative seek, and loop state;
- scheduling every active source from one absolute AudioContext instruction;
- clock-scheduled loop continuations;
- synchronized multitrack source recreation after pause/seek;
- per-channel gain/enable behavior;
- recording start/stop timeline markers;
- a domain-level `timelineOffsetSeconds` concept for future recorded tracks.

The clients still own transport buttons, slider/touch behavior, visual timestamps, and mixer layout. UI timers observe snapshots; they are not the audio clock.

## Recording direction

Recording should extend the existing boundary rather than create a new parallel timing system.

Shared concerns should begin in `frontend-core`, for example:

- recording-session state and transitions;
- recording permissions/use-case rules;
- relationship between captured audio and the shared Transport;
- recording timeline/offset metadata;
- save/discard/retry workflow coordination;
- shared recording-engine contracts.

Browser-specific microphone/capture APIs belong behind browser/platform adapters. Desktop and mobile should then provide their own recording controls, layouts, permission prompts, and device-specific UX.

## Tests

**`packages/frontend-core/tests/`** owns domain/application/service/workflow/audio tests. Shared behaviors are tested once here.

**`packages/frontend-browser/tests/`** owns browser transport/storage/history/application-shell tests.

**`client/tests/`** owns desktop/tablet presentation unit tests and frontend integration flows.

**`mobile-client/tests/`** owns phone presentation unit tests and frontend integration flows.

The desktop and mobile integration suites intentionally retain overlapping end-user scenarios because they prove that two independent presentations consume the same shared application behavior correctly.

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

## Placement checklist for future code

Use this order:

1. **Security/data authority?** Put it on the server.
2. **Product/domain/application/audio rule shared by presentations?** Put it in `frontend-core`.
3. **Shared browser mechanism implementing a core contract?** Put it in `frontend-browser`.
4. **Desktop/tablet appearance or interaction?** Put it in `client/`.
5. **Phone appearance or interaction?** Put it in `mobile-client/`.

The goal is not zero duplicated lines. The goal is one authoritative implementation of shared product behavior while allowing the two presentations to evolve independently.
