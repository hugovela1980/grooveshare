# GrooveShare

GrooveShare is a lightweight browser-based music collaboration app for sharing audio stems, practicing parts, and eventually recording rough remote takes from bandmates.

The goal is not to build a full DAW. The goal is to build a simple, practical workflow where a musician can create a project, upload rough tracks, and eventually let collaborators listen, practice, adjust a basic mix, and send back rough takes.

## Current Status

GrooveShare is currently in **Phase 1: Local Pure Node Prototype**.

This phase is focused on building the full frontend/backend flow with simple local tools before moving to a production-style backend.

Current development state:

* The backend can create and read projects.
* The backend can upload local audio files and save track metadata.
* The frontend now uses a simple routed screen structure.
* The main routed flow is reconnected:

  * Project Menu
  * Create Project
  * Confirm Project
  * Project Player
* A user can create a project, confirm it, return to the Project Menu, open a selected project, and upload a track from the Project Player page.
* Uploaded track metadata can be displayed.
* Uploaded audio files are not playable in the browser yet.

## Current App Flow

The current working flow is:

```txt
Project Menu
→ Add Project
→ Create Project
→ Confirm Project
→ Project Menu
→ Open selected project
→ Project Player
→ Upload track
```

The next major goal is:

```txt
Serve uploaded audio files
→ Load one uploaded track in the browser
→ Play that track
```

## What GrooveShare Is

GrooveShare is intended to become a simple stem-player workflow for musicians.

A future Version 1 flow should look like this:

```txt
Project owner creates a project
→ uploads guitar, drums, bass, click, or vocal tracks
→ opens the Project Player
→ plays uploaded tracks
→ adjusts a basic practice mix
```

A later collaboration flow may look like this:

```txt
Project owner creates a project
→ uploads stems or rough tracks
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
      page-controllers/
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

## Frontend Structure

The frontend has been refactored into smaller responsibilities.

```txt
client/src/main.ts
```

Starts the browser app.

```txt
client/src/app.ts
```

Coordinates app state, routing, and page-specific initialization.

```txt
client/src/router/
```

Contains the simple client-side screen router.

```txt
client/src/pages/
```

Contains page-level HTML templates.

Current screens:

```txt
project-menu
create-project
confirm-project
project-player
```

```txt
client/src/page-controllers/
```

Contains page-specific behavior.

Current page controllers:

```txt
create-project-page-controller.ts
project-menu-page-controller.ts
project-player-page-controller.ts
```

```txt
client/src/templates/
```

Contains smaller reusable rendering helpers, such as project lists and track lists.

## Backend Structure

The backend is a pure Node TypeScript server.

It is responsible for:

* Creating and reading projects
* Creating and reading track metadata
* Receiving uploaded audio files
* Saving uploaded files locally
* Writing metadata to `server/data/db.json`
* Returning JSON responses
* Handling local CORS for the Vite frontend

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

Run from `client/`.

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

Run from `server/`.

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

The testing style is intentionally simple and inspired by an earlier lightweight test-runner pattern.

Current testing goals:

* Keep modules small and testable.
* Use dependency injection where practical.
* Avoid needing a full browser test environment.
* Test DOM-related behavior with fake DOM helpers.
* Test backend behavior with disposable test data files.

## Manual Test Flow

After starting both the backend and frontend, the current main manual test is:

```txt
Project Menu
→ click Add Project
→ create a project
→ Confirm Project page appears
→ click Submit
→ Project Menu appears
→ new project appears in the list
→ click the project
→ Project Player appears
→ upload an audio file
→ uploaded track appears in the Tracks list
```

Then check:

```txt
server/data/db.json
```

You should see the saved project inside `projects` and the uploaded track inside `tracks`.

You can also check:

```txt
server/uploads/
```

You should see the uploaded audio file saved under the selected project’s upload folder.

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
→ pull request or merge into develop
→ merge develop into main when stable
```

## Current Development Note

The current routing/page-controller refactor is complete enough to merge back into `develop` after tests and manual checks pass.

The app now has separated concerns:

```txt
main.ts
→ starts the app only

app.ts
→ coordinates routing, state, and page setup

router/
→ handles screen navigation

pages/
→ renders page markup

page-controllers/
→ handles page-specific behavior

templates/
→ renders reusable smaller UI pieces
```

This refactor was done so `main.ts` would no longer be responsible for rendering the full app, querying all DOM elements, and initializing all behavior.

## Next Planned Tasks

Recommended next tasks:

1. Serve uploaded audio files from the backend.
2. Add a frontend audio URL helper.
3. Load one uploaded track into an `<audio>` element.
4. Build single-track playback in the Project Player.
5. Build basic multitrack playback.
6. Add per-track volume, mute, solo, and pan controls.
7. Improve loading and error states.
8. Improve responsive layout for phone-sized screens.

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

Add practical tools for making rough remote recordings usable:

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
