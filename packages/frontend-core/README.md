# @hugovela/frontend-core

`frontend-core` is the presentation-independent frontend boundary shared by GrooveShare presentation clients.

## Current shared responsibilities

The package owns behavior and contracts that have a clear reason to mean the same thing in every presentation:

- shared project, track, user, membership, invitation-access, and mix domain types;
- project permission rules;
- `SessionProvider` for authentication/session behavior;
- `StorageProvider` for small client-side persistence;
- `PlaybackEngine` as the presentation-independent audio contract;
- the shared Web Audio playback implementation;
- Viewer/pending mix storage rules and mix-persistence coordination;
- shared application state contracts;
- shared application route/action vocabulary;
- the `ApplicationPresentationPort` boundary implemented by desktop and mobile presentation adapters.

The package deliberately does **not** own DOM rendering, CSS, dialogs, touch behavior, desktop/mobile layout, or page-controller DOM wiring.

## Version 2.2 application-layer direction

Stage 1 establishes contracts before moving major workflows. `client/` and `mobile-client/` still own their existing live application state and workflow implementations, but both now depend on the same vocabulary for:

- authentication state;
- selected project state;
- invitation session state;
- loading/error state;
- application screens/routes/actions;
- presentation requests such as showing authentication, Projects, Create Project, Project Player, loading, or application errors.

Each browser client supplies an `ApplicationPresentationPort<string>` adapter that delegates to its existing page renderers. This means Stage 1 changes the dependency boundary without changing the existing UI.

Later Version 2.2 stages can move the proven shared workflows into a shared application controller behind these contracts.

## Browser/platform adapters

Browser-specific behavior remains outside the core package, including:

- browser cookie/session transport;
- `localStorage` and `sessionStorage` implementations;
- browser history and URL/hash behavior;
- clipboard access;
- `File`/`FormData` upload behavior;
- desktop/mobile HTML, CSS, and interaction patterns.

This keeps `frontend-core` testable without requiring a browser and preserves room for future browser, Capacitor, or Electron adapters.

## API access

HTTP modules are still client-local at the end of Stage 1. Desktop and mobile have now proven substantial duplication in this area; Version 2.2 Stage 2 is intended to consolidate that behavior behind shared service/transport contracts rather than moving browser `fetch` details directly into the application layer.
