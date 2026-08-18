# GrooveShare

GrooveShare is a lightweight browser-based music collaboration app for sharing stems, practicing parts, and building rough remote band workflows.

The project is intentionally narrower than a DAW. GrooveShare focuses on a simple shared workflow: create a project, upload audio tracks, invite collaborators, listen to the tracks together, adjust a four-channel mix, and eventually capture rough remote takes.

## Current Status

The current stable release is **v1.0.0** on `main`.

Active development is on **Version 2 — Multi-User Hosted Beta** on `develop`.

Version 2 now includes:

- PostgreSQL-backed project, track, mix, user, session, and membership data.
- User registration, login, logout, and persistent server-managed sessions.
- Project membership roles: **Viewer**, **Contributor**, and **Owner**.
- Server-enforced authorization for project, track, upload, edit, delete, mix, and membership actions.
- Permission-aware client controls.
- Track upload ownership for Contributor permissions.
- A production-ready configuration boundary.
- A Linux VPS deployment with PostgreSQL, Caddy, HTTPS, systemd services, firewall rules, persistent uploads, logging, and backups.
- A separate internet-accessible Labs environment for testing the latest `develop` branch.

The current development focus is **Version 2 Milestone 5 — Mobile-Ready UI/UX**: make the existing web application genuinely comfortable to use on a modern phone before adding more advanced audio features.

## Deployment Environments

GrooveShare uses separate stable and development environments.

```txt
main
  ↓
production release
  ↓
grooveshare.hugovela.com

develop
  ↓
Labs / current integration build
  ↓
labs.grooveshare.hugovela.com
```

`labs.grooveshare.hugovela.com` is the live testing environment for current development and contributor feedback.

The production hostname is reserved for code released from `main`. Until Version 2 is ready for release, the production hostname does not need to expose the current development build.

The two VPS environments use separate application processes, PostgreSQL databases, upload directories, and Node ports so testing in Labs does not modify production data.

## Current User Roles

Authorization is enforced by the server. The client hides or shows controls for usability, but hidden controls are never treated as the security boundary.

### Viewer

A Viewer can:

- Open projects they belong to.
- Read project and track information.
- Stream and play project audio.
- Use the playback/mix interface where permitted.

### Contributor

A Contributor has Viewer abilities and can also:

- Upload tracks.
- Rename and delete tracks they uploaded.
- Participate in the project without receiving Owner-level management privileges.

### Owner

An Owner has Contributor abilities and can also:

- Edit and delete the project.
- Manage all project tracks.
- Add, remove, and change project members.
- Manage project-level collaboration settings.

Creating a project makes the authenticated creator its Owner.

## Current App Flow

The authenticated Version 2 flow is:

```txt
Open GrooveShare
      ↓
Register or Log In
      ↓
Resolve current session
      ↓
Project Menu
      ↓
Create Project or open an existing project
      ↓
Project Player
      ↓
Role-aware playback, mixing, uploads, editing, and management
```

The Project Player is the center of the current GrooveShare experience. It contains:

- A four-channel track/mixer area.
- Per-channel enabled state and volume.
- Persistent project mix settings.
- Inline project and track editing.
- Track upload and deletion controls where authorized.
- A shared Audio Player with play/pause, stop, loop, timestamp, progress, and seeking.
- Owner membership-management controls.

## Audio Playback Today

The current transport uses multiple browser HTML audio elements.

Supported behavior includes:

- Up to four project channels.
- Enable/disable state per channel.
- Per-channel volume.
- Saved mix settings.
- Shared play/pause/stop behavior.
- Pause and resume without returning to the beginning.
- Shared seeking.
- HTTP byte-range audio responses.
- Looping.
- Persistent project and track metadata.

Version 2 now uses a minimal Web Audio transport for reliable multitrack synchronization. Project tracks are fetched and decoded into `AudioBuffer`s, scheduled from one shared `AudioContext` clock, and routed through per-channel `GainNode`s so volume and enable/disable changes do not rebuild or restart the transport. Waveforms, gapless loop scheduling, nudge, non-destructive trim, effects, and recording remain outside the Version 2 scope.

## Local Development

### Prerequisites

The active Version 2 development environment requires:

- Node.js and npm.
- PostgreSQL.
- Git.
- A modern browser.

The repository uses npm workspaces for:

```txt
client/
server/
packages/test-runner/
```

Install all workspace dependencies from the repository root:

```bash
npm ci
```

### PostgreSQL

Create separate development and test databases. A typical local setup uses:

```txt
Database user:  grooveshare_app
Development DB: grooveshare_dev
Test DB:        grooveshare_test
```

Create `server/.env` from the supplied example:

```bash
cp server/env.example server/.env
```

Then provide your local PostgreSQL password and any local overrides in `server/.env`.

The default development configuration expects:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
CLIENT_ORIGIN=http://localhost:5173
UPLOAD_ROOT=./uploads

PGHOST=localhost
PGPORT=5432
PGDATABASE=grooveshare_dev
PGTESTDATABASE=grooveshare_test
PGUSER=grooveshare_app
PGPASSWORD=your-local-password
```

Real `.env` files are ignored by Git.

Apply the SQL migrations in `server/db/migrations/` to the development database in filename order before starting the application.

### Start the Server

From the repository root:

```bash
npm run dev-server
```

The development API runs at:

```txt
http://localhost:3000
```

Health endpoint:

```txt
http://localhost:3000/api/health
```

### Start the Client

In a second terminal:

```bash
npm run dev-client
```

The Vite client runs at:

```txt
http://localhost:5173
```

No client environment file is required for the normal local setup. Development defaults to the API at `http://localhost:3000`.

## Development Seed Tools

Development-only tooling can create repeatable Owner, Contributor, and Viewer scenarios for testing permissions.

From the repository root:

```bash
npm run seed-auth
```

To reset development data:

```bash
npm run reset-dev-data
```

These commands and the related `/api/dev/*` routes are protected from production use.

## Verification

Useful root commands:

```bash
npm run config:check
npm run db:check
npm run test-all
npm run build
npm run verify
```

`npm run verify` performs the configuration check, database connection check, all workspace typechecks/tests, and the production build.

Individual suites can also be run with:

```bash
npm run test-client
npm run test-server
npm run test-runner
```

The client and server use the shared custom `@hugovela/test-runner` workspace.

## Project Structure

```txt
grooveshare/
├── client/
│   └── src/
│       ├── api/
│       ├── css/
│       ├── dev/
│       ├── page-controllers/
│       ├── pages/
│       ├── permissions/
│       ├── project-draft/
│       ├── router/
│       ├── storage/
│       └── templates/
├── server/
│   ├── db/
│   │   └── migrations/
│   ├── src/
│   │   ├── auth/
│   │   ├── config/
│   │   ├── db/
│   │   ├── dev/
│   │   ├── stores/
│   │   └── uploads/
│   └── tests/
├── packages/
│   └── test-runner/
├── sample-audio-files/
├── docs/
│   ├── architecture.md
│   └── production-configuration.md
├── package.json
└── README.md
```

`backlog.md` is intentionally kept as a private local planning document and is ignored by Git.

## Production Architecture

The hosted Version 2 infrastructure uses:

```txt
Browser
  ↓ HTTPS
Caddy
  ├── static Vite client
  └── /api/* → Node API
                    ↓
              PostgreSQL
                    +
              filesystem audio
```

Important production properties:

- Caddy handles public HTTP/HTTPS and TLS.
- Node binds to `127.0.0.1`, not a public interface.
- UFW exposes only the required public ports.
- PostgreSQL is not exposed publicly.
- Audio files live outside the Git repository in a persistent filesystem location.
- Secrets and deployment-specific values live outside source control.
- The Node application runs under systemd.
- Production backups include PostgreSQL data and uploaded audio.
- Production and Labs use separate databases, upload roots, services, and ports.

See [`docs/architecture.md`](docs/architecture.md) for the detailed system design.

## Roadmap

### Version 2 — Multi-User Hosted Beta

Completed foundations:

1. Accounts and Authorization Foundation.
2. Permission-Aware UI.
3. Production Configuration.
4. VPS Deployment.

Current:

5. **Mobile-Ready UI/UX** — make authentication, project navigation, the Project Player, mixer, uploads, membership management, and feedback states comfortable on phone-sized touch screens.

The Version 2 release should be a usable hosted collaboration app before more advanced audio-engine work is required.

### Version 2.x — Beta Stabilization and Follow-Up Features

After Version 2 releases:

- Use GrooveShare with real bandmates and fix issues discovered through real usage.
- Improve loading, validation, error handling, and operational behavior.
- Add public/share-link guest listening without automatically creating project memberships.
- Keep guest personal mix settings in browser `localStorage`.
- Extend the minimal Web Audio engine only where beta feedback justifies features such as waveforms, gapless loop scheduling, nudge, trim, and edited playback.

### Version 3 — Self-Hosting, Recording, and Mobile Clients

Planned direction:

- Move the centralized service toward desktop/home-server hosting, likely using Cloudflare Tunnel.
- Add a browser microphone recording workflow for Contributors.
- Reuse the mobile-ready web client inside Capacitor for Android and later iOS.
- Keep the same centralized GrooveShare API contract so infrastructure changes do not require rewriting the product.

### Version 4 — Mature Collaboration

Longer-term collaboration work may include:

- Invitations.
- Project notes and instructions.
- Comments.
- Notifications.
- Private sharing improvements.
- Project status/history.
- Collaboration features shaped by real band usage.

## Public Guest Sharing Direction

A future public-share mode is intentionally separate from Viewer/Contributor/Owner membership.

A guest with an approved share link should eventually be able to:

- Read approved shared project information.
- Stream project tracks.
- Adjust a personal mix.
- Keep that personal mix in the current browser with `localStorage`.

A guest should not automatically become a project member and should not be able to upload, record, edit, delete, manage members, or change the project's persisted shared mix.

## Project Philosophy

GrooveShare is being built incrementally around actual musical collaboration needs.

The project favors:

- A small understandable architecture over unnecessary framework complexity.
- Server-side security rules over client-only assumptions.
- Reusable web UI before maintaining separate native interfaces.
- Real beta feedback before adding expensive audio or infrastructure complexity.
- A focused collaboration tool rather than a browser DAW.
