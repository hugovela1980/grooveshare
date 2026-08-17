# Milestone 6 Client Architecture Tour

> **Intended repo location:** `docs/milestone-6-client-architecture-tour.md`
>
> This tour was written against the uploaded `feature/multi-client-frontend-foundation` snapshot. The line numbers below match that snapshot and will drift as soon as we begin refactoring.
>
> The links in this tour are **workspace-relative Markdown links**. File links such as `../client/src/main.ts` open the source file, while line links such as `../client/src/main.ts#L1` jump to the referenced line in VS Code. Because they are relative to this file's location in `docs/`, they do not depend on your repository being stored at a particular Windows path.

## Purpose of this tour

Milestone 6 is not a full frontend rewrite. The goal of the first multi-client pass is to **cross the architectural bridge**:

```text
                         GrooveShare server
                              │
                     shared frontend core
                    /                     \
        desktop/tablet presentation    mobile presentation
                 client/                 mobile-client/
                    │                         │
             browser today              browser today
             Electron later             Capacitor later
```

The important separation is not "small screen CSS vs large screen CSS." It is:

- **shared product behavior** — API calls, types, permissions, session/storage contracts, mix persistence, playback contract;
- **independent presentation behavior** — page markup, navigation, editing interaction, touch controls, desktop controls, CSS.

The current `client/` already has several good seams. It also has a few places where browser/platform behavior and UI behavior are still mixed together. Those are the places we will work on.

---

# 1. Start at the client entry point

**Open:** [`client/src/main.ts`](../client/src/main.ts)  
**VS Code:** [jump to line 1](../client/src/main.ts#L1)

`main.ts` is intentionally thin. It does four things:

1. imports the app factory;
2. imports the client configuration and CSS;
3. finds `#app` and renders the startup loading state;
4. creates GrooveShare and calls `app.start()`.

Relevant lines:

- **1–5** — imports and CSS entry point;
- **7–17** — locate `#app`, show loading UI, create the application;
- **19** — start the app;
- **21–26** — development toolbar.

### Why this matters for Milestone 6

This is exactly the kind of file we want each presentation client to own.

Eventually we can have:

```text
client/src/main.ts
mobile-client/src/main.ts
```

Both can boot the same shared core services, but they can import different app composition code and different CSS.

**Likely ownership after Phase 1:** presentation-specific; stays in each client, not `frontend-core`.

---

# 2. `app.ts` is the current composition root — and the main separation point

**Open:** [`client/src/app.ts`](../client/src/app.ts)  
**VS Code:** [jump to `initializeProjectPlayerPage()` at line 508](../client/src/app.ts#L508)  
**VS Code:** [jump to `createGrooveShareApp()` at line 960](../client/src/app.ts#L960)

This is the most important file to understand before we split the clients.

Right now `app.ts` is doing **application composition** and **presentation wiring** in the same file.

## `initializeProjectPlayerPage()` — lines 508–884

This function reaches into the rendered DOM and gathers all of the Project Player controls:

- Back/Logout — **523–531**;
- loading/content regions — **538–545**;
- project title/description displays — **562–575**;
- project edit modal inputs/buttons — **577–608**;
- track edit modal inputs/buttons — **610–637**;
- audio transport DOM — **643–686**;
- audio controller construction — **702–714**;
- Project Player controller construction — **716–752**;
- mobile navigation wiring — **782–786**;
- three-dot project actions menu — **790–829**;
- owner membership controls — **831–876**.

That list tells us something important: **the current composition root knows both desktop and phone UI details.**

For example, it wires both:

```text
#player-logout-button              desktop header logout
#mobile-nav-logout-button          phone bottom-nav logout
```

and both:

```text
[data-project-title-display]       desktop title
[data-project-mobile-title-display] phone title
```

That was a perfectly reasonable way to reach a responsive Version 2 UI. It is also the exact coupling we now want to stop increasing.

## `createGrooveShareApp()` — lines 960–1235

This section owns higher-level application state:

- current user — **967**;
- selected project — **966**;
- route resolution — **995–1036**;
- router construction — **1043–1057**;
- page initialization — **1059–1073**;
- navigation — **1080–1115**;
- browser-history handling — **1117–1143**;
- successful authentication — **1145–1149**;
- logout — **1151–1180**;
- expired-session handling — **1182–1196**;
- session restoration at startup — **1198–1227**.

This part is much closer to **shared application behavior**, but it still calls presentation-specific renderers directly at **1047–1053**.

### What changes in Milestone 6

We should not try to make one giant `app.ts` understand every platform.

The likely direction is:

```text
client/src/app.ts
    desktop/tablet composition

mobile-client/src/app.ts
    phone composition

packages/frontend-core/
    shared types/services/contracts used by both
```

The two `app.ts` files may still look similar at first. That is okay. We only extract shared behavior when there is a clear shared responsibility.

**Likely ownership after Phase 1:** split by presentation. Some application behavior may move behind shared services, but the DOM wiring stays client-specific.

---

# 3. The current Project Player page contains both desktop and mobile markup

**Open:** [`client/src/pages/project-player-page.ts`](../client/src/pages/project-player-page.ts)  
**VS Code:** [jump to `renderProjectPlayerPage()` at line 50](../client/src/pages/project-player-page.ts#L50)

The current page renderer is a good example of a **single presentation trying to serve two interaction models**.

Look at these specific places:

- **63–70** — one Back button contains both desktop text and a mobile chevron;
- **72** — separate mobile project title;
- **74–80** — desktop Logout button;
- **82** — three-dot project action menu;
- **85–106** — desktop-style project heading/details;
- **139–140** — modal project and track editors;
- **141** — mobile bottom navigation.

The renderer itself is not wrong. It is simply where the cost of a one-client design is becoming visible.

### After the split

The desktop/tablet renderer should be free to say:

```text
I want a wide Project Player.
I want desktop/tablet navigation.
I may want inline editing.
I may want denser controls.
```

The mobile renderer should be free to say:

```text
I want the compact top bar.
I want the three-dot project menu.
I want modal editing.
I want bottom navigation.
I want touch-sized controls.
```

Neither renderer should need to contain markup for the other one.

**Likely ownership after Phase 1:** duplicated/separate presentation files in `client/` and `mobile-client/`.

---

# 4. The mixer template is also currently one markup structure serving two layouts

**Open:** [`client/src/templates/mix-channel-slots.ts`](../client/src/templates/mix-channel-slots.ts)  
**VS Code:** [jump to `renderAssignedChannelSlot()` at line 46](../client/src/templates/mix-channel-slots.ts#L46)  
**VS Code:** [jump to `renderMixChannelSlots()` at line 208](../client/src/templates/mix-channel-slots.ts#L208)

Important current responsibilities:

- **57–68** — resolves saved enabled/volume state and permission-aware track management;
- **70–76** — track-name display;
- **85–101** — channel enable control;
- **104–122** — track name plus pencil edit button;
- **124–146** — volume control;
- **148–163** — delete action;
- **168–205** — empty channel / Add Track behavior;
- **208–243** — renders the full four-channel mixer.

The **permissions and mix data are shared behavior**. The exact markup is presentation.

A desktop mixer and a phone mixer may both consume:

```ts
{
  channelNumber,
  track,
  enabled,
  volume,
  mayManageTrack
}
```

but render it very differently.

That is the kind of separation we want: **same meaning, different view**.

---

# 5. `responsive.css` shows why this is more than responsive styling now

**Open:** [`client/src/css/_imports/responsive.css`](../client/src/css/_imports/responsive.css)  
**VS Code:** [jump to the phone breakpoint at line 9](../client/src/css/_imports/responsive.css#L9)  
**VS Code:** [jump to mobile Project Player at line 98](../client/src/css/_imports/responsive.css#L98)  
**VS Code:** [jump to the four-column phone mixer at line 275](../client/src/css/_imports/responsive.css#L275)

The file describes itself accurately at **lines 4–6**: it coordinates multiple components to create a deliberate phone presentation.

Some examples:

- **21–92** — fixed mobile bottom navigation;
- **98–185** — mobile Project Player shell and top-bar behavior;
- **186–273** — mobile transport layout;
- **275–529** — four-column mobile mixer;
- **531–556** — very narrow phone relief;
- **558–573** — short portrait viewport adjustments.

This is the point where we moved beyond "make desktop CSS wrap nicely." The CSS is defining a separate phone experience.

### Phase 1 direction

The desktop/tablet client should still be responsive enough not to break on smaller windows and tablets, but it should no longer have to transform itself into the phone product.

The mobile client can own this phone-first composition directly.

**Likely ownership after Phase 1:** presentation-specific CSS. We may share base tokens later, but not one giant responsive stylesheet.

---

# 6. `types.ts` is an obvious `frontend-core` candidate

**Open:** [`client/src/types.ts`](../client/src/types.ts)  
**VS Code:** [jump to line 1](../client/src/types.ts#L1)

This file contains the language both clients use to talk about GrooveShare:

- `MixChannelSetting` / `MixSettings` — **1–10**;
- `ProjectRole` / `Project` — **12–22**;
- project inputs — **24–32**;
- `Track` / upload input — **34–50**;
- `User` / auth inputs — **52–69**;
- `ProjectMember` — **71–81**.

There is almost nothing presentation-specific here.

A likely Phase 1 move is:

```text
client/src/types.ts
        ↓
packages/frontend-core/src/types.ts
```

To keep the migration low-risk, we can temporarily leave a small re-export file in `client/src/types.ts` so we do not have to update every import in one giant edit.

**Likely ownership after Phase 1:** shared core.

---

# 7. Permission helpers are already clean shared logic

**Open:** [`client/src/permissions/project-permissions.ts`](../client/src/permissions/project-permissions.ts)  
**VS Code:** [jump to line 1](../client/src/permissions/project-permissions.ts#L1)

This file is exactly the kind of code `frontend-core` should own:

- `canContribute()` — **3–5**;
- `canManageProject()` — **7–9**;
- `canPersistMix()` — **11–13**;
- `canManageTrack()` — **15–33**.

These functions answer **product questions**, not UI questions.

The mobile client and desktop client should never have different answers to:

> Can this Contributor delete this track?

They can expose that permission differently, but they should share the rule.

**Likely ownership after Phase 1:** shared core.

---

# 8. The API modules are another strong shared boundary

**Open:** [`client/src/api/projects-api.ts`](../client/src/api/projects-api.ts)  
**VS Code:** [jump to `updateProjectDetails()` at line 38](../client/src/api/projects-api.ts#L38)  
**Open:** [`client/src/api/api-client.ts`](../client/src/api/api-client.ts)  
**VS Code:** [jump to `apiFetch()` at line 35](../client/src/api/api-client.ts#L35)

`projects-api.ts` is mostly presentation-neutral HTTP behavior:

- list/get/create project;
- update project details — **38–51**;
- delete project — **53–59**;
- save mix settings — **61–77**.

That should not be independently rewritten in a mobile client.

`api-client.ts`, however, exposes one important platform assumption:

```ts
credentials: "include"
```

at **lines 44–47**.

That is correct for today's browser/session-cookie architecture. It is also one of the reasons we want an authentication/session boundary before Capacitor.

The core should know **what operation it needs**. The platform adapter should know **how this client carries its session**.

---

# 9. Authentication is already surprisingly close to the seam we need

**Open:** [`client/src/api/auth-api.ts`](../client/src/api/auth-api.ts)  
**VS Code:** [jump to `AuthApi` at line 13](../client/src/api/auth-api.ts#L13)  
**Open:** [`client/src/app.ts`](../client/src/app.ts)  
**VS Code:** [jump to injected `authenticationApi` at line 960](../client/src/app.ts#L960)

The current `AuthApi` type already defines an abstraction:

```ts
registerUser(...)
login(...)
logout()
getCurrentUser()
```

And `createGrooveShareApp()` already accepts it as a dependency at **lines 960–965**.

That is excellent groundwork. Tests can already pass a fake authentication API instead of depending on a real browser session.

### What is still browser-specific

The lower-level fetch code always uses browser cookie credentials. The UI/app layer also calls the auth API directly and interprets session restoration/expiration itself.

### Phase 1 target

We do **not** need to invent native authentication yet. We only need a stable shared contract, for example:

```ts
export interface SessionProvider {
  register(input: RegisterUserInput): Promise<User>;
  login(input: LoginInput): Promise<User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User>;
}
```

Today's implementation can simply be:

```text
BrowserSessionProvider
    ↓
existing auth HTTP endpoints
    ↓
credentials: include
```

Later Capacitor can keep using that implementation if it works reliably, or provide a different adapter without changing the mobile UI or the shared application logic.

**Important:** this phase creates the boundary; it does not solve an imaginary future native-auth problem early.

---

# 10. Storage is the clearest platform-boundary example in the current code

**Open:** [`client/src/storage/pending-mix-storage.ts`](../client/src/storage/pending-mix-storage.ts)  
**VS Code:** [jump to `getBrowserStorage()` at line 7](../client/src/storage/pending-mix-storage.ts#L7)  
**Open:** [`client/src/storage/viewer-mix-storage.ts`](../client/src/storage/viewer-mix-storage.ts)  
**VS Code:** [jump to `getBrowserStorage()` at line 7](../client/src/storage/viewer-mix-storage.ts#L7)

Both storage modules currently do this:

```ts
if (typeof globalThis.localStorage === "undefined") {
  return null;
}

return globalThis.localStorage;
```

That is the exact browser assumption we want to isolate.

## The good news: you already built an injection seam

Both modules define a small `StorageLike` type and allow callers/tests to pass storage explicitly.

For pending mix storage:

- `StorageLike` — **line 5**;
- browser lookup — **7–13**;
- `loadPendingMixSettings(..., storage = getBrowserStorage())` — **49–73**;
- `savePendingMixSettings(..., storage = getBrowserStorage())` — **75–94**;
- `clearPendingMixSettings(..., storage = getBrowserStorage())` — **96–113**.

The storage unit test proves the idea already works:

**Open:** [`client/tests/pending-mix-storage.test.ts`](../client/tests/pending-mix-storage.test.ts)  
**VS Code:** [jump to the fake storage at line 9](../client/tests/pending-mix-storage.test.ts#L9)

At **lines 9–25**, the test creates an in-memory storage implementation and injects it at **lines 48–54**.

That means Milestone 6 is not inventing dependency injection from scratch. We are taking a pattern that already exists locally and making it a named platform contract.

### Phase 1 target

Something this small is enough:

```ts
export interface StorageProvider {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

Then:

```text
frontend-core
    knows StorageProvider

client
    supplies BrowserLocalStorageProvider

mobile-client
    supplies BrowserLocalStorageProvider for now

Capacitor later
    may supply CapacitorStorageProvider
```

The shared mix-persistence code never needs to ask whether it is running in Chrome, Safari, Electron, or Capacitor.

---

# 11. The Project Player controller currently crosses UI, persistence, API, and playback boundaries

**Open:** [`client/src/page-controllers/project-player-page-controller.ts`](../client/src/page-controllers/project-player-page-controller.ts)  
**VS Code:** [jump to imports at line 1](../client/src/page-controllers/project-player-page-controller.ts#L1)  
**VS Code:** [jump to controller construction at line 278](../client/src/page-controllers/project-player-page-controller.ts#L278)

This is the best file for seeing **why frontend-core is needed but should stay small**.

At the top, the controller imports storage directly:

```text
lines 1–9  → viewer and pending mix storage
```

It also imports shared permission rules at **10–15** and owns a local `AudioPlayerController` shape at **79–85**.

Then one controller handles:

- loading tracks;
- reading mixer state from the DOM;
- preparing playback;
- project editing;
- track editing;
- live mixer changes;
- deferred server persistence;
- local recovery persistence;
- file picking/upload;
- deletion;
- initialization/listeners.

That made sense while there was only one presentation client. We should not copy this entire controller into `mobile-client/` and then let two versions independently evolve all of that behavior.

### The key refactor rule

We do **not** need to turn this into ten abstract classes.

Instead, as we create the second consumer, we extract only the pieces that are genuinely shared:

```text
Project Player UI/controller
        │
        ├── shared permission helpers
        ├── shared API/service calls
        ├── shared mix persistence service
        ├── shared StorageProvider
        └── shared PlaybackEngine contract
```

The DOM event handlers can stay separate.

---

# 12. Current mix persistence is the best candidate for a shared service

**Open:** [`client/src/page-controllers/project-player-page-controller.ts`](../client/src/page-controllers/project-player-page-controller.ts)  
**VS Code:** [jump to `rememberPendingMixSettings()` at line 821](../client/src/page-controllers/project-player-page-controller.ts#L821)  
**VS Code:** [jump to `persistCurrentMixSettings()` at line 923](../client/src/page-controllers/project-player-page-controller.ts#L923)

The important behavior is currently here:

- `canUsePendingMixStorage()` — **804–810**;
- `rememberPendingMixSettings()` — **821–834**;
- `savePendingMixToServer()` — **836–904**;
- `schedulePendingMixPersistence()` — **906–921**;
- `persistCurrentMixSettings()` — **923–938**;
- `flushPendingMixSettings()` — **940 onward**.

This is not really "mobile UI" or "desktop UI." It is GrooveShare behavior.

Both presentation clients should have the same guarantees:

```text
change mixer
    ↓
apply sound immediately
    ↓
store recovery copy
    ↓
debounce server write
    ↓
clear recovery after confirmed save
    ↓
flush before controlled navigation
```

This is a strong candidate to become a small shared object/service that accepts:

```text
projects API
StorageProvider
current user/project/role
scheduler/timer dependency
```

and exposes operations such as:

```ts
remember(mixSettings)
flush()
restore()
```

The desktop and mobile controllers would only decide **when the user changed the mixer**.

---

# 13. Audio playback currently mixes engine behavior with DOM presentation

**Open:** [`client/src/page-controllers/audio-player-controller.ts`](../client/src/page-controllers/audio-player-controller.ts)  
**VS Code:** [jump to `createAudioPlayerController()` at line 89](../client/src/page-controllers/audio-player-controller.ts#L89)  
**VS Code:** [jump to channel controls at line 281](../client/src/page-controllers/audio-player-controller.ts#L281)  
**VS Code:** [jump to `loadMix()` at line 337](../client/src/page-controllers/audio-player-controller.ts#L337)  
**VS Code:** [jump to returned public methods at line 414](../client/src/page-controllers/audio-player-controller.ts#L414)

This file currently contains two categories of responsibility.

## Presentation/controller work

Examples:

- enable/disable DOM controls — **104–109**;
- change Play/Pause icon — **111–117**;
- write timestamps and progress — **119–149**;
- bind button/range listeners — **365–383**.

## Playback-engine work

Examples:

- play/pause all loaded audio elements — **151–174**;
- stop/reset all channels — **176–187**;
- loop behavior — **189–205**;
- seek all audio elements — **207–242**;
- set channel volume — **281–300**;
- enable/disable channel — **302–321**;
- load/create multiple `HTMLAudioElement`s — **337–363**;
- synchronize current time across them — **408–412**.

The public methods returned at **414–421** already look like the beginning of an engine contract:

```text
loadMix
setChannelVolume
setChannelEnabled
setTrackName
stop
```

### Phase 1 target

We can introduce a shared contract such as:

```ts
export interface PlaybackEngine {
  loadMix(channels: PlaybackChannel[]): void;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  seekBy(seconds: number): void;
  setChannelVolume(channelNumber: number, volume: number): boolean;
  setChannelEnabled(channelNumber: number, enabled: boolean): boolean;
}
```

Then move the multi-`HTMLAudioElement` mechanics behind an implementation such as:

```text
HtmlAudioPlaybackEngine
```

The desktop transport controller and mobile transport controller can look completely different while issuing the same engine operations.

Later, Version 3's Web Audio milestone can replace the implementation without requiring a second UI rewrite.

**This is a foundation change, not an audio behavior change.** The current Version 2 playback model should sound and behave the same after the refactor.

---

# 14. Browser routing is already behind an adapter — but we do not need to over-extract it

**Open:** [`client/src/router/app-router.ts`](../client/src/router/app-router.ts)  
**VS Code:** [jump to `routeToHash()` at line 86](../client/src/router/app-router.ts#L86)  
**VS Code:** [jump to `createBrowserHistoryAdapter()` at line 141](../client/src/router/app-router.ts#L141)  
**VS Code:** [jump to `createAppRouter()` at line 184](../client/src/router/app-router.ts#L184)

The router already has a `HistoryAdapter`, and browser history access is isolated in `createBrowserHistoryAdapter()`.

That is a good pattern.

For this first Phase 1 pass, I would **not automatically move the router to `frontend-core`**. Navigation structure can legitimately diverge between desktop and mobile as the apps evolve.

If both clients end up using the exact same route semantics, we can extract shared route parsing/types later. We do not need to decide that before a second consumer exists.

**Likely Phase 1 ownership:** each presentation client, unless the first implementation proves duplication is truly pointless.

---

# 15. The root workspace is already ready for a shared package

**Open:** [`package.json`](../package.json)  
**VS Code:** [jump to workspaces at line 4](../package.json#L4)

Current workspaces:

```json
"workspaces": [
  "client",
  "server",
  "packages/*"
]
```

This is useful because `packages/frontend-core` will already match `packages/*`.

The only new top-level workspace we definitely need for the two-client proof is likely:

```json
"mobile-client"
```

We will also need scripts such as a mobile dev/build/test command and eventually make the root `build`/`verify` include both clients.

This is a relatively small infrastructure change; the monorepo already has the shape we need.

---

# 16. Worked example: desktop inline editing vs mobile modal editing

This is the concrete example that demonstrates **presentation separation without business-logic duplication**.

## What exists today

The current branch uses the mobile-safe modal editing behavior for everyone.

Follow this path:

### A. The page renders the modal

**Open:** [`client/src/pages/project-player-page.ts`](../client/src/pages/project-player-page.ts)  
**VS Code:** [jump to lines 139–141](../client/src/pages/project-player-page.ts#L139)

The Project Player includes:

```ts
renderProjectEditDialog()
renderTrackEditDialog()
```

### B. The three-dot menu starts editing

**Open:** [`client/src/app.ts`](../client/src/app.ts)  
**VS Code:** [jump to line 790](../client/src/app.ts#L790)

For an Owner, `app.ts` creates the project-actions controller and passes:

```ts
onEditProject: controller.openProjectEditor
```

at **line 819**.

### C. The Project Player controller opens the modal

**Open:** [`client/src/page-controllers/project-player-page-controller.ts`](../client/src/page-controllers/project-player-page-controller.ts)  
**VS Code:** [jump to `openProjectEditor()` at line 528](../client/src/page-controllers/project-player-page-controller.ts#L528)

`openProjectEditor()` copies current project data into the form and reveals the dialog.

### D. Save uses the project API

**VS Code:** [jump to `handleProjectEditSubmit()` at line 555](../client/src/page-controllers/project-player-page-controller.ts#L555)

The important shared operation is at **592–598**:

```ts
await projectsApi.updateProjectDetails(project.id, {
  title,
  description,
});
```

That network operation does not care whether the data came from:

- an inline desktop title;
- a desktop side panel;
- a phone modal;
- a future Electron menu command.

## What we want after the Phase 1 split

Conceptually:

```text
DESKTOP/TABLET CLIENT

Project title
    ↓ click / explicit desktop edit affordance
inline editing
    ↓ save
shared project update operation


MOBILE CLIENT

⋮ Project Actions
    ↓
Edit Project
    ↓
modal form
    ↓ save
shared project update operation
```

Possible code shape:

```text
client/src/...desktop project-player controller
                    │
                    └──────┐
                           ▼
             @grooveshare/frontend-core
                project API/service
                           ▲
                    ┌──────┘
                    │
mobile-client/src/...mobile project-player controller
```

The presentation code can diverge without duplicating authorization rules or HTTP behavior.

### This is the key mental model

We are **not** building:

```ts
if (isMobile) {
  openModal();
} else {
  enableContentEditable();
}
```

inside one controller.

We are allowing two controllers to express two intentional experiences while sharing the operation that actually changes GrooveShare data.

---

# 17. The same Project Player example shows the StorageProvider separation

Project editing itself is server-backed and does not currently use local storage. The mixer on the **same Project Player** gives us the clean storage example.

Follow the current path:

## A. A volume or enable control changes

**Open:** [`client/src/page-controllers/project-player-page-controller.ts`](../client/src/page-controllers/project-player-page-controller.ts)  
**VS Code:** [jump to `handleTrackListInput()` at line 746](../client/src/page-controllers/project-player-page-controller.ts#L746)

The live audio engine is updated immediately at **786** for volume and **795–798** for enabled state.

## B. The `change` event persists the mix

**VS Code:** [jump to `handleTrackListChange()` at line 958](../client/src/page-controllers/project-player-page-controller.ts#L958)

That calls `persistCurrentMixSettings()`.

## C. Persistence currently knows about concrete browser storage functions

**VS Code:** [jump to `persistCurrentMixSettings()` at line 923](../client/src/page-controllers/project-player-page-controller.ts#L923)

For a Viewer it directly calls:

```ts
saveViewerMixSettings(...)
```

For Owner/Contributor it calls `rememberPendingMixSettings()`, which directly calls `savePendingMixSettings()` at **829–833**.

Those storage helpers default to `globalThis.localStorage`.

## After the Phase 1 split

Both UI clients should do something conceptually like:

```text
Desktop horizontal fader ─┐
                          ├─→ shared mix persistence
Mobile vertical fader ────┘          │
                                     ▼
                              StorageProvider
                                     │
                     ┌───────────────┴──────────────┐
                     ▼                              ▼
       BrowserLocalStorageProvider       future native provider
           V2 desktop + mobile             Capacitor if needed
```

So the desktop/client code can have a horizontal slider and the mobile client can have a vertical slider, but **neither one owns the recovery-storage rules**.

That is the separation we are trying to create:

```text
UI decides: "the user changed channel 2 to 64%."

shared behavior decides:
"remember it, debounce it, save it, recover it if necessary."

platform provider decides:
"where does the small recovery value physically live?"
```

This is a very small abstraction with a large future payoff.

---

# 18. What I expect the folder boundary to look like after the first pass

This is a **target**, not a requirement that every file move immediately.

```text
grooveshare/
│
├── client/                         # desktop + tablet presentation
│   └── src/
│       ├── app.ts
│       ├── main.ts
│       ├── pages/
│       ├── templates/
│       ├── page-controllers/
│       ├── router/
│       └── css/
│
├── mobile-client/                  # phone presentation
│   └── src/
│       ├── app.ts
│       ├── main.ts
│       ├── pages/
│       ├── templates/
│       ├── page-controllers/
│       ├── router/
│       └── css/
│
├── packages/
│   ├── frontend-core/
│   │   └── src/
│   │       ├── types.ts
│   │       ├── permissions/
│   │       ├── api/
│   │       ├── platform/
│   │       │   ├── session-provider.ts
│   │       │   └── storage-provider.ts
│   │       ├── mix/
│   │       │   └── mix-persistence.ts
│   │       └── playback/
│   │           └── playback-engine.ts
│   │
│   └── test-runner/
│
└── server/
```

A browser-specific implementation may live in the shared package if both current clients genuinely use it, or beside the clients if it is cleaner. We should make that decision based on actual imports rather than trying to create a theoretically perfect package tree before coding.

---

# 19. What should *not* go into `frontend-core` during Phase 1

The first pass should stay conservative.

These should normally remain presentation-specific:

```text
HTML page renderers
Project Player markup
mobile bottom navigation
three-dot menu markup
inline editing behavior
modal editing behavior
CSS layout
phone fader layout
desktop/tablet mixer layout
DOM querySelector wiring
focus/hover/touch presentation behavior
```

We also do not need to create a component framework, global state library, design-system package, or universal modal system simply because there are now two clients.

If a piece of code only has one consumer, it can stay where it is until the second client actually needs it.

---

# 20. What is already prepared better than it may look

Several current decisions make this split lower-risk:

### Dependency injection already exists in multiple places

- `createGrooveShareApp()` accepts `authenticationApi`;
- storage helpers accept a `StorageLike` implementation;
- controllers accept API objects rather than importing every API internally;
- audio tests inject fake audio elements;
- router history is behind a `HistoryAdapter`.

### Server authorization is already authoritative

The shared frontend permission helpers control what the UI exposes, but the server remains the security boundary. That means two clients can safely present different controls without creating two security models.

### The monorepo already supports packages

`packages/*` is already a root workspace, so `packages/frontend-core` fits naturally.

### The mobile UI work is already isolated enough to become a starting presentation

The mobile-specific behavior is visible in clear places such as:

- `responsive.css`;
- `mobile-navigation.ts`;
- Project Player modal editing;
- mobile Project Player header/actions.

We are not starting from a giant framework component with dozens of platform flags.

---

# 21. The first-pass migration strategy I would use

The safest order is **add seams before moving behavior**.

```text
1. Establish frontend-core package and platform contracts.
        ↓
2. Make the current single client use those contracts.
        ↓
3. Put HTML-audio playback behind PlaybackEngine.
        ↓
4. Extract only the shared behavior we now have confidence in.
        ↓
5. Create mobile-client as the second presentation consumer.
        ↓
6. Let client return to desktop/tablet interaction choices.
        ↓
7. Prove both clients against the same server and data.
```

That order is important.

If we copy the whole client first and refactor afterward, we create two copies of coupled code and then have to chase changes across both.

If we first make the platform seams explicit in the existing client, then the second client can start by consuming those seams.

---

# 22. What success looks like at the end of Milestone 6

We do **not** need a perfect architecture diagram or zero duplicated UI code.

We need to prove this:

```text
Desktop/tablet client
        │
        ├─ signs in
        ├─ opens Project A
        ├─ plays Project A
        ├─ changes Project A
        └─ persists mix safely

Mobile client
        │
        ├─ signs in to the same server
        ├─ opens the same Project A
        ├─ plays the same uploaded tracks
        ├─ changes the same permitted data
        └─ persists mix through the same shared rules
```

And these should be true:

```text
Desktop UI can evolve without requiring phone-specific conditionals.
Mobile UI can evolve without rewriting desktop interaction.
Storage implementation is injected through a platform boundary.
Authentication/session behavior is injected through a platform boundary.
Playback UI talks to a PlaybackEngine contract.
Shared permissions/types/API behavior do not get duplicated.
```

If that works, we have crossed the bridge. Version 3 can decide how much farther the refactor deserves to go after real beta use and recording.

---

# 23. Suggested files to keep open while we start Checkpoint 1

These are the files I would keep in VS Code tabs during the first architecture work:

- [`package.json`](../package.json) — workspace/build boundary;
- [`client/src/main.ts`](../client/src/main.ts) — presentation entry point;
- [`client/src/app.ts`](../client/src/app.ts) — current composition root;
- [`client/src/types.ts`](../client/src/types.ts) — easiest shared-core candidate;
- [`client/src/permissions/project-permissions.ts`](../client/src/permissions/project-permissions.ts) — clean shared behavior;
- [`client/src/api/api-client.ts`](../client/src/api/api-client.ts) — browser/session transport assumption;
- [`client/src/api/auth-api.ts`](../client/src/api/auth-api.ts) — existing auth abstraction;
- [`client/src/storage/pending-mix-storage.ts`](../client/src/storage/pending-mix-storage.ts) — storage boundary candidate;
- [`client/src/page-controllers/project-player-page-controller.ts`](../client/src/page-controllers/project-player-page-controller.ts) — where shared/presentation concerns currently meet;
- [`client/src/page-controllers/audio-player-controller.ts`](../client/src/page-controllers/audio-player-controller.ts) — playback interface extraction point;
- [`client/src/pages/project-player-page.ts`](../client/src/pages/project-player-page.ts) — current combined desktop/mobile presentation;
- [`client/src/css/_imports/responsive.css`](../client/src/css/_imports/responsive.css) — current dedicated phone presentation.

---

# 24. Short version: what is changing and what is not

```text
CURRENT

client/
  UI + mobile UI + desktop UI
  API
  auth
  localStorage access
  mix persistence
  permissions
  types
  audio engine + audio UI


PHASE 1 TARGET

client/                         mobile-client/
  desktop/tablet UI               phone UI
  desktop editing                 modal editing
  desktop navigation              mobile navigation
          \                       /
           \                     /
            @grooveshare/frontend-core
              API / domain types
              permission rules
              session contract
              storage contract
              mix persistence
              playback contract
                       │
                       ▼
                  same server
```

The goal is **not less code at all costs**. The goal is to put code at the level where it belongs so that mobile and desktop can intentionally become different products without duplicating the rules that make them GrooveShare.
