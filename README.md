# GrooveShare

GrooveShare is a lightweight browser-based music collaboration app for sharing stems, practicing parts, building rough mixes, inviting collaborators, and moving toward simple remote recording workflows.

GrooveShare is intentionally narrower than a DAW. The goal is a focused band workspace: create a project, add tracks, listen together, adjust a shared or personal mix, invite other musicians, and eventually capture rough takes against the same project timeline.

## Current Status

`main` is the production/release branch. `develop` is the integration branch for the latest completed work.

The current `develop` branch contains two major architectural milestones:

- **Version 2.2 — Shared Frontend Application Layer** is complete. Desktop/tablet and phone presentations are separate, while shared product behavior lives in `@hugovela/frontend-core` and shared browser mechanics live in `@hugovela/frontend-browser`.
- **Version 3 Milestone 1 — Recording-Capable Web Audio Engine and Transport** is complete through the pre-recording foundation. GrooveShare now has an explicit Web Audio transport, clock-scheduled multitrack playback/looping, and recording timeline markers. Microphone capture and recording UI have not been implemented yet.

Current product capabilities include:

- PostgreSQL-backed projects, tracks, users, sessions, memberships, invitation links, and persisted project mix settings.
- Registration, login, logout, and server-managed sessions.
- Project roles: **Viewer**, **Contributor**, and **Owner**.
- Server-enforced authorization for project, track, membership, upload, edit, delete, and mix operations.
- A separate desktop/tablet presentation (`client`) and phone presentation (`mobile-client`).
- Shared application state/workflows and services through `@hugovela/frontend-core`.
- Shared browser adapters through `@hugovela/frontend-browser`.
- Reusable collaboration invitation links and unauthenticated Guest listening.
- Explicit Guest → authenticated → Contributor conversion.
- Four-channel project mixing with server persistence for Contributors/Owners and browser-local mixes for Viewers/Guests.
- Synchronized multitrack Web Audio playback from one `AudioContext` clock.
- A first-class project `Transport` for play, pause, stop, seek, relative seek, looping, and project position.
- Recording timeline start/stop markers tied to the same authoritative audio clock.
- Production and Labs deployments behind Caddy with HTTPS, PostgreSQL, persistent uploads, systemd, firewall rules, and backups.

## Deployment Environments

GrooveShare keeps production and active integration testing separate.

```txt
main
  ↓
production
  ↓
grooveshare.hugovela.com

develop
  ↓
Labs / integration
  ↓
labs.grooveshare.hugovela.com
```

The two VPS environments use separate Node processes, PostgreSQL databases, upload directories, and ports so Labs testing does not modify production data.

## Access Models

Authorization is enforced by the server. Client-side permission checks improve usability, but the UI is never the security boundary.

### Viewer

A Viewer can open projects they belong to, read project/track information, stream project audio, and use a personal mix. Viewer mix changes are stored locally in the browser rather than changing the shared project mix.

### Contributor

A Contributor has Viewer abilities and can also upload tracks, manage tracks they uploaded, and persist the shared project mix.

### Owner

An Owner has Contributor abilities and can also edit/delete the project, manage all project tracks, manage project members, and create/regenerate/disable collaboration invitation links.

Creating a project makes the authenticated creator its Owner.

### Guest

Guest access is separate from Viewer membership. A valid invitation link can grant temporary read-only project access without creating a project membership.

A Guest can listen and keep a personal mix in browser storage. A Guest cannot upload, edit, delete, manage members, or persist the project's shared mix. An invitation can later be explicitly accepted by an authenticated user to become a Contributor.

## Frontend Architecture

GrooveShare uses two independent presentation clients over shared application and browser layers:

```txt
                       GrooveShare server
                              ↑
                       shared API contract
                              ↑
                 @hugovela/frontend-core
          domain + application + services + audio
                              ↑
                @hugovela/frontend-browser
           fetch + storage + history + browser shell
                       /             \
                      /               \
                client/          mobile-client/
             desktop/tablet           phone
```

The key ownership rule is:

> `frontend-core` owns what GrooveShare does; `frontend-browser` owns shared browser mechanisms; `client` and `mobile-client` own how GrooveShare looks and feels on their target surfaces.

`npm run frontend:boundaries` enforces the dependency direction and is included in the full verification gate.

See [`docs/frontend-clients.md`](docs/frontend-clients.md) for the detailed frontend boundary and [`docs/architecture.md`](docs/architecture.md) for the complete system architecture.

## Current App Flow

Authenticated flow:

```txt
Open GrooveShare
      ↓
Restore session or show authentication
      ↓
Projects
      ↓
Create project or open project
      ↓
Project Player
      ↓
Role-aware playback, mixing, uploads, editing,
membership management, and collaboration controls
```

Invitation flow:

```txt
Owner generates invitation link
      ↓
Guest opens link
      ↓
Guest listens without membership
      ↓
optional: Become a Contributor
      ↓
login/register if necessary
      ↓
explicit invitation acceptance
      ↓
Contributor membership
```

## Audio Architecture Today

GrooveShare's primary playback engine is `WebAudioPlaybackEngine` in `@hugovela/frontend-core`.

The current audio model is:

```txt
AudioContext.currentTime
        ↓
     Transport
        ↓
PlaybackScheduleInstruction
        ↓
WebAudioPlaybackEngine
        ↓
AudioBufferSourceNode → GainNode → destination
```

Important properties:

- `AudioContext.currentTime` is the authoritative running clock.
- Project duration is currently the longest decoded track in the loaded mix.
- Existing uploaded stems begin at project time zero.
- All active sources in a playback generation receive the same absolute Web Audio start time and project offset.
- Pause/resume and seek recreate one-shot `AudioBufferSourceNode`s against a shared schedule.
- Loop continuations are scheduled against absolute AudioContext times rather than started by a late `onended` callback.
- UI snapshot timers observe transport state but do not advance audio time.
- `RecordingTimeline` can mark recording start/stop positions against both project time and AudioContext time.
- `Track.timelineOffsetSeconds` reserves the domain concept for future recorded tracks that start after project time zero; persistence for that field is not implemented yet.

An HTML-audio playback implementation remains as a fallback, but it intentionally does not claim recording-clock capability.

Microphone capture, MediaRecorder/input plumbing, latency calibration, waveform editing, punch-in/out, comping, and other DAW-grade features remain future work.

## Local Development

### Prerequisites

- Node.js and npm
- PostgreSQL
- Git
- A modern browser

The repository uses npm workspaces:

```txt
client
grooveshare-server
mobile-client
@hugovela/frontend-core
@hugovela/frontend-browser
@hugovela/test-runner
```

Install workspace dependencies from the repository root:

```bash
npm ci
```

### PostgreSQL

A typical local setup uses:

```txt
Database user:  grooveshare_app
Development DB: grooveshare_dev
Test DB:        grooveshare_test
```

Create `server/.env` from the example:

```bash
cp server/env.example server/.env
```

Then supply your local PostgreSQL password and any required overrides. Real `.env` files are ignored by Git.

Apply SQL migrations from `server/db/migrations/` in filename order. The runtime server uses PostgreSQL stores; when applying migrations with an administrative PostgreSQL account, ensure newly created tables remain owned by or accessible to the application database role.

### Run locally

Server:

```bash
npm run dev-server
```

Desktop/tablet client:

```bash
npm run dev-client
```

Phone client:

```bash
npm run dev-mobile
```

For the phone Vite server when using USB/ADB forwarding:

```bash
npm run dev-mobile-usb
```

Default local endpoints are:

```txt
Desktop Vite: http://localhost:5173
Mobile Vite:  http://localhost:5174
API:          http://127.0.0.1:3000
Health:       http://localhost:3000/api/health
```

## Development Seed Tools

Development-only tooling can create repeatable Owner/Contributor/Viewer scenarios:

```bash
npm run seed-auth
```

Reset development data:

```bash
npm run reset-dev-data
```

The related development routes are disabled outside the development configuration.

## Verification

The primary repository gate is:

```bash
npm run verify
```

It checks:

- server configuration;
- PostgreSQL connectivity;
- typechecking for server, frontend-core, frontend-browser, client, mobile-client, and test-runner;
- all workspace test suites;
- frontend dependency boundaries;
- production builds for server, desktop client, and mobile client.

Useful focused commands include:

```bash
npm run test-server
npm run test-client
npm run test-mobile
npm run test-frontend-core
npm run test-frontend-browser
npm run test-runner
npm run frontend:boundaries
npm run build
```

The repository uses the custom [`@hugovela/test-runner`](packages/test-runner/README.md) workspace for its TypeScript test suites.

## Repository Structure

```txt
grooveshare/
├── client/                         # desktop/tablet presentation
├── mobile-client/                  # phone presentation
├── server/                         # Node API + PostgreSQL/filesystem adapters
│   ├── db/migrations/
│   ├── src/
│   └── tests/
├── packages/
│   ├── frontend-core/              # shared product/application/audio behavior
│   ├── frontend-browser/           # shared browser adapters and shell
│   └── test-runner/                # small internal test framework
├── scripts/
│   ├── verify.mjs
│   └── check-frontend-boundaries.mjs
├── docs/
│   ├── architecture.md
│   ├── frontend-clients.md
│   └── milestone-6-client-architecture-tour.md
├── sample-audio-files/
├── package.json
└── README.md
```

`backlog.md` is intentionally kept as a private local planning file and is ignored by Git.

## Production Architecture

```txt
Browser
  ↓ HTTPS
Caddy
  ├── /api/* → Node API
  ├── phone user-agent → mobile-client/dist
  └── other browser → client/dist
                          ↓
                    PostgreSQL
                          +
                   filesystem audio
```

Production properties include:

- Caddy handles public HTTP/HTTPS and TLS.
- Node binds to loopback rather than a public interface.
- PostgreSQL is not exposed publicly.
- Uploaded audio lives outside the Git checkout in persistent storage.
- Secrets and deployment-specific values remain outside source control.
- systemd manages the Node application processes.
- production backups include PostgreSQL data and uploaded audio.
- Labs and production use separate databases, upload roots, Node ports, and services.

## Roadmap Direction

### Version 3 — Recording and Mature Collaboration

Make GrooveShare a practical band collaboration platform before changing its hosting/distribution model.

Current direction:

1. **Recording-Capable Web Audio Engine and Transport** — completed pre-recording foundation: one authoritative clock, transport, synchronized scheduling, hardened looping, and recording timeline markers.
2. **Basic Microphone Recording Workflow** — capture a rough take while listening to the project, then preview/retry/save it as a GrooveShare track.
3. **Collaboration Workflow Polish** — add useful low-complexity collaboration features such as project/track notes, clearer project status, and other improvements shaped by real use.
4. **Recording and Collaboration Hardening** — exercise the complete workflow with real musicians/devices and improve reliability.

### Version 4 — Self-Hosted and Native Mobile GrooveShare

Move the mature application toward desktop/home-server hosting (likely through Cloudflare Tunnel), harden installed/mobile behavior, and wrap the existing phone client with Capacitor for Android and later iOS.

### Version 5 — Advanced Collaboration and Audio

Reserve higher-complexity work for later: latency calibration/offset correction, multiple takes and comping, punch-in/out, waveform editing, richer history/notifications, real-time presence, advanced routing, and other DAW-like or distributed-collaboration features.

## Project Philosophy

GrooveShare favors:

- understandable modular architecture over unnecessary framework complexity;
- server-side authorization over client-only assumptions;
- one shared application model with intentionally different presentation clients;
- one authoritative audio timeline rather than independently timed media elements;
- real musical use and feedback before expensive audio features;
- a focused collaboration tool rather than a browser DAW.
