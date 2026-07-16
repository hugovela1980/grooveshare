# GrooveShare

GrooveShare is a lightweight browser-based music collaboration app for sharing audio stems, practicing parts, and eventually recording rough remote takes from bandmates.

The goal is not to build a full DAW. The goal is to build a simple, practical workflow where a musician can create a project, upload rough tracks, and eventually let collaborators listen, practice, adjust a basic mix, and send back rough takes.

## Current Status

GrooveShare is currently in **Phase 1: Local Pure Node Prototype**.

This phase is focused on learning and building the full frontend/backend flow with simple local tools before moving to a production-style backend.

Current development state:

* The backend has project metadata routes.
* The backend has local audio upload and track metadata routes.
* The frontend has API modules and controller modules for project creation and track upload.
* The frontend is being refactored from one large app shell into simple routed page templates.
* The routed UI is not fully reconnected yet.
* Audio files can be uploaded through the backend flow, but uploaded audio cannot yet be served and played in the browser.

## What GrooveShare Is

GrooveShare is intended to become a simple stem-player workflow for musicians.

A future Version 1 flow should look like this:

```txt
Project Menu
→ Create Project
→ Confirm Project
→ Project Player
→ Upload tracks
→ Play tracks in browser
```

A later collaboration flow may look like this:

```txt
Project owner creates a project
→ uploads guitar, drums, bass, click, or vocal tracks
→ shares a project link
→ collaborator opens the project
→ listens and adjusts the practice mix
→ records or uploads a rough part
```

## What GrooveShare Is Not

GrooveShare is not intended to be:

* A full digital audio workstation
* A professional mixing or mastering tool
* A replacement for Ableton, Logic, Pro Tools, Reaper, or Studio One
* A finished production app yet

The first goal is a useful local prototype and learning project.

## Tech Stack

### Frontend

* Vite
* Vanilla TypeScript
* Browser DOM APIs
* Fetch API
* Template-string based rendering
* Custom lightweight tests

No React is being used in the current phase.

### Backend

* Pure Node.js
* TypeScript
* Node HTTP server
* Node file system APIs
* Local JSON metadata storage
* Local uploaded file storage
* Custom lightweight tests

No Express, Multer, database, cloud storage, or authentication is being used yet.

## Project Structure

```txt
grooveshare/
  client/
    src/
      api/
      controllers/
      pages/
      router/
      templates/
      app.ts
      main.ts
      style.css
      types.ts
    tests/

  server/
    data/
      db.json
    src/
      stores/
      uploads/
      utils/
      app.ts
      server.ts
      types.ts
    tests/

  docs/
    architecture.md

  backlog.md
  README.md
```

## Main Folders

### `client/`

The browser app.

The client is responsible for:

* Rendering the UI
* Calling backend API routes
* Creating projects from the browser
* Uploading tracks from the browser
* Displaying project and track metadata
* Eventually playing uploaded audio files
* Eventually handling browser-based recording

Current frontend direction:

```txt
client/src/
  api/          API calls to the backend
  controllers/  Testable UI behavior modules
  pages/        Routed page templates
  router/       Simple client-side screen router
  templates/    Reusable markup templates
```

### `server/`

The local backend API.

The server is responsible for:

* Creating and reading projects
* Creating and reading track metadata
* Receiving uploaded audio files
* Saving uploaded files locally
* Writing metadata to `server/data/db.json`
* Returning JSON responses
* Handling local CORS for the Vite frontend

### `docs/`

Project documentation.

Current documentation:

```txt
docs/architecture.md
```

### `backlog.md`

Tracks current focus, next steps, future work, and completed milestones.

## Local Development Setup

The frontend and backend run as two separate local apps.

```txt
Frontend: http://localhost:5173
Backend:  http://localhost:3000
```

### 1. Install backend dependencies

From the project root:

```bash
cd server
npm install
```

### 2. Start the backend

```bash
npm run dev
```

The backend should run on:

```txt
http://localhost:3000
```

You can check the health route:

```txt
GET http://localhost:3000/api/health
```

### 3. Install frontend dependencies

Open a second terminal.

From the project root:

```bash
cd client
npm install
```

### 4. Start the frontend

```bash
npm run dev
```

The frontend should run on:

```txt
http://localhost:5173
```

## Available Scripts

### Client scripts

Run from `client/`:

```bash
npm run dev
```

Starts the Vite development server.

```bash
npm run build
```

Type-checks and builds the frontend.

```bash
npm run preview
```

Previews the production build locally.

```bash
npm test
```

Runs the custom frontend test runner.

```bash
npm run test:typecheck
```

Runs TypeScript type checking for the frontend tests.

### Server scripts

Run from `server/`:

```bash
npm run dev
```

Starts the backend in watch mode.

```bash
npm run typecheck
```

Runs TypeScript type checking for the backend.

```bash
npm run build
```

Compiles the backend TypeScript.

```bash
npm start
```

Runs the compiled backend from `dist/`.

```bash
npm test
```

Runs the custom backend test runner.

## Current Data Storage

Phase 1 uses local JSON metadata.

The main local metadata file is:

```txt
server/data/db.json
```

Current shape:

```json
{
  "projects": [],
  "tracks": []
}
```

Projects and tracks are stored separately.

A track belongs to a project through its `projectId`.

## Uploaded Files

Uploaded audio files are stored locally during Phase 1.

Runtime uploads are ignored by Git:

```txt
server/uploads/
```

The intended upload structure is:

```txt
server/uploads/projects/:projectId/
```

The JSON database stores metadata about uploaded files. It does not store the audio file contents.

## Current Data Models

### Project

```ts
type Project = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};
```

### Track

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

## Current API Routes

```txt
GET  /api/health
GET  /api/projects
POST /api/projects
GET  /api/projects/:projectId
POST /api/projects/:projectId/tracks
GET  /api/projects/:projectId/tracks
```

Likely next route:

```txt
GET /api/projects/:projectId/tracks/:trackId/audio
```

That route will allow the frontend to request and play uploaded audio files.

## API Response Shape

Successful responses use:

```json
{
  "ok": true,
  "data": {}
}
```

Error responses use:

```json
{
  "ok": false,
  "error": "Error message"
}
```

## Testing

GrooveShare uses custom lightweight TypeScript test runners instead of Jest or Vitest at this stage.

There are separate test setups:

```txt
client/tests/
server/tests/
```

The testing style is intentionally simple and inspired by the earlier `split-timer` project.

Current testing goals:

* Keep modules small and testable.
* Use dependency injection where possible.
* Avoid needing a full browser test environment.
* Test DOM-related behavior with fake DOM helpers.
* Test backend behavior with disposable test data files.

## Development Workflow

The project uses a branch-based workflow:

```txt
main      stable / release-ready code
develop   active integration branch
feature/* feature work
docs/*    documentation-only work
fix/*     bug fixes
refactor/* code cleanup without behavior changes
chore/*   setup, config, or maintenance
```

Typical workflow:

```txt
feature branch
→ pull request into develop
→ pull request into main when stable
```

## Current Development Note

The current routed frontend is in the middle of a refactor.

The app has started moving toward these screens:

```txt
project-menu
create-project
confirm-project
project-player
```

The next frontend task should be done surgically:

```txt
Reconnect Create Project form only
→ confirm it writes to server/data/db.json
→ navigate to Confirm Project after creation
→ return to Project Menu
→ reconnect track upload later
```

Do not reconnect project creation and track upload at the same time. The previous attempt tried to reconnect too much at once and made the app harder to reason about.

## Next Planned Tasks

Recommended next tasks:

1. Reconnect the Create Project form only.
2. Confirm that project creation writes to `server/data/db.json`.
3. Navigate to the Confirm Project page after successful project creation.
4. Return from Confirm Project to Project Menu.
5. Reconnect track upload after the project creation flow is stable.
6. Add a backend route to serve uploaded audio files.
7. Build single-track playback in the browser.
8. Build basic multitrack playback.
9. Add volume, mute, solo, and pan controls.

## Version Plan

### Version 1: Stem Player

Create the first useful MVP:

* Create a project
* Upload multiple audio files
* Open a project player
* Play uploaded tracks
* Add basic track controls such as volume, mute, solo, and pan

### Version 2: Record a Take

Add browser microphone recording so a collaborator can record a rough part.

### Version 3: Sync Tools

Add practical tools for rough remote recordings:

* Count-in
* Manual offset controls
* Nudge controls
* Waveform preview
* Trimming

### Version 4: Collaboration Polish

Add features that make the app feel more like a real remote band workflow:

* Share links
* Authentication
* Private projects
* Email notifications
* Comments
* Version history
* Collaborator names
* Project status

## Guiding Principles

* Keep the app understandable.
* Prefer small milestones.
* Prefer simple code before abstractions.
* Use tests to guide implementation when practical.
* Keep the workflow centered on musicians and bandmates.
* Build a useful stem player before adding recording.
* Use pure Node through Version 1 to understand the request, upload, file, and metadata flow.
* Move to Express, a real database, and cloud file storage only after the local Version 1 prototype works.
