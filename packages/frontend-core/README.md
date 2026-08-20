# @hugovela/frontend-core

`@hugovela/frontend-core` is GrooveShare's presentation-independent frontend package.

It contains shared product meaning, application workflows, service behavior, permissions, mix persistence, and audio/timeline behavior that should be identical whether GrooveShare is being presented by the desktop/tablet client or the phone client.

## Dependency boundary

```txt
frontend-core
    ↑
frontend-browser
    ↑            ↑
 client      mobile-client
```

`frontend-core` must not import:

- `client/`;
- `mobile-client/`;
- `@hugovela/frontend-browser`;
- presentation CSS;
- page DOM/rendering code.

The root architecture check enforces this boundary:

```bash
npm run frontend:boundaries
```

## Package areas

### `application/`

Owns shared application state and use-case coordination.

Important modules include:

- `application-state.ts` — authentication, selected-project, invitation, loading, and error state.
- `application-navigation.ts` — shared screen/route/action vocabulary.
- `application-presentation.ts` — `ApplicationPresentationPort`, which lets shared application code request presentation changes without rendering HTML.
- `grooveshare-application-controller.ts` — the shared application state machine used by both presentation clients.
- `invitation-guest-workflow.ts` — collaboration invitation and Guest-access lifecycle.
- `project-draft-state.ts` — presentation-independent create-project draft behavior.

`GrooveShareApplicationController` currently coordinates:

- session restoration and authentication state;
- Projects/Project Player application state;
- selected project;
- project loading and route protection;
- navigation decisions;
- invitation/Guest behavior;
- post-auth Contributor continuation;
- logout and expired-session recovery;
- presentation state sent through `ApplicationPresentationPort`.

### `domain/`

Owns shared domain types such as:

- `User`;
- `Project`;
- `Track`;
- `ProjectRole`;
- `ProjectMember`;
- mix settings;
- project/track/authentication service inputs.

`Track.timelineOffsetSeconds` is reserved for tracks that begin at a non-zero project position. Existing uploaded stems omit it and therefore begin at project time zero. Database persistence for recording offsets is intentionally deferred until the recording workflow is implemented.

### `services/`

Owns presentation-independent API/service behavior for:

- authentication;
- projects and shared mix settings;
- tracks;
- project memberships;
- collaboration invitations.

Services depend on abstract capabilities such as `ApiTransport` and `MultipartBodyFactory`. They do not call browser `fetch` or construct `FormData` directly.

Concrete browser implementations live in `@hugovela/frontend-browser`.

### `permissions/`

Owns frontend permission interpretation used to present valid controls:

- contribute;
- manage project;
- persist shared mix;
- manage a specific track.

These rules improve UI behavior but do not replace server authorization. The server remains the security boundary.

### `mix/`

Owns shared mix-persistence behavior:

- browser-local Viewer mixes;
- browser-local Guest mix key remapping;
- pending Owner/Contributor recovery copies;
- debounced server persistence;
- overlapping-save/revision protection;
- flush-before-controlled-navigation semantics.

The presentation decides when a mix control changes; the core decides how that state should persist.

### `platform/`

Contains abstract platform contracts such as:

- `SessionProvider`;
- `StorageProvider`;
- invitation-session persistence.

These let application behavior remain independent of `localStorage`, `sessionStorage`, or another future platform implementation.

### `playback/`

Owns shared playback/audio timing behavior.

The UI-facing seam is `PlaybackEngine`:

```ts
interface PlaybackEngine {
  loadMix(...): void;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  seekBy(seconds: number): void;
  setLoopEnabled(enabled: boolean): void;
  // ...
}
```

The primary implementation is `WebAudioPlaybackEngine`.

## Shared Transport

`Transport` is the authoritative GrooveShare project timeline.

It owns:

- project position and duration;
- `stopped`, `paused`, `playing`, and `ended` state;
- loop state;
- play, pause, stop, seek, and relative-seek transitions;
- observable transport snapshots;
- exact playback scheduling instructions;
- exact timeline markers for future recording.

The Web Audio engine supplies:

```ts
getClockTime: () => audioContext.currentTime
```

While playback is running, `AudioContext.currentTime` is therefore the authoritative clock. UI timers only request/publish snapshots; they do not advance time.

### Playback scheduling

`Transport.play()` produces one `PlaybackScheduleInstruction` containing values such as:

- absolute audio-clock start time;
- absolute audio-clock end time;
- project playback position;
- project duration;
- loop state.

Every active `AudioBufferSourceNode` in that playback generation receives the same instruction. Pause/resume and seek recreate one-shot source nodes against a new shared instruction rather than allowing individual media clocks to drift.

Project duration is currently the longest decoded source. Shorter tracks may end naturally without ending the shared Transport.

### Looping

Loop boundaries are scheduled against absolute AudioContext clock times. The Web Audio engine maintains an ahead-of-time loop generation rather than waiting for `AudioBufferSourceNode.onended` to decide when the next loop should start.

This keeps JavaScript callback latency out of the actual loop boundary.

## Recording timeline foundation

The package contains `recording-timeline.ts`, which provides presentation-neutral timing primitives without microphone capture.

`Transport.markTimelinePosition()` captures one exact observation:

```ts
{
  clockTimeSeconds,
  projectPositionSeconds,
  playbackState,
}
```

`RecordingTimeline` converts those observations into:

- `RecordingStartMarker`;
- `RecordingStopMarker`;
- `RecordingPositionMetadata`.

Recording duration is calculated from the authoritative audio clock rather than by subtracting project positions. This matters if project position wraps across a loop boundary.

`WebAudioPlaybackEngine` exposes optional `markRecordingStart()` / `markRecordingStop()` methods through `PlaybackEngine`. The HTML-audio fallback intentionally does not claim recording-grade clock capability.

Not implemented yet:

- microphone capture;
- MediaRecorder/Web Audio input plumbing;
- persistence of recorded-track offsets;
- input-latency compensation;
- device calibration;
- manual nudge;
- waveform editing;
- punch-in/out or comping.

## What does not belong here

Keep these outside `frontend-core`:

- HTML rendering and templates;
- CSS/layout;
- DOM queries/event wiring;
- desktop/mobile-specific navigation;
- touch/gesture behavior;
- browser `fetch`;
- browser `File`/`FormData` construction;
- direct `localStorage` / `sessionStorage` access;
- browser history and clipboard APIs.

Browser implementations of abstract capabilities belong in `@hugovela/frontend-browser`; presentation-specific behavior belongs in `client/` or `mobile-client/`.

## Tests

Run the package tests and typecheck from the repository root:

```bash
npm run test-frontend-core
```

Or separately:

```bash
npm test -w @hugovela/frontend-core
npm run typecheck -w @hugovela/frontend-core
```

The package test suite covers application contracts/controller behavior, invitations/Guest workflows, permissions, project draft state, services, mix storage/persistence, HTML-audio fallback behavior, Transport behavior, recording timeline markers, and Web Audio scheduling/synchronization.

Full repository verification:

```bash
npm run verify
```

## Rule for new features

A useful first question is:

> Does this define what GrooveShare does, or only how one client presents it?

If it defines shared product/application meaning, model it here first. That is especially important for recording: shared recording state, timeline relationships, save/discard semantics, permissions, and recording-engine contracts should have one authoritative implementation before desktop and mobile add their own controls.
