# GrooveShare Architecture

## Purpose

GrooveShare is a lightweight browser-based music collaboration application for sharing stems, practicing parts, and building toward rough remote recording workflows.

It is not intended to become a full DAW. The architecture should support a focused band workflow:

1. Create a project.
2. Add audio tracks.
3. Share the project with trusted collaborators.
4. Listen to the tracks together.
5. Adjust a simple four-channel mix.
6. Manage project membership and contribution permissions.
7. Later, record rough takes and add more advanced synchronization tools where they provide real value.

The architecture favors understandable boundaries and incremental growth over premature complexity.

## Current Version and Direction

The stable release is **v1.0.0** on `main`.

Active development is **Version 2 — Multi-User Hosted Beta** on `develop`.

Completed Version 2 foundations include:

1. Accounts and Authorization Foundation.
2. Permission-Aware UI.
3. Production Configuration.
4. VPS Deployment.

The current focus is **Version 2 Milestone 6 — Multi-Client Frontend Foundation**.

Milestone 5 established the phone-oriented Project Player and mobile interaction patterns. Milestone 6 now separates presentation concerns from reusable frontend behavior just far enough to support a desktop/tablet client and a dedicated mobile client without a full frontend rewrite.

The current multi-`HTMLAudioElement` playback model remains in place behind a shared `PlaybackEngine` boundary. Advanced Web Audio synchronization work remains deferred until Version 3, after Version 2 beta usage has provided more product evidence.

## Architectural Principles

GrooveShare currently follows these principles:

- **The server is the security boundary.** Client-side permission-aware UI improves usability but never grants authority.
- **One API contract should survive infrastructure changes.** Moving from a VPS to a future home server should primarily be a deployment change.
- **Metadata and audio bytes are separate concerns.** PostgreSQL stores structured application data; the filesystem stores audio.
- **Production and Labs data are isolated.** Development testing must not operate on production databases or upload directories.
- **Desktop/tablet and mobile presentation clients may differ intentionally while sharing frontend application behavior and one backend.**
- **Tablet presentation derives from the desktop/web design; the dedicated mobile presentation primarily targets phones.**
- **Audio-engine complexity should be added when product needs justify it.**
- **Development-only tools must be impossible to invoke accidentally in production.**
- **Infrastructure secrets and runtime configuration stay outside Git.**

## High-Level Repository Structure

```txt
grooveshare/
├── client/
│   ├── src/
│   └── tests/
├── server/
│   ├── db/
│   │   └── migrations/
│   ├── src/
│   └── tests/
├── packages/
│   ├── frontend-core/
│   └── test-runner/
├── sample-audio-files/
├── docs/
│   ├── architecture.md
│   └── production-configuration.md
├── package.json
└── README.md
```

The repository is an npm workspace containing:

```txt
client
grooveshare-server
@hugovela/frontend-core
@hugovela/test-runner
```

A single root `package-lock.json` controls workspace dependency installation.

`backlog.md` is intentionally a private local planning file and is ignored by Git.

## System Overview

The active Version 2 application has three major runtime responsibilities:

```txt
Browser client
     ↓
Node HTTP API
     ↓
PostgreSQL metadata + filesystem audio
```

In a hosted environment, Caddy sits in front of the application:

```txt
Internet
   ↓
HTTPS
   ↓
Caddy
   ├── serves client/dist
   └── routes /api/* to Node
                         ↓
                    PostgreSQL
                         +
                    upload storage
```

The production browser and API share one public origin. This keeps cookies, CORS, URLs, and future infrastructure migrations simpler.

## Environment Model

GrooveShare now has three meaningful environments.

### Local Development

```txt
Browser/Vite: http://localhost:5173
Node API:     http://127.0.0.1:3000
PostgreSQL:   grooveshare_dev
Test DB:      grooveshare_test
Uploads:      server/uploads or configured development path
```

Local development may use convenient defaults and development-only seed/reset tooling.

### Labs

Labs is the live internet-accessible integration environment for the current `develop` branch.

```txt
Branch:       develop
Hostname:     labs.grooveshare.hugovela.com
Checkout:     /srv/grooveshare-labs
Node:         127.0.0.1:3001
Database:     grooveshare_labs
DB role:      grooveshare_labs_app
Uploads:      /var/lib/grooveshare-labs/uploads
Service:      grooveshare-labs.service
```

Labs is intended for contributor and tester access to current development work.

Labs must remain disposable enough that testing, resets, experimental data, and future development migrations do not affect production.

### Production

Production is reserved for stable code released from `main`.

```txt
Branch policy: main
Hostname:      grooveshare.hugovela.com
Checkout:      /srv/grooveshare
Node:          127.0.0.1:3000
Database:      grooveshare_prod
DB role:       grooveshare_app
Uploads:       /var/lib/grooveshare/uploads
Service:       grooveshare.service
```

Until Version 2 is released, the production hostname may remain unavailable rather than exposing the current development build.

The desired branch/environment relationship is:

```txt
feature branch
      ↓
merge
      ↓
develop
      ↓
deploy/test in Labs
      ↓
release decision
      ↓
merge to main
      ↓
deploy to production
```

## Frontend Architecture

The frontend remains Vite + Vanilla TypeScript using browser DOM APIs rather than a frontend framework. Milestone 6 is introducing a shared core before the second presentation client is created.

Current Phase 1 structure:

```txt
client/src/
├── api/
├── css/
├── dev/
├── page-controllers/
├── pages/
├── platform/
├── project-draft/
├── router/
├── storage/
├── templates/
├── app.ts
├── main.ts
└── types.ts

packages/frontend-core/src/
├── domain/
├── mix/
├── permissions/
├── platform/
└── playback/
```

`client/` still owns the current DOM presentation. A separate `mobile-client/` workspace will be introduced later in Milestone 6, after the shared seams are proven by the existing client.

### `frontend-core` Responsibilities

The shared package owns behavior that is already clearly presentation-independent:

- GrooveShare domain types.
- Project permission helpers.
- `SessionProvider` and `StorageProvider` platform contracts.
- `PlaybackEngine` and the current multi-`HTMLAudioElement` playback implementation behind that contract.
- Viewer-local mix persistence.
- Owner/Contributor pending-mix recovery.
- Debounced server mix persistence and flush-before-navigation behavior.

The package does **not** own page markup, CSS, navigation presentation, dialogs, touch behavior, desktop/mobile layout, or DOM query/event wiring.

The existing HTTP API modules also remain in `client/` during this first pass. Track upload currently depends on browser `File`/`FormData` behavior, and the general API transport still carries browser/session assumptions. API behavior should be extracted only when the second presentation client demonstrates a useful shared boundary rather than by introducing transport abstractions prematurely.

### Presentation Responsibilities

The presentation client is responsible for:

- Rendering screens and reusable UI.
- Translating desktop/tablet or mobile interactions into shared application operations.
- Browser-specific file selection and upload presentation.
- Navigation layout and route presentation.
- Editing interaction such as desktop inline editing versus mobile modal editing.
- Mixer layout such as desktop horizontal controls versus mobile vertical channel strips.
- Loading, success, failure, and session-expired presentation.
- Supplying browser implementations for session, storage, and HTML-audio creation.

The server remains authoritative for authentication and authorization regardless of what either presentation displays.

### Multi-Client Direction

The intended Phase 1 boundary is:

```txt
                 GrooveShare server
                        ↑
               shared frontend core
                /                 \
     desktop/tablet client      mobile client
          client/              mobile-client/
             ↓                       ↓
       web browser today        mobile web today
       Electron later           Capacitor later
```

The goal is to share product behavior rather than force presentation markup to be shared. Intentional desktop/mobile differences should be protected by each client's integration tests rather than hidden behind increasingly complex viewport-condition branches.

### Testing Boundary

Shared behavior is tested in `packages/frontend-core/tests/`. Presentation behavior remains covered by client integration-style tests. Architectural extractions should preserve or improve automated coverage so manual smoke testing can focus on real browser/device behavior that the test harness cannot realistically reproduce.

## CSS Architecture

The frontend has a single CSS entry point:

```txt
client/src/css/main.css
```

The current organized CSS structure contains global/base/layout/utilities, reusable component styles, page-specific styles, and responsive rules.

The existing responsive styles remain intact while the architectural split is established. After `mobile-client/` exists, `client/` will return to a desktop/tablet-oriented presentation that remains fluid across normal browser and tablet widths, while phone-specific composition can live in the mobile client without forcing both products through one CSS/DOM structure.

## Authentication

GrooveShare uses server-managed authentication sessions.

Conceptually:

```txt
register/login
     ↓
server validates credentials
     ↓
server creates session
     ↓
browser receives session cookie
     ↓
later request includes cookie
     ↓
server resolves current user
```

Passwords are hashed server-side. Password hashes are never returned as public user data.

Production session cookies use secure production settings.

Frontend application code reaches authentication through the shared `SessionProvider` contract. The current `client/` supplies the browser/cookie-backed implementation; future Capacitor or Electron work can provide another implementation if real platform behavior requires it without rewriting shared application logic.

The current identity model is email-based. Username-based login remains a future product decision rather than an architectural requirement.

## Authorization

Authentication answers:

> Who is making this request?

Authorization answers:

> Is that user allowed to perform this action on this project or track?

The membership roles are:

```txt
Viewer
  read/play

Contributor
  Viewer abilities
  upload tracks
  manage tracks they contributed
  use allowed contribution-level project controls

Owner
  Contributor abilities
  manage all project tracks
  manage project details/deletion
  manage project memberships
```

Creating a project also creates the creator's Owner membership.

Track ownership is linked through `uploadedByUserId`. A Contributor may manage their own contribution where allowed; an Owner may manage any track in the project.

Client-side visibility is convenience only:

```txt
permission-aware UI
        ≠
authorization
```

Every protected operation must still be authorized by the server.

## Public Guest Sharing Direction

Public Guest is a planned separate access mode, not a fourth membership role.

A future share-link path should allow narrowly scoped anonymous access:

```txt
approved public/share link
          ↓
anonymous guest
          ↓
read approved project metadata
read approved track metadata
stream approved audio
adjust personal enabled/volume mix
          ↓
browser localStorage
```

Guest personal mix state is not shared project state and should not be written to PostgreSQL.

A guest should not automatically receive a `project_memberships` row.

Guest actions must not include:

- Uploading.
- Recording.
- Project or track editing.
- Deletion.
- Membership management.
- Persisted shared mix mutation.

Anonymous access requires explicit server-side share authorization. It must not be implemented by simply weakening the normal authenticated project routes.

## Backend Architecture

The backend is a pure Node TypeScript HTTP server.

```txt
server/src/server.ts
    ↓
loads environment/configuration
wires real stores
creates HTTP server
starts listening

server/src/app.ts
    ↓
creates the testable application/route behavior
```

Current backend structure:

```txt
server/
├── db/
│   └── migrations/
├── src/
│   ├── auth/
│   ├── config/
│   ├── db/
│   ├── dev/
│   ├── stores/
│   ├── uploads/
│   ├── app.ts
│   ├── server.ts
│   └── types.ts
└── tests/
```

### Backend Responsibilities

The server is responsible for:

- HTTP routing and response handling.
- CORS in development and configured cross-origin cases.
- Runtime configuration validation.
- PostgreSQL connectivity.
- Project, track, mix, user, session, and membership persistence.
- Password hashing/verification.
- Session creation and current-user resolution.
- Membership and track-ownership authorization.
- Upload parsing and validation.
- Persistent filesystem storage for audio.
- HTTP byte-range audio streaming.
- Project/track cleanup.
- Development-only seed/reset behavior.
- Clear authentication/authorization error responses.

The server continues to use Node's built-in HTTP, filesystem, stream, and crypto capabilities rather than Express.

Moving to Express or another framework is optional and should happen only if routing/middleware complexity creates enough value to justify it.

## Runtime Configuration

Deployment-sensitive values are centralized behind server configuration rather than hard-coded throughout the application.

Important settings include:

```txt
NODE_ENV
HOST
PORT
CLIENT_ORIGIN
UPLOAD_ROOT

PGHOST
PGPORT
PGDATABASE
PGUSER
PGPASSWORD
PGTESTDATABASE
```

Development may use safe local defaults.

Production must fail clearly when required deployment values are absent or malformed.

The real `server/.env` is ignored by Git.

The client normally requires no production API origin value because production uses same-origin `/api` requests behind Caddy. `VITE_API_BASE_URL` exists only for deployments that intentionally need a separate API origin.

## Data Storage

### PostgreSQL

Version 2 uses PostgreSQL for shared application metadata.

Current tables:

```txt
projects
tracks
project_mix_channels
users
sessions
project_memberships
```

Schema changes are maintained as ordered SQL migrations under:

```txt
server/db/migrations/
```

The current migration sequence establishes:

1. Projects, tracks, and project mix channels.
2. Users.
3. Sessions.
4. Project memberships.
5. Track upload ownership.

### Filesystem Audio

Audio bytes remain outside PostgreSQL.

Production:

```txt
/var/lib/grooveshare/uploads
```

Labs:

```txt
/var/lib/grooveshare-labs/uploads
```

Track rows contain the metadata and filesystem path needed to serve the uploaded file.

This separation keeps PostgreSQL focused on structured data while avoiding storing large audio blobs in the relational database.

Object storage can be introduced later if real usage makes server-local audio storage inconvenient.

### JSON Stores

JSON project/track stores remain in the codebase as alternate/test implementations of store contracts.

The active Version 2 server uses PostgreSQL-backed stores.

## Store Pattern

High-level route behavior is separated from persistence details.

Conceptually:

```txt
HTTP route
   ↓
authentication / authorization
   ↓
store interface
   ↓
PostgreSQL implementation
```

Current store boundaries include projects, tracks, users, sessions, and project memberships.

This allows tests to replace the real persistence implementation and keeps most SQL out of request-routing logic.

Database snake_case fields are mapped into TypeScript application naming where appropriate.

## Current Data Model

### Project

A Project represents a song idea, rehearsal part, riff, section, or practice project.

Conceptually:

```ts
type MixChannelSetting = {
  channelNumber: number;
  trackId: string;
  enabled: boolean;
  volume: number;
};

type MixSettings = {
  channels: MixChannelSetting[];
};

type Project = {
  id: string;
  title: string;
  description: string;
  mixSettings?: MixSettings;
  createdAt: string;
  updatedAt: string;
};
```

### Track

A Track represents one uploaded audio file belonging to a project.

```ts
type Track = {
  id: string;
  projectId: string;
  name: string;
  originalFilename: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedByUserId: string | null;
  createdAt: string;
};
```

`uploadedByUserId` is used by authorization logic for Contributor-owned track management.

### User

A User represents an account identity. Public user data does not include a password hash.

### Session

A Session links a server-side representation of an opaque browser session token to a user and expiration time.

### Project Membership

A membership connects a User to a Project using:

```txt
viewer
contributor
owner
```

The database allows only one Owner membership per project in the current model.

## API Shape

Current application routes include:

```txt
GET    /api/health

POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PUT    /api/projects/:projectId
PUT    /api/projects/:projectId/mix-settings
DELETE /api/projects/:projectId

POST   /api/projects/:projectId/tracks
GET    /api/projects/:projectId/tracks
PUT    /api/projects/:projectId/tracks/:trackId
GET    /api/projects/:projectId/tracks/:trackId/audio
DELETE /api/projects/:projectId/tracks/:trackId

GET    /api/projects/:projectId/members
POST   /api/projects/:projectId/members
PUT    /api/projects/:projectId/members/:userId
DELETE /api/projects/:projectId/members/:userId
```

Audio streaming is the primary non-JSON response and supports HTTP range requests.

Protected routes distinguish common outcomes such as:

```txt
401  authentication required
403  authenticated but forbidden
404  requested resource does not exist
```

Development-only routes remain under `/api/dev/*` and are not registered in production.

## Upload Flow

Authenticated track upload follows this general order:

```txt
request
  ↓
authenticate user
  ↓
authorize project contribution
  ↓
parse multipart data
  ↓
validate audio
  ↓
save audio file
  ↓
create PostgreSQL track row
including uploader identity
  ↓
return created track
```

Uploader identity comes from the authenticated server session, never from a client-supplied user ID.

Deleting a track removes both metadata and its linked file.

Deleting a project removes its project data, dependent track/mix/membership data, linked audio files, and the project upload directory.

## Project Draft State

Project creation uses temporary client-side draft state before backend submission.

The draft can contain:

- Project title.
- Project description.
- Selected `File` objects.
- Editable pending track names.
- Original filenames.
- MIME types.
- File sizes.

The draft survives the create-project confirmation interaction and is cleared only after successful project creation and upload handling.

## Project Player

The Project Player contains two conceptual areas:

```txt
Mix Channels / Tracks
        +
Audio Player / global transport
```

### Mix Channels

Up to four track slots are shown.

An occupied slot can include:

- Numbered enabled/disabled control.
- Persisted track name.
- Volume slider and percentage.
- Waveform placeholder.
- Role/ownership-appropriate edit/delete behavior.

An empty slot can expose Add Track when the current role allows contribution.

Tracks are currently assigned to channel slots by upload/order rather than manual drag-and-drop.

### Audio Player

The Audio Player owns global transport:

- Load Mix.
- Play.
- Pause/resume.
- Stop/reset.
- Shared timestamp.
- Shared progress.
- Seek.
- Loop.

Per-track edit controls remain in the channel area rather than the global transport.

## Current Playback Engine

Version 2 currently retains the Version 1 multi-element playback implementation.

Supported expectations include:

- `Load Mix` captures visible channel settings and persists occupied-channel enabled/volume state.
- Enabled tracks are loaded for playback.
- Disabled tracks preserve their mixer settings.
- Channel volumes are applied to loaded audio.
- Play begins the loaded channels from a shared logical start point.
- Pause preserves the current playback position.
- Resume continues without seeking back to the beginning.
- Stop resets the mix.
- Seeking moves all loaded tracks to a shared calculated position.
- The server supports byte ranges for audio seeking.
- Loop restarts the mix when playback reaches its end.

Known architectural limitations:

- Multiple HTML audio elements do not provide sample-accurate scheduling.
- Loop restart can have a small delay.
- Gapless looping is not guaranteed.
- Waveforms remain placeholders.
- Offset/nudge and non-destructive trimming are not implemented.
- Mixer edits made after `Load Mix` require loading the mix again before playback reflects them.

These limitations are accepted for Version 2.0 while mobile usability and real beta feedback are higher priorities.

## Web Audio Engine — Version 2.x Direction

After Version 2 is released, a Version 2.x feature release may replace the current transport when real collaboration/recording needs justify tighter synchronization.

Likely responsibilities:

- Fetch and decode project audio into `AudioBuffer`s.
- Use one shared `AudioContext` clock.
- Route channels through GainNodes.
- Schedule enabled tracks from the same clock.
- Track shared playback position for pause/resume/stop.
- Improve loop scheduling.
- Draw read-only waveforms from decoded audio data.
- Display a shared playhead.
- Store and apply per-channel offset/nudge.
- Add non-destructive clip start/end values.
- Make playback respect enabled state, volume, offset, and clip boundaries.

The existing Project Player UI should remain useful; the goal is to replace the underlying playback engine rather than rebuild the product around an audio framework.

## Recording Direction

Recording is planned for Version 3 rather than Version 2.0.

The likely browser-first APIs are:

```txt
navigator.mediaDevices.getUserMedia
MediaRecorder
```

An authorized Contributor should eventually be able to:

```txt
listen to current project mix
        ↓
record rough take
        ↓
stop and preview
        ↓
name take
        ↓
upload as normal project track
```

The first recording workflow should remain a rough collaboration tool rather than promise DAW-quality monitoring.

Native audio plugins should be introduced only if real Android/iOS testing demonstrates that browser/WebView behavior is insufficient.

## Production Deployment Architecture

The current VPS deployment uses Ubuntu, PostgreSQL, Node, systemd, Caddy, and UFW.

### Request Flow

```txt
Internet
   ↓
80/443
   ↓
Caddy
   ├── static Vite build
   └── /api/*
          ↓
     Node on loopback
          ↓
      PostgreSQL
          +
     upload filesystem
```

Node is deliberately bound to loopback rather than the public network.

Production API:

```txt
127.0.0.1:3000
```

Labs API:

```txt
127.0.0.1:3001
```

Direct public access to those application ports is not required.

### Caddy

Caddy:

- Listens publicly on HTTP/HTTPS.
- Obtains and renews TLS certificates.
- Serves the appropriate Vite `client/dist`.
- Reverse proxies `/api` to the matching Node service.
- Allows production and Labs to coexist on one VPS by hostname.

### systemd

The application processes run as separate systemd services:

```txt
grooveshare.service
grooveshare-labs.service
```

They are configured to restart on failure and start during normal boot.

Production backup automation uses a separate one-shot service/timer:

```txt
grooveshare-backup.service
grooveshare-backup.timer
```

### Firewall

UFW limits public exposure to the ports required for SSH and web traffic.

The intended public surface is:

```txt
22/tcp   SSH
80/tcp   HTTP
443/tcp  HTTPS
443/udp  HTTP/3/QUIC
```

Node application ports and PostgreSQL remain non-public.

### Production Backups

The production backup process protects:

```txt
PostgreSQL: grooveshare_prod
Uploads:    /var/lib/grooveshare/uploads
```

The backup script:

1. Briefly stops the production GrooveShare application.
2. Creates a PostgreSQL custom-format dump.
3. Creates a compressed archive of uploaded audio.
4. Restarts the application.
5. Keeps a rotating set of the seven newest database and upload backups.

The backup/restore procedure has been tested with representative project data and audio files, including restoring the PostgreSQL dump into a disposable database and extracting/comparing the upload archive.

Current backup copies live on the VPS. Automated off-VPS storage is intentionally deferred for the beta stage, but it should be configured before users depend on GrooveShare to preserve irreplaceable audio.

A future off-VPS target could be object storage, cloud backup storage, or the current VPS acting as remote storage after a home server becomes the primary host.

## Logs and Operations

Application lifecycle messages are available through systemd/journald.

Caddy logs proxy/TLS behavior. Interrupted browser audio range streams can produce proxy warnings when the browser closes an HTTP/2 stream during seeking, track changes, navigation, or playback cancellation; these are not automatically application failures.

Operational checks should include:

```bash
systemctl is-active grooveshare.service
systemctl is-active grooveshare-labs.service
systemctl is-active caddy.service
systemctl is-active grooveshare-backup.timer
```

and public health checks through the appropriate hostname.

## Development Tooling

Development tooling is deliberately isolated from normal product behavior.

The role-aware authorization seed scenario can create:

```txt
Owner account
Contributor account
Viewer account
one project
three memberships
tracks owned by different users
```

Root command:

```bash
npm run seed-auth
```

Reset command:

```bash
npm run reset-dev-data
```

Development-only routes/commands refuse production use.

## Testing Architecture

The repository contains a reusable workspace package:

```txt
@hugovela/test-runner
```

It supplies independent `createTester()` instances to the client and server suites.

Testing responsibilities include:

- API helper request/response behavior.
- Page-controller DOM behavior.
- Template rendering.
- Router/application state.
- Permission-aware UI.
- Store contracts.
- PostgreSQL persistence.
- Authentication/session behavior.
- Role and track-ownership authorization.
- Full HTTP integration scenarios using separate sessions.
- Migration behavior and schema constraints.
- Production configuration validation.

The authorization integration suite models several actors:

```txt
unauthenticated
non-member
Viewer
Contributor
Owner
```

The server tests allowed and forbidden operations independently from what the browser chooses to display.

Useful root verification command:

```bash
npm run verify
```

This runs configuration validation, database connectivity, workspace typechecks/tests, and the production build.

## Future Hosting Direction

Version 3 is expected to move GrooveShare toward desktop/home-server hosting while keeping the same public application contract.

A likely shape is:

```txt
Internet
   ↓
stable GrooveShare hostname
   ↓
Cloudflare Tunnel
   ↓
home server
   ↓
same Node API + PostgreSQL + upload model
```

The existing IONOS VPS can later serve as temporary remote/off-site backup storage if useful while its prepaid term remains active.

The important architectural goal is that a hosting move should not require rewriting the client or inventing a new API.

## Version Direction

### Version 2 — Multi-User Hosted Beta

Complete the hosted authenticated application and make it comfortable on mobile.

Current milestone:

**Mobile-Ready UI/UX**

### Version 2.x

Use real beta feedback to stabilize the product and add follow-up features such as:

- Public guest sharing with browser-local personal mixes.
- Web Audio Engine and synchronization tools.
- Validation, loading/error-state, and operational improvements exposed by real usage.

### Version 3

Build the self-hosted/mobile-recording path:

- Desktop/home-server hosting through Cloudflare Tunnel.
- Browser microphone recording.
- Capacitor Android application, then iOS.
- Native audio integrations only when real device behavior requires them.

### Version 4

Deepen collaboration based on real band usage:

- Invitations.
- Notes/instructions.
- Comments.
- Notifications.
- Private-sharing improvements.
- Project status/history.
- Other collaboration workflows justified by actual users.

## Non-Goals for the Near Term

GrooveShare does not currently need to become:

- A full DAW.
- A sample-accurate editing platform in Version 2.0.
- A native-first mobile application.
- A large microservice architecture.
- A cloud-object-storage system before server-local storage becomes a real limitation.
- A framework-heavy backend merely because it is multi-user.

The project should continue to add complexity only where real collaboration needs justify it.
