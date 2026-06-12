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
* Eventually managing upload forms
* Eventually managing browser audio playback
* Eventually managing microphone recording through browser APIs

Current frontend direction:

```txt
client/src/
  main.ts
  style.css
  types.ts
  api/
  controllers/
  templates/
```

The frontend is organized around small modules:

* `api/` contains functions that communicate with the backend.
* `controllers/` contains UI behavior that can be tested with fake DOM helpers.
* `templates/` contains functions that return markup strings.
* `types.ts` contains shared frontend types.

Markup may be created from TypeScript template strings. To keep the app organized as it grows, larger markup sections should live in focused template modules rather than being placed directly in `main.ts`.

## Backend Architecture

The backend is a pure Node TypeScript server.

The backend is responsible for:

* Handling API requests from the frontend
* Reading and writing local JSON metadata
* Creating and serving project data
* Eventually receiving audio uploads
* Eventually serving uploaded audio files from local storage
* Returning clear JSON responses and error messages
* Handling CORS for the local Vite frontend

Current backend direction:

```txt
server/
  data/
    db.json
  src/
    app.ts
    server.ts
    types.ts
    stores/
    utils/
  tests/
```

The backend is separated into two startup/request layers:

* `server/src/server.ts` starts the real development server.
* `server/src/app.ts` creates the testable app server and route behavior.

The backend data access layer lives in `server/src/stores/`.

The current project store uses JSON storage, but it is shaped so a future database-backed store can use the same general function interface.

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
server/src/stores/projects-json-store.ts
```

Current project store functions include:

```txt
getProjects()
getProjectById(projectId)
createProject(projectInput)
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

Planned track shape:

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
GET  /api/health
GET  /api/projects
POST /api/projects
GET  /api/projects/:projectId
```

Likely next routes:

```txt
POST /api/projects/:projectId/tracks
GET  /api/projects/:projectId/tracks
GET  /api/projects/:projectId/tracks/:trackId/audio
```

Routes should return JSON responses.

Successful response shape:

```json
{
  "ok": true,
  "data": {}
}
```

Error response shape:

```json
{
  "ok": false,
  "error": "Error message"
}
```

## File Upload Direction

Phase 1 will support local audio uploads using pure Node.

The upload flow should:

* Receive an audio file from the frontend.
* Validate that the project exists.
* Validate that a file was provided.
* Validate that the file type is supported.
* Save the file to a local project-specific upload folder.
* Create a track metadata record in `server/data/db.json`.
* Return the created track metadata to the frontend.

Planned local upload structure:

```txt
server/
  uploads/
    projects/
      project-id/
        track-id-original-filename.wav
```

The exact folder and filename pattern may change during implementation.

The upload implementation should stay modular so the local file-writing behavior can later be replaced with cloud object storage.

## Audio Direction

GrooveShare will eventually need browser-based audio playback.

Early audio goals:

* Load one uploaded audio file.
* Play and pause one track.
* Load multiple uploaded audio files.
* Start multiple tracks together.
* Add volume controls.
* Add mute and solo behavior.
* Add pan controls.

As the app grows, the Web Audio API may become important for better synchronized playback and per-track gain/pan routing.

The app should aim for practical rehearsal usefulness, not professional DAW-level editing.

## Recording Direction

Recording is planned for Version 2, not Version 1.

The likely browser API direction is:

* `navigator.mediaDevices.getUserMedia`
* `MediaRecorder`

Recording should be treated as a rough collaboration tool. Phone microphone recordings will not be studio quality and may require headphones to avoid audio bleed.

Sync may not be perfect across all devices, so later versions should include manual offset or nudge controls.

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

The frontend tests cover:

* The custom test runner
* Controller behavior
* Fake DOM helpers
* Form behavior
* Error/status messaging

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
* Tested frontend project form controller
* Project creation UI wired to the API
* Readable frontend error handling for project loading and creation failures
* Custom backend test runner
* Custom client test runner

## Current Limitations

The app is still early in Version 1.

Current limitations:

* No audio uploads yet
* No track metadata creation yet
* No uploaded audio serving yet
* No audio playback yet
* No project detail page yet
* No share links yet
* No recording yet
* No authentication yet
* No database yet
* No cloud storage yet
* No production deployment yet

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
