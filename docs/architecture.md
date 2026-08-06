# GrooveShare Architecture Notes

## Purpose

GrooveShare is a lightweight browser-based music collaboration tool for sharing audio stems, practicing parts, and eventually capturing rough remote takes from bandmates.

The app is not intended to be a full DAW. The goal is to provide a simple workflow where one musician can create a project, upload rough tracks, share or review those tracks, and build toward a practical stem-player workflow for remote practice and collaboration.

## Product Direction

GrooveShare is built around a practical band workflow:

A user creates a project for a song idea, riff, section, or practice track. The user uploads individual audio files such as guitar, scratch drums, bass, vocals, or click tracks. A collaborator should eventually be able to open the project, listen to the tracks together, adjust the mix for practice, and record a rough part back into the project.

The app should stay focused on simple collaboration and practice rather than becoming a full music production environment.

## Current Phase

The project is currently in Phase 1.

Phase 1 is focused on building a local pure Node prototype while learning and controlling the full frontend/backend flow.

Current Phase 1 stack:

* Vite + Vanilla TypeScript frontend
* Pure Node TypeScript backend
* Local JSON metadata storage
* Local file storage
* Custom lightweight tests
* No React
* No Express
* No Multer
* No database
* No cloud storage
* No authentication yet

## Phase Plan

### Phase 1: Local Pure Node Prototype

Phase 1 uses Vite + Vanilla TypeScript on the frontend and a pure Node TypeScript backend. Data is stored locally using `server/data/db.json`, and uploaded files will be stored in local project folders.

This phase should include the full Version 1 stem player workflow before moving to Phase 2.

Phase 1 includes:

* Project metadata
* Local audio file upload
* Track metadata
* Project and track deletion
* Uploaded file and empty folder cleanup
* Serving uploaded audio files
* Single-track playback
* Multitrack playback
* Basic track controls
* Local JSON/file storage
* Custom lightweight tests

### Phase 2: Backend Framework and Persistent Services

Phase 2 should begin after Version 1: Stem Player is working.

This phase may replace the pure Node backend pieces with more production-friendly tools such as Express, PostgreSQL or Supabase, and cloud object storage.

The goal of Phase 2 is not to change the product direction, but to replace local prototype infrastructure with a more realistic backend architecture.

### Phase 3: Collaboration Features

Phase 3 adds collaboration features after the local stem player and more realistic backend architecture are in place.

This phase may include authentication, private share links, collaborator permissions, notifications, and remote recording workflows.

## Version Plan

### Version 1: Stem Player

Version 1 should create the first useful MVP.

The user should be able to create a project, upload multiple audio files, and open a project view where those tracks can be played. The player should eventually support basic track controls such as mute, solo, volume, and pan.

Version 1 should be completed while still using the Phase 1 architecture.

### Version 2: Record a Take

Version 2 should add browser microphone recording.

A collaborator should be able to listen to the uploaded tracks, record a rough part through the browser, save the recording, and make it available to the project owner.

### Version 3: Sync Tools

Version 3 should add practical tools for making rough phone recordings more usable.

This may include count-in behavior, manual offset/nudge controls, waveform preview, and trimming.

### Version 4: Collaboration Polish

Version 4 should make the app feel more like a real remote band workflow.

This may include email notifications, comments, version history, private links, collaborator names, and project status.

## High-Level Structure

The app is split into two main parts:

```txt
grooveshare/
  client/
  server/
  docs/
  backlog.md
  docker-compose.yml
  README.md
```

The `client/` folder contains the browser app.

The `server/` folder contains the pure Node backend.

The `docs/` folder contains project documentation such as architecture notes.

The `backlog.md` file tracks current focus, next steps, planned work, and completed work.

## Frontend Architecture

The frontend is a Vite + Vanilla TypeScript app.

Vite is used as the frontend development server, TypeScript build tool, and production bundler. Vite does not provide the UI structure itself. The app uses normal browser APIs rather than React or another frontend framework.

The frontend is responsible for:

* Rendering the GrooveShare interface
* Calling backend API routes with `fetch`
* Displaying project data returned from the backend
* Displaying readable loading/error/status messages
* Managing project creation UI
* Managing track upload UI
* Displaying uploaded track metadata
* Deleting individual tracks and projects through backend API calls
* Showing confirmation, success, and error messages for destructive actions
* Rendering the Project Player Tracks panel as channel slots
* Reading channel enabled state and volume settings before loading a mix
* Managing browser audio playback through the Audio Player panel
* Eventually managing browser microphone recording through browser APIs

Current frontend direction:

```txt
client/src/
  api/
  dev/
  page-controllers/
  pages/
  project-draft/
  router/
  templates/
  app.ts
  main.ts
  style.css
  types.ts
```

The frontend is organized around small modules:

* `api/` contains functions that communicate with the backend.
* `dev/` contains local-only development helpers, such as the development toolbar.
* `page-controllers/` contains page-specific behavior that can be tested with fake DOM helpers.
* `pages/` contains page-level markup for the main app screens.
* `project-draft/` contains temporary state for the multi-step project creation flow.
* `router/` controls which app screen is currently shown.
* `templates/` contains smaller reusable markup helpers.
* `types.ts` contains shared frontend types.

Markup may be created from TypeScript template strings. To keep the app organized as it grows, page-level markup should live in `pages/`, repeated markup should live in `templates/`, and page behavior should live in `page-controllers/` rather than being placed directly in `main.ts`.

## Backend Architecture

The backend is a pure Node TypeScript server.

The backend is responsible for:

* Handling API requests from the frontend
* Reading and writing local JSON metadata
* Creating and serving project data
* Receiving local audio uploads
* Saving uploaded files to project-specific local folders
* Creating track metadata records for uploaded files
* Serving uploaded audio files from local storage
* Deleting individual tracks and their uploaded files
* Deleting projects, linked track metadata, uploaded files, and project upload folders
* Returning clear JSON responses and error messages
* Handling CORS for the local Vite frontend
* Supporting local development reset behavior
* Supporting local development seed-project behavior from real audio files

Current backend direction:

```txt
server/
  data/
    db.json
    seed-project/
  src/
    dev/
    stores/
    uploads/
    app.ts
    server.ts
    types.ts
  tests/
```

The backend is separated into two startup/request layers:

* `server/src/server.ts` starts the real development server.
* `server/src/app.ts` creates the testable app server and route behavior.

The backend data access layer lives in `server/src/stores/`.

Upload-related helpers live in `server/src/uploads/`.

Development-only backend behavior, such as resetting local development data and seeding projects from local audio files, lives in `server/src/dev/`.

The current project and track stores use JSON storage, but they are shaped so future database-backed stores can use the same general function interfaces.

## Backend Framework Direction

Phase 1 intentionally uses Node’s built-in HTTP, file system, and stream tools instead of Express or Multer.

This is a learning and architecture choice. The goal is to understand how the app receives requests, handles file uploads, writes local files, and stores metadata before introducing higher-level backend libraries.

Multipart upload handling will be implemented with pure Node during Phase 1. This keeps the app aligned with the current learning stack and makes the upload flow more transparent.

In Phase 2, after Version 1: Stem Player is complete, the backend may move to Express or another framework to simplify routing, middleware, upload handling, validation, authentication, and production concerns.

## Frontend and Backend Communication

During local development, the frontend and backend run on separate local servers:

```txt
Frontend: http://localhost:5173
Backend:  http://localhost:3000
```

The frontend calls the backend using `fetch`.

Because the frontend and backend use different local origins, the backend must allow the frontend origin through CORS headers.

For Phase 1, the allowed frontend origin is:

```txt
http://localhost:5173
```

The backend should handle preflight `OPTIONS` requests for routes that receive JSON or uploads from the frontend.

## Data Storage Direction

In Phase 1, GrooveShare uses local JSON metadata instead of a database.

The current local metadata file is:

```txt
server/data/db.json
```

Local development seed audio files may live in:

```txt
server/data/seed-project/
```

Those seed files are used only for local development and manual testing.

The initial shape is:

```json
{
  "projects": [],
  "tracks": []
}
```

This is intentionally shaped like a small fake database. The top-level arrays map to future database tables:

```txt
projects → future projects table
tracks   → future tracks table
```

The JSON file should not store audio file contents. It should only store metadata.

Audio files should be stored separately in local folders.

## Future Data Storage Direction

In a later phase, JSON metadata should be replaced by a real database.

Likely future options include:

* PostgreSQL
* Supabase PostgreSQL
* Another managed database service

In a later phase, local audio file storage should be replaced by cloud object storage.

Likely future options include:

* Supabase Storage
* Cloudflare R2
* AWS S3
* Other S3-compatible storage

The database should store metadata. The object storage service should store audio files.

## Store Pattern

The backend should use store functions instead of placing raw JSON read/write logic directly in route handlers.

Current JSON store pattern:

```txt
server/src/stores/
  json-db.ts
  projects-json-store.ts
  tracks-json-store.ts
```

Current project store functions include:

```txt
getProjects()
getProjectById(projectId)
createProject(projectInput)
deleteProjectById(projectId)
```

Current track store functions include:

```txt
getTracksByProjectId(projectId)
createTrack(trackInput)
deleteTrackById(projectId, trackId)
```

The route layer should call these functions without needing to know whether data comes from a JSON file or a future database.

For testing, the JSON store can be created with a disposable test database path. This allows tests to verify real JSON file read/write behavior without modifying the real development database at `server/data/db.json`.

Future store direction:

```txt
projects-json-store.ts      → Phase 1 local JSON implementation
projects-postgres-store.ts  → possible Phase 2 database implementation
```

The goal is to keep the route layer stable while changing the storage implementation later.

## Current Data Model

### Project

A project represents one song idea, riff, section, or practice session.

Current project shape:

```ts
type Project = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};
```

A project is created from this input shape:

```ts
type CreateProjectInput = {
  title: string;
  description: string;
};
```

### Track

A track represents one uploaded audio file connected to a project.

Current track shape:

```ts
type Track = {
  id: string;
  projectId: string;
  name: string;
  originalFilename: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
};
```

Tracks should be stored separately from projects in the JSON metadata file, using `projectId` to connect a track to a project.

This keeps the Phase 1 JSON structure closer to a future relational database shape.

## API Direction

The API should stay small and grow only as needed.

Current routes:

```txt
GET    /api/health
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
DELETE /api/projects/:projectId
POST   /api/projects/:projectId/tracks
GET    /api/projects/:projectId/tracks
GET    /api/projects/:projectId/tracks/:trackId/audio
DELETE /api/projects/:projectId/tracks/:trackId
GET    /api/dev/seed-files
POST   /api/dev/seed-project
DELETE /api/dev/reset
```

Most routes return JSON responses.

Successful JSON response shape:

```json
{
  "ok": true,
  "data": {}
}
```

Error JSON response shape:

```json
{
  "ok": false,
  "error": "Error message"
}
```

The uploaded audio route is an exception to the normal JSON response pattern. `GET /api/projects/:projectId/tracks/:trackId/audio` returns the audio file bytes with the track's stored MIME type so the browser can load it in an audio element.

The `/api/dev/*` routes are local development helper routes. They should remain isolated from the normal product API and should not become part of the production app surface.

Likely future routes may include waveform peak data or saved mix/edit settings after the app reaches waveform display, nudge, trim, and clipping features.

## File Upload Direction

Phase 1 supports local audio uploads using pure Node.

The current upload flow:

* Receives an audio file from the frontend.
* Validates that the project exists.
* Validates that a file was provided.
* Validates that the file type is supported.
* Validates that the file is not too large.
* Saves the file to a local project-specific upload folder.
* Creates a track metadata record in `server/data/db.json`.
* Returns the created track metadata to the frontend.
* Displays uploaded track metadata in the client UI.
* Deletes uploaded files when tracks are deleted.
* Deletes linked uploaded files and project upload folders when projects are deleted.

Current local upload structure:

```txt
server/
  uploads/
    projects/
      project-id/
        random-id-sanitized-filename.wav
```

The upload implementation should stay modular so the local file-writing behavior can later be replaced with cloud object storage.

## Deletion and Cleanup Direction

Deleting an individual track should remove the track metadata and the linked uploaded audio file. If that was the last uploaded file in the project folder, the backend should remove the now-empty project upload folder. If other tracks still exist in the same project, the project upload folder should remain.

Deleting an entire project should remove the project metadata, all linked track metadata, all linked uploaded audio files, and the project upload folder. Project deletion should not remove metadata or files that belong to other projects.

## Audio Direction

GrooveShare needs browser-based audio playback for the Version 1 stem player workflow.

Current audio playback direction:

* Serve uploaded audio files from the backend.
* Load one uploaded audio file into the Audio Player.
* Play, pause, stop, seek, and show timestamps for a loaded audio file.
* Load enabled channel slots into a shared mix.
* Play two enabled tracks together from a shared start point.
* Apply the channel volume values that were present when the mix was loaded.

Near-term audio goals:

* Expand the channel slot layout from two channels to four channels.
* Automatically fill Channel 1 through Channel 4 from the first four uploaded tracks.
* Keep the Audio Player panel focused on global transport controls.
* Continue stabilizing shared progress and seek behavior for multitrack playback.

As the app grows, the Web Audio API may become important for better synchronized playback and per-track gain/pan routing.

The current early multitrack playback can use multiple audio elements as a learning/prototype step. Later, the app may move toward Web Audio API sources, gain nodes, pan nodes, and a shared audio context for more reliable stem playback.

The app should aim for practical rehearsal usefulness, not professional DAW-level editing.

## Project Player Mixer Direction

The Project Player should be organized around two separate responsibilities:

```txt
Tracks panel       = channel setup and per-track mix/edit controls
Audio Player panel = global playback transport
```

The Tracks panel should eventually contain four channel slots. Each channel slot represents one possible audio lane in the current project mix.

A channel slot may be empty or assigned to one uploaded track.

Each channel slot should own the controls and display elements that belong to an individual track:

* Assigned track name
* Enabled/on-off state
* Volume control
* Waveform display
* Offset/nudge controls
* Trim/clipping controls

The Audio Player panel should own only the global controls that affect the currently loaded mix:

* Play
* Pause
* Stop
* Restart/reset
* Shared progress control
* Shared timestamp display

This separation keeps the Project Player closer to a small stem mixer. The user configures the mix in the Tracks panel, then uses the Audio Player panel to control playback of the prepared mix.

The current prototype starts with two channel slots. The first two uploaded tracks automatically fill Channel 1 and Channel 2. Each assigned channel shows the track name, enabled toggle, volume slider, waveform placeholder, and delete action.

The `Load Mix` action reads the current channel setup from the Tracks panel. It gathers enabled channels, track names, audio URLs, channel numbers, and volume values, then prepares those channels for global playback in the Audio Player panel.

The Audio Player should play the enabled tracks together from a shared start point while respecting the volume setting captured when the mix was loaded.

The next mixer step is to expand the layout from two channels to four channels. Channel 1 through Channel 4 should automatically fill from the first four uploaded tracks for now, while leaving room for manual assignment later.

Waveforms should live inside the channel slots rather than inside the global Audio Player panel. This is because waveform editing is track-specific. Future nudge, trim, and clipping behavior will need to line up visually with each individual track's waveform.

The global Audio Player may still show a shared progress bar and timestamp, but detailed waveform editing should happen inside the Tracks panel.

## Recording Direction

Recording is planned for Version 2, not Version 1.

The likely browser API direction is:

* `navigator.mediaDevices.getUserMedia`
* `MediaRecorder`

Recording should be treated as a rough collaboration tool. Phone microphone recordings will not be studio quality and may require headphones to avoid audio bleed.

Sync may not be perfect across all devices, so later versions should include manual offset or nudge controls.

## Development Tooling Direction

GrooveShare includes local-only development tooling to make manual testing faster.

Current dev tooling includes:

* A frontend development toolbar in `client/src/dev/`.
* Backend development routes in `server/src/dev/`.
* A reset route that clears local development data.
* Seed-project routes that list real audio files from `server/data/seed-project/` and create a seeded project from the selected files.

The dev toolbar should be visible by default during local development. It can be toggled with the right arrow key so it can be hidden during normal UI testing without removing the code.

The toolbar should let the developer:

* See available seed audio files.
* Select which seed audio files to include.
* Create a seeded project from the selected real audio files.
* Reset local development data.

Development tooling should stay isolated so it can be removed later with minimal changes. The frontend hook should stay small, and most frontend dev behavior should live in `client/src/dev/`. Backend dev behavior should stay in `server/src/dev/`.

## Testing Direction

GrooveShare uses custom lightweight TypeScript test runners inspired by the split-timer project.

There are separate test setups for the backend and frontend:

```txt
server/tests/
client/tests/
```

The backend tests cover:

* The custom test runner
* JSON store behavior
* API route behavior
* Disposable JSON test databases
* Upload parsing and validation
* Uploaded file serving behavior
* Track and project deletion cleanup behavior

The frontend tests cover:

* The custom test runner
* Page controller behavior
* Template rendering behavior
* Frontend API helper behavior
* Fake DOM helpers
* Form behavior
* Error/status messaging
* Delete confirmation and status behavior
* Audio player controller behavior
* Mix channel slot template behavior
* Load Mix channel gathering behavior

Frontend tests should avoid requiring a full browser environment at this stage. Instead, they should use small fake DOM helpers and dependency injection, similar to the split-timer project.

As the app grows, frontend code should be organized into testable modules rather than putting all behavior directly in `main.ts`.

## Development Workflow

The project uses a branch workflow:

```txt
main       = stable / release-ready code
develop    = active integration branch
feature/*  = app features
docs/*     = documentation-only work
fix/*      = bug fixes
refactor/* = code cleanup without behavior changes
chore/*    = setup, config, or maintenance
```

Typical workflow:

```txt
feature branch → pull request into develop → pull request into main when stable
```

Documentation-only work should use a `docs/` branch.

Example:

```txt
docs/project-architecture
```

Feature work should use a `feature/` branch.

Example:

```txt
feature/project-metadata
```

## Current Completed Foundation

The project currently has:

* Vite + Vanilla TypeScript frontend
* Pure Node TypeScript backend
* Backend health endpoint
* Frontend/backend connection
* Root `.gitignore`
* Local `db.json` metadata store
* Project metadata types
* Tested JSON project store
* Tested project API routes
* Tested frontend page controllers
* Project creation UI wired to the API
* Readable frontend error handling for project loading and creation failures
* Custom backend test runner
* Custom client test runner
* Track metadata types
* Tested JSON track store
* Tested upload path helpers
* Tested multipart form data parser
* Tested upload validation
* Tested track upload API route
* Tested project track list API route
* Tested uploaded audio file route
* Tested track deletion API route
* Tested project deletion API route
* Frontend track upload form wired to the API
* Frontend uploaded track metadata display
* Frontend upload error handling
* Frontend track deletion UI
* Frontend project deletion UI from the Project Menu and Project Player
* Uploaded audio file cleanup when tracks or projects are deleted
* Empty project upload folder cleanup when the last track is deleted
* Single Audio Player panel with play, pause, stop, progress, and timestamp controls
* Single-track audio loading and playback path
* Two-channel mixer slot layout in the Project Player Tracks panel
* Load Mix behavior that gathers enabled channels and volume values
* Two-track mix playback from a shared start point
* Local development reset route and development toolbar
* Local seed-project audio file workflow for creating real test projects
* Cleaned frontend structure with legacy controller code removed
* Cleaned backend structure with unused utility code removed

## Current Limitations

The app is still early in Version 1.

Current limitations:

* The mixer currently supports a two-channel prototype, not the final four-channel layout.
* Channel assignment is automatic for now; manual assignment is not implemented yet.
* Changing channel enabled state or volume after clicking `Load Mix` may require loading the mix again before playback reflects the change.
* Multitrack playback is still a prototype and may need Web Audio API support for tighter synchronization later.
* Shared progress and seek behavior for multitrack playback still needs more design and testing.
* Waveforms are placeholders only.
* No offset/nudge controls yet.
* No trim/clipping controls yet.
* No share links yet.
* No recording yet.
* No authentication yet.
* No database yet.
* No cloud storage yet.
* No production deployment yet.

These limitations are intentional for Phase 1.

## Guiding Principles

Keep the app understandable.

Prefer small milestones.

Prefer simple code before abstractions.

Add structure when the project starts to need it, not before.

Keep the user workflow centered on musicians and bandmates who may not know how to use a DAW.

Build the first version as a useful stem player before adding recording or collaboration polish.

Use pure Node through Version 1 so the request, upload, stream, file, and metadata flow remains transparent.

Move to Express, database storage, and cloud file storage in Phase 2 only after the local Version 1 stem player is working.

Use tests to guide implementation whenever practical.

Use the project to practice real development workflow, including branches, commits, pull requests, documentation, and readable code.
