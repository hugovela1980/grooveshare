# GrooveShare Architecture Notes

## Purpose

GrooveShare is a lightweight browser-based music collaboration tool for sharing audio stems, practicing parts, and building toward rough remote recording workflows.

The app is not intended to be a full DAW. The goal is to provide a focused workflow where a musician can create a project, upload audio tracks, review those tracks together, adjust a simple mix, and eventually capture rough collaborator takes.

## Product Direction

GrooveShare is built around a practical band workflow:

1. A user creates a project for a song idea, riff, section, rehearsal part, or practice track.
2. The user selects individual audio files such as drums, bass, guitars, vocals, click tracks, or scratch references.
3. The user reviews project details and selected tracks before creating the project.
4. The Project Player displays the uploaded files as channel slots.
5. The user chooses which channels are enabled, adjusts channel volume, loads the mix, and controls playback from a shared transport.
6. Later versions should support waveform display, nudge, trim, browser recording, and collaboration features.

The app should stay focused on collaboration and practice rather than becoming a full production environment.

## Current Phase

The stable release is **Version 1 v1.0.0**, but active development is now **Version 2 — Multi-User Hosted Beta**.

Version 2 Milestone 1 — Accounts and Authorization Foundation — is complete on the development path. The current server architecture includes:

* Vite + Vanilla TypeScript frontend.
* Pure Node TypeScript backend.
* PostgreSQL metadata persistence.
* Local filesystem audio storage.
* User accounts with hashed passwords.
* Server-managed authentication sessions.
* Project memberships with `viewer`, `contributor`, and `owner` roles.
* Server-side authorization for project, track, upload, edit, delete, mix, and membership-management operations.
* Track ownership through `uploadedByUserId`.
* A reusable workspace test-runner package.
* Authorization integration and PostgreSQL migration-behavior tests.
* Development seed/reset tooling protected from production use.

The current focus is **Version 2 Milestone 2 — Permission-Aware UI**. The client will be updated to participate in the session system and reflect the permissions already enforced by the server.

A later **Version 2.1 — Public Guest Sharing** patch is planned after the initial hosted release. Public guests will be able to use approved share links for anonymous read/play access and browser-local mix persistence without becoming project members.

## Version Plan

### Version 1: Four-Channel Stem Player

Version 1 v1.0.0 is the completed local MVP: project creation, up to four uploaded tracks, saved mix settings, inline project/track editing, multitrack playback, seeking, looping, and project/track deletion.

### Version 2: Multi-User Hosted Beta

Version 2 adds the production-oriented multi-user foundation and hosted workflow.

Milestone sequence:

1. **Accounts and Authorization Foundation — complete**
   PostgreSQL persistence, users, sessions, project memberships, Viewer/Contributor/Owner roles, track ownership, server authorization, integration coverage, and development tooling.

2. **Permission-Aware UI — current**
   Add register/login/logout/current-user UI, credentialed client API requests, role-aware controls, track-ownership-aware controls, and Owner member management.

3. **Production Configuration**
   Move deployment-sensitive values into environment-based configuration and remove local-development assumptions.

4. **VPS Deployment**
   Run the centralized service on a Linux VPS with PostgreSQL, persistent audio storage, HTTPS, process management, firewall rules, logs, and backups.

5. **Web Audio Engine and Sync Tools**
   Replace the multi-element playback engine when tighter synchronization, gapless looping, waveform display, nudge, trim, and edited playback are needed.

### Version 2.1: Public Guest Sharing

After the initial hosted authenticated release, add a separate anonymous share-link path:

* No registration/login required to open an approved public/share link.
* Guest may read shared project information and stream project tracks.
* Guest may enable/disable channels and adjust a personal mix.
* Guest mix settings persist only in that browser's `localStorage`.
* Guest mix settings are never written to PostgreSQL.
* Guest is not inserted into `project_memberships` and is not treated as a Viewer.
* Guest cannot upload, record, rename, delete, edit project data, manage members, or persist shared project settings.
* Server must explicitly authorize public/share reads and audio streaming; the client cannot safely bypass authenticated server routes.

The client architecture in Milestone 2 should therefore avoid assuming that every future route requires a `currentUser`.

### Version 3: Self-Hosted Mobile Recording

Move the centralized service toward desktop/home hosting through Cloudflare Tunnel, complete the mobile web experience, add browser microphone recording for Contributors, and package the client for Android/iOS with Capacitor.

### Version 4: Collaboration Workflow Polish

Expand based on real beta usage with invitations, comments, notifications, project status/history, stronger sharing controls, and other collaboration features that prove useful.

## High-Level Structure

```txt
grooveshare/
  sample-audio-files/
  client/
  server/
    db/
      migrations/
  packages/
    test-runner/
  docs/
    architecture.md
  backlog.md
  package.json
  docker-compose.yml
  README.md
```

The `sample-audio-files/` folder contains user-facing sample stems.

The `client/` folder contains the browser app.

The `server/` folder contains the pure Node backend, PostgreSQL migration files, database/store modules, authentication/authorization modules, upload behavior, and server tests.

The `packages/test-runner/` workspace contains the reusable custom TypeScript test runner used by the client and server suites.

The `docs/` folder contains project architecture notes, while `backlog.md` tracks current focus, planned work, and completed work.

## Frontend Architecture

The frontend is a Vite + Vanilla TypeScript app using browser DOM APIs rather than a frontend framework.

The frontend is responsible for:

* Rendering the GrooveShare interface.
* Calling backend API routes with `fetch`.
* Managing registration/login/logout/current-user UI during Version 2 Milestone 2.
* Sending session-aware requests to the backend.
* Displaying only projects returned as visible to the authenticated user.
* Reflecting Viewer/Contributor/Owner permissions in visible controls.
* Reflecting track ownership when deciding whether a Contributor should see rename/delete controls.
* Treating the server response as authoritative when an action is rejected.
* Managing project creation and pending track drafts.
* Uploading selected tracks.
* Rendering Project Player mixer and playback controls.
* Displaying loading, error, status, and session-expired states.
* Eventually supporting a separate public-share guest route that can exist without an authenticated `currentUser`.
* For public guests, storing personal mix settings in `localStorage` rather than sending project mix updates to the database.
* Eventually managing browser microphone recording through browser APIs for authorized Contributors.

Current frontend structure:

```txt
client/src/
  api/
  css/
    main.css
    _imports/
  dev/
  page-controllers/
  pages/
  project-draft/
  router/
  templates/
  app.ts
  main.ts
  types.ts
```

Module responsibilities remain separated:

* `api/` contains functions that communicate with the backend.
* `css/` contains the CSS entry point and organized stylesheet imports.
* `dev/` contains local-only development helpers.
* `page-controllers/` contains page-specific behavior.
* `pages/` contains page-level markup.
* `project-draft/` contains temporary create-project state.
* `router/` controls browser screens/routes.
* `templates/` contains repeated markup helpers.
* `types.ts` contains frontend types.

Page-level markup should stay in `pages/`, repeated markup in `templates/`, and page behavior in `page-controllers/` rather than accumulating in `main.ts`.

## CSS Architecture

The frontend uses a single CSS entry point at:

```txt
client/src/css/main.css
```

`main.css` imports organized CSS partials in this order:

1. Base tokens and global defaults.
2. Shared layout and utility classes.
3. Reusable components.
4. Page-specific styles.
5. Global responsive overrides, if needed.

Current CSS structure:

```txt
client/src/css/
  main.css
  _imports/
    base.css
    layout.css
    utilities.css
    components/
      audio-player.css
      buttons.css
      forms.css
      icons.css
      mix-channels.css
      modals.css
    pages/
      create-project.css
      home.css
      project-player.css
    responsive.css
```

The previous single-stylesheet approach has been replaced by the organized import structure.

Component-level styles should live in `components/` when they are reusable across pages or represent a self-contained UI piece. Page-level styles should live in `pages/` when they only describe a specific app screen.

## Frontend Screen Flow

The current app screens are:

```txt
project-menu
create-project
project-player
```

There is no separate confirmation screen in the current flow. The Create Project page contains its own confirmation modal.

### Project Menu

The Project Menu loads existing projects from the backend and lets the user select a project or start a new one.

The Project Menu does not delete projects. Project deletion is handled from the Project Player.

### Create Project

The Create Project page owns the complete create-project workflow.

The page collects:

* Project title.
* Project description.
* Pending audio files.
* Editable pending track names.

The Add Audio Tracks button opens the browser's native file picker directly. The selected files are added to `projectDraftState`, then rendered inline on the Create Project page. The user can rename pending tracks or remove them before submitting.

When the user clicks `Create a New Project`, the page opens a confirmation modal. The modal shows the project details and selected tracks. The user can choose:

* `Edit` to close the modal and return to the same Create Project page without losing draft data.
* `Submit` to create the project, upload selected tracks, clear the draft, and move directly to the Project Player.

### Project Player

The Project Player displays project-level playback and track management UI.

The Project Player contains:

* Project header and navigation.
* Persistently editable project title and description.
* Audio Player panel.
* Mix Channels panel.
* Track deletion controls.
* Project deletion control.

The Tracks panel renders up to four channel slots. Assigned slots use the numbered channel square as the enabled toggle and show an inline-editable persisted track name, live volume percentage/slider, waveform placeholder, and delete button. Empty slots remain visible and show an Add Track button so another audio file can be uploaded into the current project.

Saved mix settings are restored into the Mix Channels UI when the project is reopened. The Audio Player itself is not automatically loaded on page entry; the user still presses `Load Mix` to load the current mixer state into playback.

## Authentication, Authorization, and Guest Access Direction

### Authenticated users

Version 2 Milestone 1 establishes the server-side identity and permission model:

```txt
Authentication
  Who is making the request?

Authorization
  Is that user a member of this project?
  What role do they have?
  Do they own this contributed track?
  Is the requested action allowed?
```

Project roles are:

```txt
Viewer
  read/play

Contributor
  Viewer abilities
  upload/contribute
  manage their own contributed tracks
  use contribution-level project controls

Owner
  Contributor abilities
  manage all project tracks
  manage project details/deletion
  manage project memberships
```

The server is the security boundary. Milestone 2 will make the UI reflect these rules for usability, but hiding a button is not authorization.

The first permission-aware UI pass will keep the current email-based identity flow. Username-based login is a product decision to reassess after the complete UI can be experienced.

### Public guest users

Public Guest is a **separate access mode**, not a fourth project membership role.

A guest arrives through a future approved public/share link and is not inserted into `project_memberships`.

Target guest behavior:

```txt
public/share link
      ↓
anonymous guest
      ↓
read project metadata
read track metadata
stream audio
adjust enabled/volume mix locally
      ↓
localStorage only
```

Guest mix settings should be scoped to the project/share context in browser `localStorage`. They may survive reloads on the same browser, but they are not synchronized across devices and may disappear when browser storage is cleared.

The guest client must not call the persisted project mix-setting mutation route. The Owner's shared/database mix and the guest's personal browser mix are separate concepts.

Anonymous read/play cannot be implemented as a client-only patch because the current server protects project and audio routes. Version 2.1 will need explicit server-side public/share authorization for the resources a guest is allowed to read.

Guest collaboration actions remain blocked:

* no upload
* no recording
* no project/track edits
* no deletion
* no membership management
* no persisted shared mix mutation

When a guest wants to collaborate, they should register/authenticate and then receive an appropriate project role.

## Project Draft State

The project creation workflow uses temporary frontend draft state before submitting to the backend.

The draft state stores:

* Project title and description.
* Pending track drafts.
* The original selected `File` objects.
* Editable pending track names.
* Original filenames, MIME types, and file sizes.

This allows the user to review, edit, remove, and confirm selected tracks before the project and uploads are sent to the backend.

The draft is cleared only after the project is successfully created and pending tracks have been uploaded.

## Backend Architecture

The backend is a pure Node TypeScript server. `server/src/server.ts` wires the real development/production stores and starts the process; `server/src/app.ts` creates the testable HTTP application and route behavior.

Version 2 backend responsibilities include:

* Handling API requests and CORS.
* PostgreSQL-backed project, track, mix, user, session, and membership persistence.
* User registration/login/logout/current-user resolution.
* Password hashing and verification.
* Server-managed authentication sessions.
* Creating a project and assigning the authenticated creator as Owner.
* Resolving project memberships and Viewer/Contributor/Owner permissions.
* Enforcing server-side authorization before mutation handlers run.
* Recording track uploader identity.
* Allowing Contributors to manage their own tracks and Owners to manage any project track.
* Managing project memberships through Owner-only routes.
* Receiving and validating audio uploads.
* Saving audio files to project-specific local folders.
* Streaming audio with HTTP byte-range support.
* Deleting project/track metadata and related audio files.
* Supporting development-only seed/reset/authorization scenarios.
* Returning clear 401/403/404 distinctions where appropriate.

Current backend structure includes:

```txt
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
```

The data-access layer remains behind store interfaces. PostgreSQL is the real Version 2 implementation while JSON stores remain useful for isolated tests and storage abstraction.

The planned Version 2.1 guest-sharing work will add a deliberately narrow anonymous read path rather than weakening the authenticated membership checks used by normal project routes.

## Backend Framework Direction

The server currently continues to use Node's built-in HTTP, file-system, stream, and crypto capabilities rather than Express.

That choice is no longer meant to imply a toy backend. The route layer is now supported by separate authentication, authorization, store, upload, database, and development modules plus integration tests.

Moving to Express or another framework remains optional. It should happen only if routing/middleware/validation complexity creates enough friction to justify a migration; it is not required merely because the application is becoming multi-user.

## Frontend and Backend Communication

During local development:

```txt
Frontend: http://localhost:5173
Backend:  http://localhost:3000
```

The frontend calls the backend with `fetch`.

Because these are different origins, the backend allows the configured client origin through CORS and permits credentials. Version 2 Milestone 2 must make client API helpers send session credentials so the browser's authentication cookie participates in protected API calls.

Conceptually:

```txt
browser fetch
   + session cookie
        ↓
server
   authenticate user
        ↓
authorize project/track action
        ↓
perform or reject request
```

For the later guest-share route, the request may intentionally have no authenticated session. The server must distinguish a valid public/share read from a normal protected project request instead of simply disabling authentication globally.

## Data Storage Direction

Version 1 used local JSON metadata. Version 2 now uses PostgreSQL for application metadata while audio files continue to live on the server filesystem.

The current relational model includes tables for:

```txt
projects
tracks
project_mix_channels
users
sessions
project_memberships
```

SQL schema changes are tracked as migrations under:

```txt
server/db/migrations/
```

Local development uses separate development and test PostgreSQL databases configured through server environment variables.

Audio files remain separate from database metadata. Track records store the path and metadata needed to locate/serve those files.

JSON project/track stores remain in the codebase as alternate/test implementations of the same store contracts rather than the active production-direction persistence layer.

Version 2.1 introduces one intentional client-local data category: anonymous guest personal mix settings. Those settings belong in browser `localStorage`, not PostgreSQL, because they represent one guest/browser's listening preference rather than shared project state.

## Future Data Storage Direction

PostgreSQL is now the selected metadata database for Version 2.

Near-term production work should focus on operating that database safely on the VPS: environment configuration, migrations, backups, connection handling, and recovery expectations.

Uploaded audio remains on local server storage for the initial hosted beta. Object storage such as Cloudflare R2, S3, Supabase Storage, or another S3-compatible service can be introduced later if real usage makes server-disk storage inconvenient.

The database should continue to store metadata; audio/object storage should store audio bytes.

Guest `localStorage` mix data is intentionally outside both categories. It is ephemeral/personal client state and should not be treated as shared project persistence.

## Store Pattern

Backend route handlers call store interfaces instead of embedding persistence logic directly in HTTP routing code.

Current implementations include both JSON and PostgreSQL stores. The active Version 2 server wires PostgreSQL-backed stores, while JSON-backed stores remain useful for isolated tests and as evidence that the route layer is not coupled to one persistence technology.

Conceptually:

```txt
route / authorization layer
        ↓
ProjectsStore / TracksStore / UsersStore /
SessionsStore / ProjectMembershipsStore
        ↓
PostgreSQL implementation
```

This separation lets tests substitute disposable implementations and keeps SQL out of high-level request-routing logic.

Track rows returned by PostgreSQL are mapped from database naming such as `uploaded_by_user_id` into TypeScript application naming such as `uploadedByUserId`.

## Current Data Model

### Project

A project represents one song idea, riff, section, rehearsal part, or practice track.

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

Authenticated project creation also creates an Owner membership for the user who created it.

### Track

A track represents one uploaded audio file connected to a project.

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

`uploadedByUserId` is the server-side ownership link used to determine whether a Contributor may rename/delete a particular contribution. Legacy/dev-seeded tracks may have `null`; Owners can manage them while Contributors cannot claim them.

### User and Session

A User represents an account identity. Password hashes are stored server-side and are not returned as public user data.

A Session links an opaque browser session token (stored/compared securely by the server) to a user and expiration time so later requests can resolve the authenticated user.

The current account identity is email-based. Username-based login remains a product decision to reconsider after the permission-aware client flow is usable.

### Project Membership

A membership connects one User to one Project with a role:

```txt
viewer
contributor
owner
```

The role hierarchy is used for project-level `read`, `contribute`, and `manage` permissions.

Public guests planned for Version 2.1 are not represented by User or ProjectMembership records merely because they open a share link.

## API Direction

The API remains intentionally small but now includes authentication and membership management.

Current product routes include:

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

Most successful/error responses use the existing JSON envelope. Audio streaming is the main exception and supports byte ranges.

Protected project routes resolve authentication and authorization server-side. Typical outcomes are:

```txt
404  resource/project does not exist
401  authentication required
403  authenticated user lacks project/track permission
```

Development-only routes remain separate under `/api/dev/*` and should be unavailable in production.

Version 2.1 public sharing will require new or explicitly distinguished share/public routes. Anonymous access should be narrow and intentional; it should not convert the normal protected project endpoints into globally public endpoints.

## File Upload Direction

Audio uploads continue to use the pure Node upload path.

The current authenticated upload flow:

* Authorize the request for project `contribute` permission.
* Resolve the authenticated user's ID on the server.
* Validate the project and multipart upload.
* Validate supported file type and size.
* Save the file to the project-specific upload directory.
* Create PostgreSQL track metadata including `uploadedByUserId`.
* Return the created track to the client.
* Delete linked files when tracks/projects are deleted.

The uploader ID comes from the authenticated server session, not a client-supplied user ID.

Public guests in Version 2.1 will not have upload access. To contribute or later record a take, a guest must authenticate and receive a Contributor or Owner role.

## Deletion and Cleanup Direction

Deleting an individual track should remove the track metadata and the linked uploaded audio file. If that was the last uploaded file in the project folder, the backend should remove the now-empty project upload folder.

Deleting an entire project should remove:

* The project metadata.
* All track metadata linked to the project.
* All uploaded audio files linked to those tracks.
* The project upload folder.

The frontend should use these backend deletion routes rather than trying to manage local file cleanup itself.

## Project Player Direction

The Project Player is the center of the Version 1 playback experience.

The Project Player has two conceptual panels:

```txt
Tracks panel       = channel setup and per-track controls
Audio Player panel = global transport controls
```

### Tracks Panel

The Tracks panel owns channel setup.

Each channel slot may contain:

* A numbered channel square that acts as the enabled/disabled toggle.
* An inline-editable persisted track name.
* A volume slider with live percentage display.
* A waveform placeholder.
* Delete track action.
* Add Track action when the slot is empty.

Version 1 automatically assigns uploaded tracks to channel slots by order. The first uploaded track appears in Channel 1, the second in Channel 2, and so on, up to Channel 4.

Manual drag/drop assignment is not part of Version 1.

### Audio Player Panel

The Audio Player panel owns global playback controls.

The Audio Player is responsible for:

* Loading the enabled channel setup.
* Starting playback.
* Pausing and resuming playback without resetting position.
* Stopping playback and resetting to the beginning.
* Displaying a shared timestamp.
* Displaying a shared progress control and seeking all loaded channels to a shared position.
* Looping the loaded mix.

The Audio Player should not own per-track editing controls. Per-track controls should happen inside the Tracks panel.

## Version 1 Transport Expectations

Version 1 transport behavior should be clear and intentionally limited.

Supported in Version 1:

* `Load Mix` captures the current channel setup and persists occupied-channel enabled/volume settings to the project.
* Enabled channels are included in the loaded mix.
* Disabled channels are excluded from playback but their mixer settings are still persisted.
* Channel volume values are applied when the mix is loaded.
* The `Load Mix` button is visually dimmed while the visible mixer matches the loaded mix and becomes prominent when enabled/volume settings change.
* `Play` starts the loaded channels from a shared start point.
* `Pause` pauses the loaded mix while preserving the shared position; pressing Play again resumes from that position.
* `Stop` pauses all loaded channels and resets playback to the beginning.
* The progress control and timestamp represent the shared mix position.
* Releasing the progress slider seeks all loaded tracks to the same calculated time.
* The backend serves byte ranges so browser audio can resume from the requested seek position.
* The Loop checkbox restarts the loaded mix when playback reaches the end.

Known Version 1 transport limitations:

* Channel enabled and volume changes after `Load Mix` require loading the mix again before playback reflects those changes; the Load Mix current/modified state signals this.
* The current loop behavior may have a slight delay before restarting because it uses HTML audio elements and reacts to the browser's audio `ended` event.
* Seeking is functional, but the current multi-element transport does not provide DAW-level or sample-accurate synchronization.
* Gapless looping is deferred to the Web Audio engine.

## Version 2 Milestone 5 — Web Audio Engine Plan

Version 2 should replace multitrack playback with a Web Audio engine.

```md
- [ ] Replace multitrack playback with Web Audio engine
  Move multitrack playback from multiple HTML audio elements to a Web Audio based engine. Decode selected tracks into AudioBuffers, route each channel through Web Audio nodes, schedule playback from a shared AudioContext clock, and prepare the app for waveform display, gapless looping, nudge, trim, and edited playback.

  - [ ] Add audio buffer loading helper
    Fetch a track audio URL, decode it with `AudioContext.decodeAudioData`, and return an `AudioBuffer` for playback and waveform analysis.

  - [ ] Add Web Audio channel engine
    Create one channel object per loaded track with track metadata, an AudioBuffer, GainNode, enabled state, volume value, offset/nudge value, clip start, and clip end.

  - [ ] Replace HTML audio elements with Web Audio playback
    Keep the existing Project Player UI, but replace the underlying multitrack playback implementation with AudioContext, AudioBufferSourceNode, and GainNode behavior.

  - [ ] Add shared scheduled playback
    Start all enabled channels from the same AudioContext time so tracks begin together from a shared start point.

  - [ ] Add Web Audio pause, resume, and stop behavior
    Track the shared playback position manually so pause, resume, stop, and reset work predictably across the loaded mix.

  - [ ] Add gapless loop behavior
    Loop the loaded mix using Web Audio scheduling, buffer source loop settings, or scheduled restart logic instead of waiting for HTML audio ended events.

  - [ ] Add read-only waveform display for each channel
    Use the decoded AudioBuffer data to calculate waveform peaks and draw a simple waveform inside each channel slot.

  - [ ] Add shared playhead across channel waveforms
    Show one shared playhead position across all active channel waveforms so the user can see where playback is in the mix.

  - [ ] Add channel offset/nudge controls
    Let each channel store a timing offset in seconds. Add simple nudge controls so tracks can be shifted slightly earlier or later to help sync rough recordings.

  - [ ] Add non-destructive trim/clipping controls
    Let each channel store a clip start and clip end value without permanently editing the original audio file.

  - [ ] Add edited multitrack playback
    Make playback respect each channel's enabled state, volume, offset, clip start, and clip end values.

  - [ ] Preserve current UI controls
    Keep the existing Audio Player panel and channel slots, but make the controls operate through the Web Audio engine instead of direct HTML audio element playback.

  - [ ] Manually test full four-track Web Audio mixing and editing
    Upload up to four tracks, load the mix, play all enabled tracks together, adjust volume, toggle channels, loop playback, nudge tracks, trim clips, stop, restart, and verify the mix behaves predictably.
```

## Recording Direction

Recording is planned after the playback engine is stable.

The likely browser API direction is:

* `navigator.mediaDevices.getUserMedia`
* `MediaRecorder`

Recording should be treated as a rough collaboration tool. Phone and laptop microphone recordings may not be studio quality and may require headphones to avoid audio bleed.

Sync may not be perfect across all devices, so offset/nudge controls should exist before recording becomes a central workflow.

## Development Tooling Direction

GrooveShare keeps development tooling isolated from product behavior.

Existing helpers include frontend seed/reset controls plus server-side development routes and a role-aware authorization seed workflow.

The authorization seed tooling prepares a repeatable development scenario with:

```txt
Owner account
Contributor account
Viewer account
one project
three memberships
tracks owned by different users
```

The root command:

```bash
npm run seed-auth
```

exists to avoid manually rebuilding that scenario every time permission behavior needs to be exercised.

Development-only routes/commands must refuse production use. `NODE_ENV=development` is appropriate locally; `NODE_ENV=production` protects production deployments from development seed/reset behavior.

Development tooling should never become a required part of the normal user flow.

## Testing Direction

The repository uses the shared `@hugovela/test-runner` workspace for lightweight TypeScript testing.

Coverage should continue at several levels:

* API helpers — request shape, credential behavior, and response handling.
* Page controllers — DOM behavior and permission-aware visibility/actions.
* Templates — meaningful rendered markup.
* Router/app state — authentication and guest/public navigation.
* Store tests — PostgreSQL and alternate store contracts.
* Authentication/session tests — account and session behavior.
* Authorization tests — role and track-ownership rules.
* Integration tests — exercise real HTTP request flows with separate session cookies.
* Migration tests — verify schema constraints and migration behavior.

The existing authorization integration scenario acts like several automated users:

```txt
unauthenticated user
non-member
Viewer
Contributor
Owner
```

It sends HTTP requests with separate sessions and verifies allowed/forbidden outcomes across the same server behavior used by the app.

Milestone 2 should extend client coverage so the UI reflects those same rules without treating hidden buttons as the security boundary.

When Version 2.1 guest sharing is added, tests should explicitly verify that:
* guest read/audio routes work without a session only through approved share access;
* guest mutation routes remain forbidden;
* guest mix changes stay in `localStorage` and do not call the persisted project mix API.

