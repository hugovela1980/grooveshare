# @hugovela/frontend-core

`frontend-core` is the presentation-independent frontend boundary shared by GrooveShare presentation clients.

## Current shared responsibilities

The package owns behavior and contracts that have a clear reason to mean the same thing in every presentation:

- shared project, track, user, membership, invitation-access, invitation-session, and mix domain types;
- project permission rules;
- `SessionProvider` and `StorageProvider` platform contracts;
- `PlaybackEngine`, the shared project `Transport`, and shared Web Audio playback;
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

### Stage 5 — final ownership boundary

Stage 5 removes the temporary presentation-local API/router/storage forwarding files and moves create-project draft behavior into the shared core. Shared service, routing, storage, permission, invitation, and project-draft tests now live with the code they protect rather than being repeated in desktop/mobile suites.

The remaining overlap between `client/` and `mobile-client/` is presentation code: templates, page controllers, UI utilities, CSS, development UI, and small composition roots. Identical presentation files are not automatically shared; they may diverge as the desktop/tablet and phone experiences evolve.

Future features should begin here when they define product/application meaning. Recording state, recording use-cases, permissions, synchronization rules, and engine contracts should therefore be modeled in shared code before either presentation wires its device-specific controls.


## Version 3 audio-transport direction

### Milestone 1 Stage 1 — shared Transport and timeline foundation

Version 3 begins by separating the GrooveShare project timeline from the concrete Web Audio playback engine. `Transport` is now the shared, presentation-independent owner of:

- project position and duration;
- stopped, paused, playing, and ended state;
- loop state;
- play, pause, stop, seek, and relative-seek timeline transitions;
- observable transport snapshots.

`WebAudioPlaybackEngine` supplies `AudioContext.currentTime` as the Transport clock. While playback is running, that clock is the source of truth for elapsed project time. The 100 ms snapshot ticker only publishes observations to UI subscribers; it does not advance playback or transport state.

For the current zero-offset stem model, project time zero means the beginning of every loaded source, and project duration is the duration of the longest decoded source. Shorter tracks are allowed to end without ending the shared project timeline. Later Milestone 1 stages will separate source scheduling more explicitly, harden loop scheduling, and add recording timeline markers without introducing microphone capture yet.

### Milestone 1 Stage 2 — shared playback scheduling and alignment

Stage 2 makes the Transport the authority that turns the current project
position plus a small scheduling lead into one `PlaybackScheduleInstruction`.
That instruction contains the absolute audio-clock start time, project playback
position, project duration, and loop state that every Web Audio source in the
same playback generation must obey.

`WebAudioPlaybackEngine` still owns decoded buffers, GainNodes,
`AudioBufferSourceNode` creation/destruction, enabled state, and live volume.
It no longer computes absolute source start times or independently reads the
project position for each source. Initial play, resume, and seek request one
instruction from Transport and schedule all playable sources from that single
immutable instruction.

Mixed-duration semantics remain unchanged: the longest decoded track defines
the project duration and shorter tracks may end naturally without completing
the Transport.

### Milestone 1 Stage 3 — hardened controls and clock-scheduled looping

Stage 3 makes transport lifecycle semantics explicit enough for recording to
rely on them. Play begins from the current project position, pause freezes that
position against the Web Audio clock, stop always returns to project time zero,
and seek/relative seek remain bounded by the shared project timeline whether
the transport is stopped, paused, or playing. Repeated transitions recreate
one-shot Web Audio sources from one shared scheduling instruction so source
generations do not drift apart.

Natural project completion and loop position are now derived from the
Transport's authoritative clock rather than from an `AudioBufferSourceNode`
`onended` callback. `PlaybackScheduleInstruction` includes the exact clock time
at which its project segment ends. When looping is enabled, the Web Audio engine
pre-schedules the next source generation at that exact boundary and keeps one
future generation scheduled ahead. The 100 ms Transport ticker only maintains
that ahead-of-time queue and publishes UI observations; it does not choose the
actual loop start time.

This means JavaScript callback latency no longer defines the loop boundary.
Every loop generation starts at an absolute AudioContext clock time chosen by
Transport. Turning loop off cancels future scheduled generations without
interrupting the currently playing generation.

### Milestone 1 Stage 4 — recording timeline primitives and track placement

Stage 4 adds the timing vocabulary that microphone capture will use without
implementing microphone access or recording UI. `Transport.markTimelinePosition()`
captures the authoritative audio-clock value and the project position derived
from that same clock read. `RecordingTimeline` turns those exact observations
into recording-start and recording-stop markers plus shared
`RecordingPositionMetadata`.

Recording duration is calculated from the authoritative audio clock rather
than by subtracting project positions. That distinction matters when project
position wraps at a loop boundary: a recording may start near the end of a
loop, stop near the beginning of the next pass, and still have an unambiguous
positive duration.

The shared `Track` domain type now reserves optional `timelineOffsetSeconds` as
the place where a future recorded track can declare that its audio begins at a
non-zero project position. Existing uploaded stems omit the field and continue
to mean project time zero. Stage 4 does **not** add database persistence for the
offset; that belongs with the recording/upload workflow that begins in the
next milestone.

`WebAudioPlaybackEngine` exposes optional recording-marker methods through the
existing playback seam because its `AudioContext.currentTime` clock is precise
enough to support them. The HTML-audio fallback deliberately does not claim
recording-clock capability.

Still deferred: microphone capture, MediaRecorder/Web Audio input plumbing,
automatic input-latency compensation, device calibration, manual nudge,
waveform editing, punch-in/out, and other DAW-grade correction/editing tools.
