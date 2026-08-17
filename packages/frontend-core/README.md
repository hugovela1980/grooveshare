# @hugovela/frontend-core

`frontend-core` is the small presentation-independent frontend boundary shared by GrooveShare presentation clients.

## Version 2 Phase 1 scope

The package now owns behavior that already has a clear reason to be shared:

- domain types used by both presentations;
- project permission rules;
- `SessionProvider` for authentication/session behavior;
- `StorageProvider` for small client-side persistence;
- `PlaybackEngine` as the presentation-independent audio contract;
- the current multi-`HTMLAudioElement` playback implementation behind that contract;
- Viewer mix storage and Owner/Contributor pending-mix recovery rules;
- debounced mix persistence, failed-save recovery, and flush-before-navigation behavior.

The package deliberately does **not** own DOM rendering, CSS, navigation presentation, dialogs, touch behavior, desktop/mobile layout, or page-controller DOM wiring.

## Browser/platform adapters

The existing `client/` still supplies the concrete browser environment:

- browser cookie-backed session behavior;
- browser `localStorage` through `StorageProvider`;
- real `HTMLAudioElement` instances for `createHtmlAudioPlaybackEngine`.

This keeps frontend-core testable without requiring a browser and leaves room for future Capacitor/Electron adapters.

## API access is intentionally still in `client/`

Phase 1 does not move the existing HTTP modules merely to make the package look complete. The current API layer still includes browser/session transport assumptions, and track upload specifically depends on browser `File`/`FormData` behavior.

When `mobile-client/` becomes the second real consumer, shared API behavior can be extracted where the duplication proves useful rather than introducing another transport abstraction prematurely.
