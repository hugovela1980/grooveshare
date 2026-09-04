# GrooveShare Architecture

## Purpose

GrooveShare is a lightweight browser-based music collaboration application for sharing stems, practicing parts, building rough mixes, inviting collaborators, and moving toward simple remote recording.

It is not intended to become a full DAW. The architecture is designed around a focused band workflow:

1. Create a project.
2. Add audio tracks.
3. Invite trusted collaborators or share temporary Guest access.
4. Listen to synchronized project audio.
5. Adjust a simple four-channel mix.
6. Manage project membership and contribution permissions.
7. Record rough takes against the same project timeline.
8. Add more advanced collaboration/audio tools only when real usage justifies them.

The project favors understandable module boundaries and incremental refactoring over premature framework or infrastructure complexity.

## Current Direction

The repository uses `main` as the production/release branch and `develop` as the integration branch.

The current `develop` branch contains:

- the completed **Version 2.2 Shared Frontend Application Layer**;
- separate desktop/tablet and phone presentation clients;
- shared browser adapters in `@hugovela/frontend-browser`;
- the completed pre-recording work for **Version 3 Milestone 1 — Recording-Capable Web Audio Engine and Transport**;
- the current **Version 3 Milestone 2** musical-timeline/recording foundation, including project/track musical placement, browser microphone capture, local take review/normal-track upload, and timeline-aware playback/seeking.

Milestone 2 intentionally stops before waveform editing, automatic latency calibration/compensation, punch recording, comping, warping/time stretching, and advanced monitoring/routing.

## Architectural Principles

- **The server is the security boundary.** Frontend permission checks exist for usability, not authority.
- **Shared product behavior has one implementation.** Desktop and mobile should not independently implement the same application workflow.
- **Presentation is allowed to diverge.** Desktop/tablet and phone layouts/interactions are intentionally separate.
- **Browser mechanics are not product logic.** `fetch`, browser storage, history, `FormData`, clipboard, and similar capabilities live in browser adapters.
- **One project timeline drives audio.** Playback, musical seeking, track placement, and recording markers use the same authoritative transport/timeline model.
- **Metadata and audio bytes are separate concerns.** PostgreSQL stores structured data; the filesystem stores uploaded audio.
- **One API contract should survive infrastructure changes.** A future move from VPS hosting to a home server should primarily be a deployment change.
- **Production and Labs data remain isolated.** Integration testing must not modify production data or uploads.
- **Development-only tooling must be unavailable in production.**
- **Secrets and runtime configuration stay outside Git.**

## Repository and Workspaces

```txt
grooveshare/
├── client/                         # desktop/tablet presentation
├── mobile-client/                  # phone presentation
├── server/
│   ├── db/migrations/
│   ├── src/
│   └── tests/
├── packages/
│   ├── frontend-core/              # shared product/application/audio behavior
│   ├── frontend-browser/           # shared browser adapters and shell
│   └── test-runner/                # internal TypeScript test runner
├── scripts/
│   ├── verify.mjs
│   └── check-frontend-boundaries.mjs
├── docs/
├── sample-audio-files/
├── package.json
└── README.md
```

The npm workspaces are:

```txt
client
mobile-client
grooveshare-server
@hugovela/frontend-core
@hugovela/frontend-browser
@hugovela/test-runner
```

A single root `package-lock.json` controls workspace dependency installation.

`backlog.md` is intentionally kept as a private local planning document and is ignored by Git.

## System Overview

At runtime, GrooveShare is still a centralized application:

```txt
presentation client
       ↓
shared frontend application/services
       ↓
Node HTTP API
       ↓
PostgreSQL metadata + filesystem audio
```

Hosted request flow:

```txt
Internet
   ↓
HTTPS
   ↓
Caddy
   ├── /api/* → Node API
   ├── phone → mobile-client/dist
   └── desktop/tablet → client/dist
                         ↓
                    PostgreSQL
                         +
                    audio files
```

The public web application and API use the same production origin. This simplifies cookie behavior, CORS, invitation URLs, and future hosting changes.

## Environment Model

### Local Development

Typical local services:

```txt
Desktop Vite: http://localhost:5173
Mobile Vite:  http://localhost:5174
Node API:     http://127.0.0.1:3000
Development:  grooveshare_dev
Tests:        grooveshare_test
```

The desktop client normally uses `http://localhost:3000` as its development API base. The mobile Vite server proxies `/api` to `127.0.0.1:3000`, which also supports the USB/ADB phone-development workflow without adding another server CORS origin.

### Labs

Labs is the internet-accessible integration environment for `develop`:

```txt
Hostname: labs.grooveshare.hugovela.com
Checkout: /srv/grooveshare-labs
Node:     127.0.0.1:3001
Database: grooveshare_labs
DB role:  grooveshare_labs_app
Uploads:  /var/lib/grooveshare-labs/uploads
Service:  grooveshare-labs.service
```

### Production

Production is released from `main`:

```txt
Hostname: grooveshare.hugovela.com
Checkout: /srv/grooveshare
Node:     127.0.0.1:3000
Database: grooveshare_prod
DB role:  grooveshare_app
Uploads:  /var/lib/grooveshare/uploads
Service:  grooveshare.service
```

Desired branch flow:

```txt
feature branch
      ↓
develop
      ↓
Labs integration/testing
      ↓
release decision
      ↓
main
      ↓
production
```

## Frontend Architecture

Version 2.2 established two independent presentation clients over one shared application layer and one shared browser-adapter layer.

```txt
                   packages/frontend-core
        domain + application + services + audio
                              ↑
                 packages/frontend-browser
           fetch + storage + history + browser shell
                       /             \
                      /               \
                client/          mobile-client/
             desktop/tablet           phone
```

### `@hugovela/frontend-core`

`frontend-core` owns presentation-independent meaning:

- domain types;
- permissions;
- application state/navigation/presentation contracts;
- `GrooveShareApplicationController`;
- invitation/Guest workflow;
- create-project draft state;
- shared frontend services;
- mix storage/persistence behavior;
- playback contracts/implementations;
- shared Transport and recording timeline primitives;
- abstract platform ports.

It contains no page rendering, CSS, or desktop/mobile DOM assumptions.

### `@hugovela/frontend-browser`

`frontend-browser` implements browser-specific mechanisms used by both presentations:

- `fetch` and cookie credentials;
- authentication-required/401 notification;
- `File`/`FormData` multipart upload adaptation;
- `localStorage` / `sessionStorage` adapters;
- invitation-session persistence;
- invitation-link construction and clipboard copying;
- hash/history routing;
- browser frontend service construction;
- browser/device output-route keepalive compatibility for mobile USB audio adapters;
- the shared browser application shell.

It does not render desktop or phone markup.

### Presentation clients

`client/` owns desktop/tablet HTML, CSS, DOM controllers, inline editing, layout, and interaction choices.

`mobile-client/` owns the phone presentation, mobile navigation, touch-oriented editing/dialogs, layout, and device-specific interaction choices.

The clients may intentionally diverge. Shared behavior should move only when it is truly product/application/browser behavior, not simply because two presentation files currently look similar.

See [`frontend-clients.md`](frontend-clients.md) for detailed placement rules.

## Shared Application Flow

A typical open-project action now crosses the frontend boundary like this:

```txt
user interaction
      ↓
presentation page controller
      ↓
shared browser application shell
      ↓
GrooveShareApplicationController
      ↓
ProjectsService
      ↓
ApiTransport
      ↓
server
```

The response returns as application/presentation state:

```txt
server data
   ↓
GrooveShareApplicationController
   ↓
ApplicationPresentationPort
       /                 \
 desktop adapter      mobile adapter
       ↓                 ↓
 desktop UI           phone UI
```

The shared controller decides **what** application state/screen should be shown. Each client decides **how** to render and interact with it.

## Backend Architecture

The backend is a native Node HTTP server with explicit store interfaces.

Runtime composition in `server/src/server.ts` currently wires PostgreSQL implementations for:

- projects;
- tracks;
- users;
- sessions;
- project memberships;
- project invitations.

`createAppServer()` receives those stores as dependencies rather than importing a database implementation directly. This keeps HTTP/application behavior separated from persistence details and makes store-level testing easier.

Legacy JSON project/track store implementations remain in the repository, but the runtime server uses PostgreSQL.

### Server responsibilities

The server owns:

- authentication/session authority;
- role and project authorization;
- project CRUD;
- track metadata and upload ownership;
- audio upload validation/storage;
- byte-range audio streaming;
- mix persistence;
- membership management;
- invitation lifecycle and Guest authorization;
- development-only seed/reset routes when explicitly enabled.

## Authentication and Sessions

Conceptually:

```txt
register/login
     ↓
server validates credentials
     ↓
server creates session token
     ↓
hash/session metadata stored in PostgreSQL
     ↓
raw token returned as HttpOnly session cookie
     ↓
later browser request includes cookie
     ↓
server resolves current user
```

Production enables secure cookie settings. Password hashes and raw server-side secrets are never exposed as public user data.

## Authorization and Access

### Membership roles

`owner`, `contributor`, and `viewer` are persistent project memberships.

- **Owner**: project management, all track management, member management, invitation management, shared mix persistence.
- **Contributor**: upload tracks, manage their own uploaded tracks, persist the shared mix.
- **Viewer**: read/listen access with browser-local personal mix behavior.

The server authorizes every protected operation independently of the frontend's visible controls.

### Guest invitations

Guest access is deliberately separate from membership.

The server stores one reusable invitation record per project. The browser receives the raw invitation token; only its hash is persisted server-side.

A valid invitation can grant an unauthenticated Guest read-only access to project/track/audio data. Guest access does not create Viewer membership.

The shared frontend invitation workflow handles:

- opening/revalidating an invitation;
- revoked/disabled/regenerated links;
- Guest state;
- pending Contributor intent;
- login/register continuation;
- explicit Contributor acceptance;
- fallback to Guest after logout/session expiry where appropriate.

## Data Storage

### PostgreSQL

PostgreSQL is the authoritative store for structured application data.

Current schema evolution lives under:

```txt
server/db/migrations/
```

Migrations currently cover the initial project/track schema plus users, sessions, memberships, upload ownership, project invitations, musical placement/alignment metadata, and playback-derivative lifecycle metadata.

Operational rule: if a migration is executed by a PostgreSQL administrative role, newly created objects must still be owned by or granted to the runtime GrooveShare database role. Creating a table as `postgres` without application-role privileges can leave production code unable to use that table even though the migration itself succeeded.

### Filesystem audio

Uploaded audio bytes are stored on disk rather than in PostgreSQL. Each track's existing file path, MIME type, size, and original filename describe the authoritative original. PostgreSQL also models one disposable, regeneratable playback derivative with `pending`, `processing`, `ready`, or `failed` status and nullable artifact metadata. New and legacy tracks start pending with profile version `opus-playback-v1`; later backfill work will handle legacy media.

The server persists a newly uploaded original before awaiting playback-derivative generation. A reusable generator invokes FFmpeg/libopus with the versioned Ogg/Opus, 48 kHz, 256 kbps VBR profile, writes to a temporary sibling artifact, and uses FFprobe to verify a non-empty Opus audio stream, sample rate, and positive duration before atomic finalization and `ready` persistence. Generation or validation failure cleans partial artifacts, records `failed`, and never invalidates the original. Kept recorded takes use this same upload path. The generator can be reused for regeneration and future backfill; authenticated derivative delivery remains Milestone 4.

Production and Labs use persistent upload directories outside their Git checkouts. Deploying application code therefore does not replace uploaded audio.

### Project and track metadata

A project includes identity, title/description, timestamps, role/access information on frontend representations, and optional mix settings.

A track includes project identity, name/original filename, MIME/file size/path metadata, uploader identity where available, creation time, and authoritative musical placement (`start` bar/beat plus optional `spanBeats`).

Persisted musical placement is the normal source of truth for where a track begins on the project timeline. `timelineOffsetSeconds` remains an optional shared-domain bridge for transport/legacy callers, but playback derives seconds placement from musical metadata whenever the project musical timeline is available.

## Mix Persistence

`frontend-core` owns the shared persistence policy.

### Owner/Contributor

Shared mix changes are remembered locally as a recovery copy, then debounced before saving to the server. The coordinator protects against overlapping saves/revisions and can flush pending state before controlled navigation.

### Viewer

Viewer mix changes are personal and stored only in browser storage.

### Guest

Guest mix behavior reuses the read-only/local policy but remaps storage to a Guest-specific project key so Guest state remains distinct from authenticated Viewer state.

## Project Drafts and Uploads

Create-project draft state lives in `frontend-core` and is generic over the platform's audio-file type. Browser presentations can specialize the file value to `File` without making `frontend-core` depend on DOM types.

Track upload service behavior is shared. Browser `FormData` creation is provided by `frontend-browser` through the `MultipartBodyFactory` boundary.

Server-side upload handling validates the multipart request and audio file before persisting metadata and writing bytes to the configured upload root.

## Audio Architecture

The current audio architecture is the foundation for Version 3 recording.

### UI-facing playback seam

Both presentation clients depend on the shared `PlaybackEngine` contract rather than directly controlling Web Audio nodes.

Current operations include:

- load mix;
- play;
- pause;
- stop;
- seek / relative seek;
- musical seek by project bar/beat;
- loop enable/disable;
- channel volume/enable changes;
- snapshots/subscriptions that expose both elapsed seconds and musical bar/beat position;
- optional recording timeline markers on recording-capable engines.

### Primary Web Audio engine

`WebAudioPlaybackEngine` fetches/decodes project audio into `AudioBuffer`s and owns:

- decoded channel buffers;
- per-channel `GainNode`s;
- one-shot `AudioBufferSourceNode` lifecycle;
- source scheduling from shared Transport instructions;
- ahead-of-time loop source generations;
- live volume/enable changes.

All sources share one `AudioContext`.

### Transport

`Transport` is presentation-independent and owns the GrooveShare project timeline.

```txt
AudioContext.currentTime
        ↓
     Transport
        ↓
PlaybackScheduleInstruction
        ↓
all active source nodes
```

Transport state includes:

```txt
positionSeconds
musicalPosition: { bar, beat }
durationSeconds
playbackState: stopped | paused | playing | ended
loopEnabled
```

The musical position is derived from the same transport position using the project's BPM and time signature. It is not maintained as a second clock. Fractional beats are preserved, while tiny floating-point noise at exact beat/bar boundaries is normalized so exact musical boundaries remain exact.

While playback is running, elapsed position is derived exclusively from the supplied clock (`AudioContext.currentTime` in the Web Audio implementation).

The 100 ms interval used by the engine/Transport is observational and maintenance-oriented: it publishes snapshots, prunes completed generations, and maintains ahead-of-time loop scheduling. It does not advance the authoritative timeline.

### Scheduling and alignment

`Transport.play()` creates one immutable `PlaybackScheduleInstruction` with:

- `startAtClockTime`;
- `endAtClockTime`;
- `projectPositionSeconds`;
- `durationSeconds`;
- `loopEnabled`.

Each track is scheduled against that same project instruction. Persisted `musicalPlacement.start` is authoritative when present and is converted to project seconds inside `frontend-core`; legacy `timelineOffsetSeconds` remains a compatibility fallback. Tracks beginning at project time zero start at the generation boundary; tracks with a later musical start are scheduled at the corresponding future AudioContext clock time. When playback begins after a track's start, its source offset is derived from the difference between the current project position and the track start.

Pause/resume and seek discard/recreate one-shot source generations from a new shared instruction. Web Audio project duration is the latest musical track end (`track start + decoded duration`), so later-starting recordings remain aligned without padding their files with artificial leading silence.

### Loop scheduling

Loop restarts are not driven by a late `onended` callback.

When looping is enabled, the Web Audio engine uses Transport to create the next generation's exact absolute clock boundary and schedules that generation ahead of time. Turning loop off cancels future scheduled loop generations without interrupting the generation currently playing.

### Recording timeline and microphone capture

`Transport.markTimelinePosition()` captures one exact observation of:

```txt
AudioContext clock time
project position derived from that same clock read
musical bar/beat derived from that project position
playback state
```

`RecordingTimeline` converts those observations into start/stop markers and `RecordingPositionMetadata`. Recording duration is calculated from audio-clock time, not merely `stopProjectPosition - startProjectPosition`, so duration remains correct even when project position wraps through a loop boundary.

Browser microphone mechanics are implemented by `@hugovela/frontend-browser` behind the shared `MicrophoneRecordingPort`. `frontend-core` owns authorization, recording state, and transport synchronization without depending directly on `navigator`, `MediaRecorder`, `MediaStream`, or browser `Blob` behavior.

For a new synchronized take from a stopped transport, browser microphone capture is started first and `MicrophoneRecordingPort.start()` does not resolve until the platform recorder reports that capture is active. Only then does the recording session ask the recording-capable playback engine to start project playback and return the authoritative scheduled start marker. This ordering prevents the first project transient from outrunning MediaRecorder startup. If the project was already playing, recording marks the existing authoritative transport position rather than restarting it.

The browser microphone adapter requests music-oriented capture by default (`echoCancellation: false`, `noiseSuppression: false`, `autoGainControl: false`) while keeping all browser APIs and constraint behavior inside `frontend-browser`. Checkpoint 5C also requests a single captured channel (`channelCount: { ideal: 1 }`). The 5D hardening pass makes that requirement enforceable rather than advisory: when a route still reports multiple channels, `frontend-browser` first applies an exact one-channel track constraint and, if the device/browser refuses it, feeds MediaRecorder from a browser-only Web Audio mono downmix stream. This keeps ordinary microphone/interface recordings genuinely mono so input 1 cannot become a left-only stereo recording while preserving browser/device mechanics outside `frontend-core`. Hardware validation remains required because capture-route behavior varies. Platform latency that remains after those constraints is treated separately from the musical timeline.

Checkpoint 5C makes the capture lifecycle explicit. A successfully prepared microphone stream is intentionally retained through stopped-take review and Retry so repeated takes stay low-friction. While the session is ready, the same control changes from **Enable Microphone** to **Disable Microphone**; disabling genuinely releases the prepared browser stream and returns the recording session to idle without clearing the locally remembered alignment compensation. The stream is also released on Discard, successful Keep, Reset/page teardown, and recording/device failure. If the browser reports that the previously prepared input track has ended (for example after an audio-route or USB-device change), the browser adapter discards that stale stream and reacquires a fresh music-oriented stream at the next prepare/start boundary. Pending MediaRecorder start/stop promises are rejected during teardown rather than being left unresolved.

When the take stops, the in-memory take preserves:

- exact transport/audio-clock start and stop metadata;
- `timelineOffsetSeconds` equal to the captured start project position;
- project musical start/stop positions;
- a musical span derived from authoritative clock elapsed time rather than raw encoded-file duration;
- `mediaLeadInSeconds` for encoded capture before the authoritative musical start.

A reviewed take can then be kept through a shared `RecordedTakeUploadPort`. The browser adapter converts the browser-neutral capture bytes into a `File` and delegates to the existing track upload service/multipart path rather than creating a recording-only server endpoint. The stored track receives the take's captured musical start and transport-clock-derived musical span, then the project player reloads it as a normal track. Temporary take audio is discarded only after a successful upload; failed uploads leave the reviewed take available for retry.

Checkpoint 5B adds a separate signed `alignmentOffsetSeconds` to tracks. This value corrects source/capture alignment without changing the track's declared musical start. Positive values advance captured content by skipping source audio; negative values delay source playback. Web Audio and the HTML-audio fallback apply the same source-to-project mapping. The manual compensation control is stored locally in whole milliseconds (fine/coarse 1/10/100 ms nudges, bounded to ±2000 ms) and the selected value is copied onto a kept take. It is deliberately not inferred from browser-reported latency values, because 5A showed that those values can omit substantial platform capture buffering. Checkpoint 5C deliberately preserves that locally remembered compensation across Retry, Discard/re-arm, and subsequent takes; it is a useful route-specific starting point, not a promise that every take has identical latency.

For the current V3 mobile recording baseline, GrooveShare recommends wired headphones so project playback does not bleed directly into the microphone while music-oriented speech processing is disabled. Bluetooth full-duplex behavior is not treated as a guaranteed recording path because mobile operating systems may switch Bluetooth profiles, playback quality, level, and latency when the headset microphone becomes active. Checkpoint 5C does not add software microphone monitoring; hardware/direct monitoring remains naturally usable where the user's equipment provides it.

Checkpoint 5C also hardens Android wired-headphone playback against USB-C DACs that aggressively auto-mute sparse Web Audio output. Real-device diagnostics showed a JXMOX USB-C-to-3.5 mm adapter could remain inaudible for several beats even while an analyser immediately before `AudioContext.destination` showed correctly timed project audio. Increasing Web Audio scheduling lead to multiple seconds did not help. A zero-mean 20 kHz keepalive at -54 dBFS made starts reliable. An initial short trial suggested 250 ms could be sufficient, but a longer cold-start run still clipped or lost the first transient; the production warm-up is therefore 400 ms. The tested route remained reliably awake for about 500 ms after activity stopped, so GrooveShare also uses a conservative 400 ms recent-activity window for rapid restarts. The compatibility decorator lives in `frontend-browser`, starts the keepalive only for playback/recording/review activity, stops it when playback becomes idle, and never changes project position, alignment compensation, or the shared 30 ms Web Audio scheduling lead. The measured constants are compatibility defaults, not musical timing values, and physical-device validation remains required because USB DAC behavior varies.

Checkpoint 5D adds a timeline-aware metronome and mandatory recording count-in to the shared Web Audio engine. Metronome clicks are sample-scheduled from the same `AudioContext` clock and project timeline as normal sources, so BPM, numerator/denominator beat spacing, seek/restart, and loop boundaries stay phase-aligned. Bar downbeats use a distinct accent. The optional Project Player **Click** control affects only normal metronome cues; recording count-in cues are a separate scheduled cue kind and cannot be canceled by toggling the optional metronome.

For a stopped-transport recording, capture is still made genuinely active before any project audio is scheduled. On mobile, the Android USB output compatibility layer then performs any required route warm-up while capture is already running. The shared playback engine schedules one full bar of count-in and schedules project playback to begin exactly on the following project beat/downbeat. The keepalive remains active through count-in and project playback. This device-preparation/count-in interval is intentionally not represented as musical placement or `alignmentOffsetSeconds`. Instead the take stores `mediaLeadInSeconds`, the encoded-media duration before the authoritative musical origin. Local audition and saved-track playback skip that structural lead-in, while signed alignment compensation is applied independently afterward.

Persisted `mediaLeadInSeconds` defaults to zero for legacy tracks and is stored in PostgreSQL by migration `010_track_media_lead_in.sql`. It is structural source metadata: it may include mobile output-route preparation plus the count-in scheduling interval, but it never moves the track's declared Bar/Beat start or changes its transport-clock-derived musical span.

The Project Player treats the user's **Go** position as a sticky recording-workspace anchor rather than incidental controller/UI state. `frontend-core` owns that state through `RecordingWorkspaceState`; browser storage is injected through the existing `StorageProvider` boundary. Authenticated browser sessions scope that persisted anchor by user + project so another account on the same device does not inherit it. A Go action changes the anchor. Record, Stop Recording, Audition, Retry, Keep, project-track refreshes, and mix reloads preserve it. The explicit Project Player **Stop** action is the reset command: it clears the anchor and returns the project to Bar 1 · Beat 1. Because the anchor is stored as a musical Bar/Beat position rather than raw seconds, it remains meaningful when a project is reconstructed after a browser reload. Playback engines also preserve their working transport position while a replacement mix decodes, so a data refresh cannot act like an accidental navigation command.

Checkpoint 5D recording hardening also makes a stopped, not-yet-kept take a first-class workflow object. The pending take owns its audio bytes, authoritative musical start/span, structural `mediaLeadInSeconds`, and the exact reviewed alignment compensation. **Keep** commits those values from that same take object; it does not reconstruct alignment from separate presentation/controller state. The Web Audio engine also auditions that pending take on the same AudioContext clock and through the same source-offset/alignment calculation used after Keep. The HTMLAudioElement review adapter remains only a fallback. This makes the invariant explicit: the alignment heard during normal Web Audio audition is the alignment the saved project track will use, rather than including platform-specific HTML media-element startup delay.

A stopped pending take is durably recoverable across browser reload/suspension. `frontend-core` defines the browser-neutral `RecordedTakeDraftPort`; `frontend-browser` implements it with IndexedDB so encoded audio bytes can be stored without DOM/IndexedDB types entering core. Draft keys are scoped to the current user/project when wired by the browser clients. The draft is saved after capture stops and is refreshed when reviewed alignment changes. Successful Keep, Retry, Discard, and Reset remove it; ordinary page/session destruction deliberately leaves it available for recovery. A restored take returns to the stopped/reviewable state without pretending that the microphone stream survived the reload; Retry therefore reacquires the microphone before another pass. Active in-progress capture is not claimed as recoverable—durability begins once a take has stopped and capture bytes exist. IndexedDB writes resolve only after the transaction commits.

This creates three deliberate durability levels for the recording workflow:

- project tracks and their persisted musical/alignment metadata live on the server;
- the user's sticky Go anchor is lightweight browser-persisted workspace state;
- a stopped pending take is a local IndexedDB draft until Keep/Retry/Discard/Reset resolves it.

The corresponding transition invariants are tested in `frontend-core` and at both presentation/controller boundaries. Platform code supplies storage mechanics; it does not redefine when recording state is allowed to reset.

### HTML-audio fallback

`HtmlAudioPlaybackEngine` remains available as a fallback implementation. It honors the same musical seek contract and track musical placement, including mapping a project seek into the correct local position inside a later-starting track. It still intentionally does not expose recording timeline markers because independent media-element timing is not treated as a recording-grade authoritative clock.

## Testing Architecture

The repository uses the internal `@hugovela/test-runner` package across workspaces.

Tests are owned by the layer they protect:

- `server/tests/` — routes, stores, authorization, database/migration behavior, uploads/configuration;
- `packages/frontend-core/tests/` — application, domain, services, permissions, mix, Transport, Web Audio, recording timeline;
- `packages/frontend-browser/tests/` — browser transport/storage/history/application shell;
- `client/tests/` — desktop presentation and integration flows;
- `mobile-client/tests/` — phone presentation and integration flows;
- `packages/test-runner/tests/` — the test framework itself.

Desktop/mobile integration tests may cover the same user scenario because they prove two independent presentations correctly consume the same shared application behavior. Lower-level shared behavior should not be duplicated between them.

## Verification Gate

```bash
npm run verify
```

The verification script intentionally continues through all steps and prints one final summary. It runs:

- server configuration check;
- database connection check;
- typechecking for every workspace;
- tests for every workspace;
- frontend architecture-boundary check;
- production builds for server, desktop client, and mobile client.

The boundary check prevents presentation packages from depending on each other, prevents core from importing browser/presentation code, checks for DOM/styling assumptions in core, and guards against obsolete compatibility seams being reintroduced.

## Production Deployment

Caddy is the public edge. It terminates HTTPS, routes `/api/*` to the Node service, and serves the built phone or desktop/tablet Vite application according to the configured request handling.

Node and PostgreSQL are not exposed directly to the internet. systemd manages the application services.

Production backups include both PostgreSQL data and persistent uploaded-audio storage. The backup service is a one-shot job triggered by a systemd timer; an inactive one-shot service after successful completion is normal.

Logs are available through systemd/journald, for example:

```bash
sudo journalctl -u grooveshare.service
```

## Development Tooling

Useful root commands:

```bash
npm ci
npm run dev-server
npm run dev-client
npm run dev-mobile
npm run dev-mobile-usb
npm run seed-auth
npm run reset-dev-data
npm run frontend:boundaries
npm run verify
```

Development seed/reset routes exist only when the server configuration explicitly enables them.

## Version Direction

### Version 3 — Recording and Mature Collaboration

Goal: make GrooveShare feel like a practical collaboration platform for a band before changing its hosting/distribution model.

Milestone 1 has established the recording-capable Web Audio Transport foundation. Next work is basic microphone recording, followed by useful lower-complexity collaboration features and real-device/real-band hardening.

### Version 4 — Self-Hosted and Native Mobile GrooveShare

Move the mature product toward desktop/home-server hosting (likely through Cloudflare Tunnel), then harden and package the existing phone presentation for installed Android/iOS use with Capacitor where appropriate.

### Version 5 — Advanced Collaboration and Audio

Defer expensive features such as automatic latency calibration, advanced track offset correction, comping, punch-in/out, waveform editing, richer history/notifications, presence/realtime collaboration, and advanced routing until actual product use justifies them.

## Near-Term Non-Goals

The current architecture does not imply that GrooveShare should immediately become:

- a full browser DAW;
- a microservice system;
- a realtime peer-to-peer recording system;
- an audio editor with waveform manipulation;
- a full notification/history platform;
- a native-code mobile application separate from the shared application model.

The priority remains a focused, reliable collaboration workflow with deliberate shared boundaries and one authoritative audio timeline.
