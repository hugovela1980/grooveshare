# GrooveShare

GrooveShare is a lightweight browser-based music collaboration app for creating song projects, adding audio tracks, and playing those tracks in a simple stem-player interface.

Version 1 is a local four-channel stem player. A user can create a project, add or seed audio tracks, open the Project Player, save and load a four-channel mix, edit project/track labels, and control playback from a shared Audio Player panel.

## Current Development Status

The stable release remains **v1.0.0**, but active development is now on **Version 2 — Multi-User Hosted Beta**.

Version 2 Milestone 1 is complete on the development path. The server now has PostgreSQL-backed project/track metadata, user accounts and sessions, project memberships, Viewer/Contributor/Owner authorization, track-upload ownership, membership-management routes, and integration tests for the permission model.

Version 2 Milestone 2 — Permission-Aware UI — is now complete on the development path. The browser client participates in the session system, uses authenticated API access, resolves the current user's project role, and presents role/ownership-aware controls while the server remains the actual security boundary.

The current focus is **Version 2 Milestone 3 — Production Configuration**. This milestone prepares the existing multi-user app for hosting without deploying it yet: deployment-sensitive values will move behind environment-based configuration, local-only assumptions will be removed, production-safe defaults/validation will be added, and the client/server origin strategy will be prepared around one stable public hostname.

Milestone 2 kept the current email-based account model. Username-based login remains a product decision to reconsider after the complete permission-aware flow has been used and evaluated.

### Planned Public Guest Mode

After the initial authenticated multi-user app is deployed, a Version 2.1 public-sharing patch is planned for low-friction listening. A person with a public/share link should be able to open shared projects without registering, read project information, stream tracks, and adjust a personal mix.

Guest mix settings will be stored in that browser's `localStorage`, not PostgreSQL. This lets the guest's mix survive reloads on the same browser without changing the Owner's persisted project mix. Public guests will not be project members and will not receive Viewer membership automatically. Uploading, recording, editing, deleting, member management, and other collaboration actions will continue to require authentication and the appropriate project role.


## Quick Start

> **Stable-release note:** this walkthrough describes the completed v1.0.0 user flow. Active Version 2 development now includes the multi-user authorization foundation and permission-aware client flow. Milestone 3 is focused on production configuration before the first VPS deployment.

GrooveShare includes four sample audio files at the project root so the Version 1 workflow can be tried immediately:

```txt
sample-audio-files/
  Bass.wav
  Delay Guitar.wav
  Drums.wav
  Tremolo Guitar.wav
```

1. Start the backend and frontend using the local setup instructions below, then open `http://localhost:5173`.
2. From the Project Menu, choose **Create Project**.
3. Enter a project title and description.
4. Click **Add Audio Tracks**. In the file picker, open the repository's `sample-audio-files/` folder and select the four sample `.wav` files.
5. Review the selected tracks, optionally edit their pending names, then click **Create a New Project** and submit the confirmation modal.
6. In the Project Player, use the numbered channel squares to enable or disable tracks and use the volume sliders to set each channel level.
7. Click **Load Mix** to save the current mix settings and load the enabled channels into the Audio Player. Use Play/Pause, Stop, Loop, the timestamp, and the progress slider to test playback and seeking.
8. Click a project title, description, or filled-channel track name to edit it inline. Press Enter or click away to finish editing; these text edits are saved to the project data.
9. After `Load Mix`, the button dims while the visible mixer matches the loaded mix. Changing a channel's enabled state or volume makes the button prominent again until the mix is loaded again.

The root `sample-audio-files/` folder is intended for the normal user-facing create-project workflow. The separate `server/data/seed-project/` folder is used by the development toolbar described later in this README.

## Running the App Locally

> **Version 2 development note:** the active multi-user branch requires PostgreSQL and server environment configuration in addition to the frontend/backend processes below. Use `server/.env.example` as the template for local values. Local development should use `NODE_ENV=development`; production will use `NODE_ENV=production`.


The app has two parts:

```txt
client/  Frontend app
server/  Backend API
```

The frontend and backend run in separate terminals.

### 1. Start the backend

From the project root:

```bash
cd server
npm install
npm run dev
```

The backend runs at:

```txt
http://localhost:3000
```

Health check:

```txt
http://localhost:3000/api/health
```

### 2. Start the frontend

Open a second terminal.

From the project root:

```bash
cd client
npm install
npm run dev
```

The frontend runs at:

```txt
http://localhost:5173
```

Open that URL in your browser to use the app.

## Running the App with Docker

This project includes a Docker Compose setup for local development.

From the project root:

```bash
docker compose up --build
```

Then open:

```txt
http://localhost:5173
```

The backend will be available at:

```txt
http://localhost:3000
```

### Useful Docker Commands

Start the app:

```bash
docker compose up
```

Start the app and rebuild the images:

```bash
docker compose up --build
```

Stop the running containers from the active terminal:

```txt
Ctrl + C
```

Fully shut down the Docker Compose app:

```bash
docker compose down
```

Run frontend tests inside Docker:

```bash
docker compose exec client npm test
docker compose exec client npm run typecheck
```

Run backend tests inside Docker:

```bash
docker compose exec server npm test
docker compose exec server npm run typecheck
```

## Current App Flow

The established Version 1 screen flow is:

```txt
Project Menu
→ Create Project
→ Project Player
```

The Create Project page owns the project creation workflow: collect title/description, select up to four audio files, review/edit pending track names, confirm the project, upload the selected tracks, and move to the Project Player.

The Project Player remains the center of playback and mixing. It renders up to four channel slots, supports enabled/disabled state and volume, loads the visible mix into the Audio Player, and provides project/track editing and deletion controls.

### Version 2 authenticated permission-aware flow

Version 2 Milestones 1 and 2 now work together: the server resolves authenticated sessions and enforces project roles, while the client participates in that session system and reflects the permissions returned by the application:

```txt
Open GrooveShare
→ Register or Log In
→ Resolve current user/session
→ Load only projects the user belongs to
→ Open Project Player
→ UI reflects Owner / Contributor / Viewer permissions
```

The target role behavior is:

```txt
Viewer
  read and play

Contributor
  read and play
  upload tracks
  manage their own contributed tracks
  use persisted project mix controls allowed by the server

Owner
  contributor abilities
  manage all tracks
  edit/delete the project
  manage project members
```

A later Version 2.1 public-share flow will add a second unauthenticated path:

```txt
Open public/share link
→ no login required
→ read project/track information
→ stream audio
→ adjust a personal mix
→ save that guest mix only in browser localStorage
```

The guest flow will not persist mix changes to PostgreSQL and will not grant upload/edit/delete/member-management permissions.

## Version 1 Transport Expectations

Version 1 uses browser audio elements for the current local stem-player implementation.

Expected transport behavior:

* `Load Mix` reads the current channel setup from the Tracks panel and persists the occupied-channel enabled/volume settings to the project.
* Enabled channels are included in the loaded mix.
* Disabled channels are excluded from playback but their saved mixer settings are preserved.
* Channel volume values are applied when the mix is loaded.
* `Play` starts the loaded channels together from a shared start point.
* `Pause` pauses the loaded mix and preserves the current playback position.
* `Stop` pauses the loaded mix and resets playback to the beginning.
* The progress control and timestamp represent the shared mix position.
* Releasing the progress slider seeks all loaded tracks to the same shared position. The backend supports HTTP byte-range responses for audio seeking.
* The Loop checkbox restarts the loaded mix when playback reaches the end.

Current Version 1 limitations:

* Changing a channel enabled state or volume after clicking `Load Mix` requires clicking `Load Mix` again before playback reflects the change; the button's current/modified appearance indicates when this is needed.
* Looping may have a small delay before the mix restarts because the current implementation uses HTML audio elements and reacts to the browser audio `ended` event.
* Seeking works through the shared progress control and HTTP byte-range audio responses, but the current transport is still not DAW-level or sample-accurate.
* Waveforms are placeholders only.
* Manual channel assignment, pan, solo, offset/nudge, and trim/clipping are not implemented yet.

Gapless looping, waveform display, nudge, trim, and edited playback are planned for a later Web Audio engine version.

## Project Structure

```txt
grooveshare/
  sample-audio-files/

  client/
    src/
      api/
      css/
      dev/
      page-controllers/
      pages/
      project-draft/
      router/
      templates/
      app.ts
      main.ts
      types.ts
    tests/

  server/
    db/
      migrations/
    data/
      seed-project/
    src/
      auth/
      db/
      dev/
      stores/
      uploads/
      app.ts
      server.ts
      types.ts
    tests/

  packages/
    test-runner/

  docs/
    architecture.md

  backlog.md
  docker-compose.yml
  package.json
  README.md
```

`sample-audio-files/` contains user-facing sample stems. `server/data/seed-project/` contains development seed audio. Runtime uploads remain outside version control. Version 2 metadata lives in PostgreSQL; SQL schema changes are tracked in `server/db/migrations/`. The shared custom tester lives in the `packages/test-runner/` workspace.

## Frontend Overview

The frontend uses Vite, TypeScript, browser DOM APIs, and organized CSS imports.

The frontend is organized around separated responsibilities:

```txt
api/
```

Contains reusable functions for calling the backend API.

```txt
css/
```

Contains the frontend stylesheet entry point and organized CSS imports for base styles, shared components, page styles, and responsive rules.

```txt
dev/
```

Contains local-only development helpers, such as the development toolbar.

```txt
main.ts
```

Starts the app and imports the CSS entry point.

```txt
app.ts
```

Coordinates app state, routing, and page setup.

```txt
pages/
```

Contains page-level HTML templates.

```txt
page-controllers/
```

Contains page-specific behavior.

```txt
project-draft/
```

Stores temporary project details and selected tracks before the project is submitted.

```txt
router/
```

Controls which screen is currently shown in the browser app.

```txt
templates/
```

Contains reusable smaller rendering helpers.

## Backend Overview

The backend is a pure Node TypeScript API.

Version 2 Milestone 1 expanded it from the Version 1 local JSON prototype into a PostgreSQL-backed multi-user server. It now handles:

* PostgreSQL-backed project, track, mix, user, session, and project-membership data.
* User registration, login, logout, and current-user resolution.
* Server-managed authentication sessions.
* Viewer / Contributor / Owner project memberships.
* Server-side authorization for project, track, upload, edit, delete, mix, and membership-management routes.
* Track ownership through `uploadedByUserId` so Contributors can manage their own contributions while Owners can manage all project tracks.
* Creating projects with the authenticated creator as Owner.
* Uploading and streaming local audio files, including HTTP byte-range seeking.
* Project and track cleanup on deletion.
* Development-only seed/reset tooling.
* Authorization integration tests and PostgreSQL migration-behavior tests.

The server remains the security boundary. The permission-aware client hides or disables controls for usability, but manually sending a forbidden HTTP request should still be rejected by the server.

## Data Storage

Version 2 development uses PostgreSQL for application metadata.

The local server environment identifies the development and test databases through `server/.env`, with non-secret example keys documented in `server/.env.example`.

PostgreSQL currently stores relational data such as:

```txt
projects
tracks
project_mix_channels
users
sessions
project_memberships
```

Uploaded audio files are still stored on the server filesystem under the runtime upload directory. Database metadata stores the file path and related track/project information.

SQL migrations live in:

```txt
server/db/migrations/
```

The Version 1 JSON stores remain useful as testable storage implementations and historical/local abstractions, but the active Version 2 server persistence path is PostgreSQL.

For the planned Version 2.1 guest mode, personal guest mix settings will be different: they will live in the guest browser's `localStorage` and will not be written to PostgreSQL.

## Current API Routes

Core and authentication routes include:

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

Development-only routes support seed/reset workflows, including the authorization-role test scenario. Development helpers are not product APIs and should return `404` when `NODE_ENV=production`.

Most routes return JSON. The audio route streams the stored file with its MIME type and supports `Range` requests for seeking.

The planned Version 2.1 guest-sharing work will require explicit server-side public/share access for project metadata, track metadata, and audio. It cannot be implemented securely as a client-only bypass of the authenticated routes.

## Development Tooling

The frontend development toolbar remains a local helper and can be toggled with the **`0` (zero) key** when enabled from `client/src/main.ts`.

It supports fast seed/reset workflows using audio from `server/data/seed-project/`. Version 2 authentication development also includes role-aware authorization seed tooling so an Owner, Contributor, and Viewer scenario can be prepared without manually rebuilding the database state each time.

The root convenience command:

```bash
npm run seed-auth
```

creates a development authorization playground with reserved development accounts, a project, memberships for the three roles, and tracks owned by different users. This is development data only.

Development-only routes/commands must not be available as production account-provisioning behavior. `NODE_ENV=production` is used to protect these helpers.

## Testing

GrooveShare uses the reusable `@hugovela/test-runner` workspace for lightweight TypeScript tests across the client and server.

Useful root commands include:

```bash
npm run test-client
npm run test-server
npm run test-runner
npm run test-all
npm run db:check
npm run verify
```

Server coverage now includes unit/store tests, API route tests, PostgreSQL store tests, authentication/session tests, project-membership tests, role/authorization integration tests, and migration-behavior tests.

The authorization integration suite exercises the system through HTTP requests using separate session cookies for Owner, Contributor, Viewer, unauthenticated, and non-member scenarios. This helps verify that authentication, memberships, roles, track ownership, routes, and storage behavior work together rather than only testing isolated helpers.

## Current Development Focus

**Version 2 Milestone 3 — Production Configuration**

Milestone 3 prepares GrooveShare for hosting without actually performing the VPS deployment. The goal is to make one codebase work predictably in local development and production by removing hard-coded deployment assumptions and validating the configuration needed at startup.

The milestone is planned in three larger chunks:

1. **Centralize server runtime configuration** — create one server configuration boundary for `NODE_ENV`, server port, allowed client origin, PostgreSQL connection settings, runtime upload directory, and other deployment-sensitive server values. Keep convenient development defaults where they are safe, require production-critical values in production, and add focused configuration tests so bad production settings fail early instead of surfacing as confusing runtime bugs.

2. **Make client/API origins deployment-aware and define the stable hostname contract** — remove hard-coded client API assumptions, make the browser API base configurable for development/production, and establish the production URL strategy. The preferred production shape is one stable user-facing HTTPS hostname with `/api` routed to the Node server by the reverse proxy; local development may continue using the separate Vite and Node origins. The exact public hostname should be chosen before the VPS milestone and then treated as stable even if the underlying server later changes.

3. **Production safety pass and configuration verification** — verify production cookie/CORS behavior, production-only upload paths, development-tool isolation, environment examples, startup validation, build/test commands, and the absence of accidental `localhost`/development dependencies in production-facing code. Finish with a development-vs-production configuration checklist and the full repository test/typecheck suite.

Milestone 3 does **not** install or operate the VPS. Linux server provisioning, reverse-proxy installation, HTTPS certificates, firewall rules, service/process management, backups, and live DNS cutover remain Milestone 4.

## Next Planned Work

Near-term Version 2 sequence:

1. Complete **Milestone 3 — Production Configuration**.
2. Complete **Milestone 4 — VPS Deployment** for the first trusted-user hosted beta.
3. Add **Version 2.1 — Public Guest Sharing** so a person with a share link can listen without an account and keep a browser-local personal mix.
4. Continue with the Web Audio/synchronization work when the hosted collaboration workflow is stable enough to justify deeper audio-engine changes.

Version 2.1 guest access is intentionally deferred rather than patched into the current client. The server must explicitly support anonymous read/audio access. The client-side portion will store guest mix settings in `localStorage` and never write those personal guest settings to the shared database.

## Roadmap

### Version 1: Four-Channel Stem Player

The completed v1.0.0 release established the local browser-based four-channel stem-player workflow: create projects, upload tracks, save/load a simple mix, edit project/track labels, and control shared playback.

### Version 2: Multi-User Hosted Beta

Version 2 turns the local prototype into a centralized multi-user application. The server foundation now uses PostgreSQL, user accounts/sessions, project memberships, Viewer/Contributor/Owner roles, track ownership, and server-side authorization.

Remaining Version 2 work centers on production configuration, VPS deployment, and later Web Audio/synchronization improvements. The permission-aware client milestone is complete on the development path.

### Version 2.1: Public Guest Sharing

Add public/share links for low-friction listening. Anonymous guests can read and stream shared projects without registering and can keep a personal enabled/volume mix in browser `localStorage`. Guest settings do not change the project database. Uploading, recording, editing, deletion, and member-management continue to require an authenticated account with the appropriate role.

### Version 3: Self-Hosted Mobile Recording

Move the centralized service toward desktop/home hosting through Cloudflare Tunnel, complete the mobile web experience, add browser microphone recording for Contributors, and package the proven client with Capacitor.

### Version 4: Mature Collaboration Platform

Build on real beta usage with richer invitations, comments, notifications, project history/status, private-sharing controls, and advanced audio/sync features where they solve demonstrated collaboration needs.

