# GrooveShare Frontend Clients

This document records the Version 2 Milestone 6 multi-client boundary after the first architectural separation pass.

## Supported presentation surfaces

| Surface | Workspace | Current role | Future wrapper |
| --- | --- | --- | --- |
| Desktop/laptop browser | `client/` | Primary desktop web experience | Electron candidate |
| Tablet browser | `client/` | Derives from the desktop design and remains fluid | No separate tablet client planned |
| Phone browser | `mobile-client/` | Dedicated phone/touch presentation | Capacitor candidate |

Both presentation clients use the same Node server, PostgreSQL data, upload storage, authentication model, project roles, and shared frontend behavior.

## Shared versus presentation-specific responsibilities

```txt
                     GrooveShare server
                            ↑
                   shared frontend core
                  /                    \
            client/                mobile-client/
       desktop + tablet                phone
```

`packages/frontend-core/` owns behavior that already has a clear reason to be shared: GrooveShare domain types, project permission helpers, `SessionProvider` and `StorageProvider` contracts, mix recovery/debounce/flush behavior, the `PlaybackEngine` contract, and the current multi-`HTMLAudioElement` playback implementation behind that contract.

The presentation workspaces own markup, DOM event wiring, navigation, CSS, file-selection presentation, and interaction model. The duplicated browser API wrappers remain presentation-local in this first pass and intentionally target the same API contract.

## Intentional presentation differences

| Concern | Desktop/tablet `client/` | Phone `mobile-client/` |
| --- | --- | --- |
| Project editing | Inline title/description editing | Three-dot menu + modal form |
| Track-name editing | Inline contenteditable name | Explicit edit control + modal |
| Project Player navigation | Back + Log Out buttons | Compact top Back + bottom navigation |
| Project actions | Direct controls; Owner controls visible | Three-dot menu; Owner controls toggle |
| Mixer layout | Horizontal/row-oriented controls | Four vertical phone channel strips |
| Volume control | Horizontal range control | Vertical range control |
| Hover/keyboard affordances | Allowed and useful | Never required |
| Tablet behavior | Derived from desktop design | Not the primary tablet presentation |

These differences are product decisions, not viewport hacks. Each presentation can evolve without adding `isMobile` branches to one Project Player. Phone-only navigation, project-action menu, and edit-dialog templates now live only in `mobile-client/`; they are no longer part of the desktop/tablet workspace.

## Shared platform boundaries

```txt
SessionProvider -> BrowserSessionProvider -> existing session-cookie auth API
StorageProvider -> BrowserStorageProvider -> localStorage
presentation -> PlaybackEngine -> HtmlAudioPlaybackEngine (Version 2)
```

Version 3 can replace a provider or the playback implementation only if the native wrapper/Web Audio work actually requires it.

## Automated testing responsibilities

**`packages/frontend-core/tests/`** protects permission rules, storage/recovery behavior, debounce, successful/failed persistence, flush-before-navigation, and HTML-audio engine behavior.

**`client/tests/`** protects desktop/tablet flows: unauthenticated/authenticated startup, Project Player loading/playback preparation, inline project and track editing, mixer-to-playback/persistence behavior, dirty-mix navigation flush, expired sessions, and logout.

**`mobile-client/tests/`** protects the same product flows through phone controls: mobile Home/Projects, compact Project Player behavior, three-dot/modal editing, vertical mixer interaction, bottom navigation, expired sessions, and logout.

**`server/tests/`** protects the authoritative HTTP/security/data boundary. The authorization integration suite includes a two-session proof in which independent desktop and mobile sessions authenticate separately, open the same project with the same role, observe each other's project and mix updates, and receive the same track data.

## Verification commands

Focused suites:

```bash
npm run test-frontend-core
npm run test-client
npm run test-mobile
npm run test-server
```

Code-only root gate:

```bash
npm run verify:code
```

This runs workspace typechecks/tests and production builds for the server, desktop/tablet client, and mobile client.

Full configured-environment gate:

```bash
npm run verify
```

This additionally checks production configuration and database connectivity.

## Manual verification that remains useful

Manual testing should focus on behavior the current harness cannot realistically reproduce: actual browser audio, touch ergonomics, native file selection, iOS Safari/Android Chrome differences, viewport/safe-area/mobile-keyboard behavior, and later Capacitor/Electron wrapper behavior.

## Deferred to Version 3 Phase 2

Milestone 6 intentionally does not settle whether API wrappers should move into `frontend-core`, whether Capacitor needs native auth/storage providers, whether Electron needs desktop-specific providers, whether shared design tokens deserve a package, whether the repository should move to an `apps/` layout, whether any UI components genuinely deserve sharing, or how recording changes the platform/playback contracts.

The Version 2 proof is simpler: one GrooveShare product now supports two intentionally different presentations over one shared core and one authoritative backend.
