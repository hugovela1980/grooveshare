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
- the current **Version 3 Milestone 2** musical-timeline/recording foundation, including project/track musical placement, browser microphone capture, and transport-synchronized in-memory takes.

The current recording work intentionally stops before take review, permanent recorded-track upload, waveform editing, or latency calibration.

## Architectural Principles

- **The server is the security boundary.** Frontend permission checks exist for usability, not authority.
- **Shared product behavior has one implementation.** Desktop and mobile should not independently implement the same application workflow.
- **Presentation is allowed to diverge.** Desktop/tablet and phone layouts/interactions are intentionally separate.
- **Browser mechanics are not product logic.** `fetch`, browser storage, history, `FormData`, clipboard, and similar capabilities live in browser adapters.
- **One project timeline drives audio.** Web Audio playback and future recording must use the same authoritative clock.
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

Migrations currently cover the initial project/track schema plus users, sessions, memberships, upload ownership, and project invitations.

Operational rule: if a migration is executed by a PostgreSQL administrative role, newly created objects must still be owned by or granted to the runtime GrooveShare database role. Creating a table as `postgres` without application-role privileges can leave production code unable to use that table even though the migration itself succeeded.

### Filesystem audio

Uploaded audio bytes are stored on disk rather than in PostgreSQL. PostgreSQL stores track metadata and the path/reference needed to locate the file.

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
- loop enable/disable;
- channel volume/enable changes;
- snapshots/subscriptions;
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
durationSeconds
playbackState: stopped | paused | playing | ended
loopEnabled
```

While playback is running, elapsed position is derived exclusively from the supplied clock (`AudioContext.currentTime` in the Web Audio implementation).

The 100 ms interval used by the engine/Transport is observational and maintenance-oriented: it publishes snapshots, prunes completed generations, and maintains ahead-of-time loop scheduling. It does not advance the authoritative timeline.

### Scheduling and alignment

`Transport.play()` creates one immutable `PlaybackScheduleInstruction` with:

- `startAtClockTime`;
- `endAtClockTime`;
- `projectPositionSeconds`;
- `durationSeconds`;
- `loopEnabled`.

Each track is scheduled against that same project instruction. Tracks beginning at project time zero start at the generation boundary; tracks with a later timeline offset are scheduled at the corresponding future AudioContext clock time. When playback begins after a track's start, its source offset is derived from the difference between the current project position and the track start.

Pause/resume and seek discard/recreate one-shot source generations from a new shared instruction. Web Audio project duration is the latest musical track end (`track start + decoded duration`), so later-starting recordings remain aligned without padding their files with artificial leading silence.

### Loop scheduling

Loop restarts are not driven by a late `onended` callback.

When looping is enabled, the Web Audio engine uses Transport to create the next generation's exact absolute clock boundary and schedules that generation ahead of time. Turning loop off cancels future scheduled loop generations without interrupting the generation currently playing.

### Recording timeline and microphone capture

`Transport.markTimelinePosition()` captures one exact observation of:

```txt
AudioContext clock time
project position derived from that same clock read
playback state
```

`RecordingTimeline` converts those observations into start/stop markers and `RecordingPositionMetadata`. Recording duration is calculated from audio-clock time, not merely `stopProjectPosition - startProjectPosition`, so duration remains correct even when project position wraps through a loop boundary.

Browser microphone mechanics are implemented by `@hugovela/frontend-browser` behind the shared `MicrophoneRecordingPort`. `frontend-core` owns authorization, recording state, and transport synchronization without depending directly on `navigator`, `MediaRecorder`, `MediaStream`, or browser `Blob` behavior.

For a synchronized take, project playback begins from the current transport position, microphone capture starts, and the recording session then captures the authoritative transport marker observed at capture start. When the take stops, the in-memory take preserves:

- exact transport/audio-clock start and stop metadata;
- `timelineOffsetSeconds` equal to the captured start project position;
- project musical start/stop positions;
- a musical span derived from authoritative clock elapsed time rather than raw encoded-file duration.

A reviewed take can then be kept through a shared `RecordedTakeUploadPort`. The browser adapter converts the browser-neutral capture bytes into a `File` and delegates to the existing track upload service/multipart path rather than creating a recording-only server endpoint. The stored track receives the take's captured musical start and transport-clock-derived musical span, then the project player reloads it as a normal track. Temporary take audio is discarded only after a successful upload; failed uploads leave the reviewed take available for retry.

### HTML-audio fallback

`HtmlAudioPlaybackEngine` remains available as a fallback implementation. It supports the basic `PlaybackEngine` interface but intentionally does not expose recording timeline markers because independent media-element timing is not treated as a recording-grade authoritative clock.

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
