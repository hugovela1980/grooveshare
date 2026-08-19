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
- shared API response/error handling and service-level request behavior;
- the shared collaboration invitation / Guest access application workflow.

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

### Stage 3 — shared invitation and Guest workflow

Stage 3 moves the first complete application workflow behind the shared boundary. `InvitationGuestWorkflow` now owns:

- invitation session state and project scoping;
- Guest invitation opening and revalidation;
- revoked/disabled/regenerated invitation handling;
- authenticated-member fallback when an invitation disappears;
- pending Contributor intent across authentication;
- explicit Contributor acceptance and post-accept project reload;
- Guest continuation after logout or an expired authenticated session;
- the invitation state supplied to presentation adapters.

Desktop and mobile still own navigation/rendering mechanics, but they no longer independently implement the invitation state machine.

### Stage 4 — shared GrooveShare application controller

Stage 4 moves the broader application state machine into `GrooveShareApplicationController`. The shared controller now owns:

- authentication/session restoration state;
- selected-project state;
- requested-route resolution and authentication protection;
- Project Menu and Project Player application state;
- project loading and deep-link restoration;
- application-level navigation decisions;
- invitation/Guest workflow integration;
- post-auth invitation continuation;
- logout and expired-session transitions;
- the presentation state sent through `ApplicationPresentationPort`.

The concrete desktop and mobile composition roots still own browser history application, DOM lifecycle setup/cleanup, page-controller construction, HTML/CSS, dialogs, inline editing, touch behavior, and other presentation-specific interaction. Both clients now send the same application actions into the same shared controller and render the resulting state through their own presentation adapters.

## Dependency direction

```text
frontend-core
    ↑
frontend-browser
    ↑            ↑
 client      mobile-client
```

`frontend-core` knows nothing about either client or the browser package. `frontend-browser` implements browser-specific ports using `frontend-core`. Desktop and mobile can then share browser infrastructure without becoming dependent on one another.
