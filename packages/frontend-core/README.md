# @hugovela/frontend-core

`frontend-core` is the small presentation-independent frontend boundary shared by GrooveShare clients.

## Phase 1 scope

Checkpoint 1 establishes contracts only:

- `SessionProvider` for authentication/session behavior;
- `StorageProvider` for small client-side persistence;
- `PlaybackEngine` for presentation-independent transport and mixer playback operations.

The package deliberately does **not** own DOM rendering, CSS, navigation presentation, dialogs, touch behavior, or desktop/mobile layout.

The current browser implementations remain in `client/`. Checkpoint 2 will make the current client consume the session and storage providers directly. Checkpoint 3 will place the existing multi-`HTMLAudioElement` playback implementation behind `PlaybackEngine`.
