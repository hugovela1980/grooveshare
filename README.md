# GrooveShare

GrooveShare is a lightweight browser-based music collaboration app for creating song projects, adding audio tracks, and eventually playing those tracks back in a simple project player.

The goal is to build a practical music-sharing workflow for rough song ideas, practice tracks, and remote collaboration.

## Running the App Locally

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

You can test it in the browser with:

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

This project includes a Docker Compose setup for development. This lets a collaborator run the frontend and backend without installing Node directly on their machine.

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

```bash
Ctrl + C
```

Fully shut down the Docker Compose app:

```bash
docker compose down
```

Run frontend tests inside Docker:

```bash
docker compose exec client npm test
docker compose exec client npm run test:typecheck
```

Run backend tests inside Docker:

```bash
docker compose exec server npm test
docker compose exec server npm run typecheck
```

## Current App Flow

The current app flow is:

```txt
Project Menu
→ Create Project
→ Confirm Project
→ Project Player
```

The user can create a project, include a track during the project creation flow, confirm the project, and then view the project in the Project Player. The app also supports deleting individual tracks and deleting entire projects with their linked track metadata and uploaded files.

## Project Structure

```txt
grooveshare/
  client/
    src/
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
    tests/

  server/
    data/
      db.json
    src/
      dev/
      stores/
      uploads/
      app.ts
      server.ts
      types.ts
    tests/

  docs/
    architecture.md
  backlog.md
  docker-compose.yml
  README.md
```

## Frontend Overview

The frontend uses Vite, TypeScript, and browser DOM APIs.

The frontend is organized around separated responsibilities:

```txt
api/
```

Contains reusable functions for calling the backend API.

```txt
dev/
```

Contains local-only development helpers, such as the development toolbar.

```txt
main.ts
```

Starts the app.

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

It currently handles:

* Creating projects
* Reading projects
* Uploading tracks
* Reading track metadata
* Deleting individual tracks
* Deleting projects and linked tracks
* Cleaning up uploaded audio files and empty project upload folders
* Saving metadata to a local JSON file
* Saving uploaded audio files locally
* Supporting local development reset tools

## Local Data Storage

Project and track metadata are stored in:

```txt
server/data/db.json
```

Uploaded audio files are stored in:

```txt
server/uploads/
```

The `server/uploads/` folder is ignored by Git because it contains runtime upload files. When tracks or projects are deleted, the backend also cleans up the related uploaded files and removes empty project upload folders.

## Current API Routes

```txt
GET    /api/health
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
DELETE /api/projects/:projectId
POST   /api/projects/:projectId/tracks
GET    /api/projects/:projectId/tracks
DELETE /api/projects/:projectId/tracks/:trackId
DELETE /api/dev/reset
```

## Testing

The app uses custom lightweight TypeScript test runners.

Run frontend tests from `client/`:

```bash
npm test
npm run test:typecheck
```

Run backend tests from `server/`:

```bash
npm test
npm run typecheck
```

## Current Development Focus

The current focus is moving from project and track management toward browser audio playback.

Recent work has focused on:

* Separating pages from page controllers
* Adding a simple client-side router
* Moving project creation into a draft flow
* Moving track selection into the Create Project flow
* Keeping Project Player focused on displaying the selected project and its tracks
* Adding delete flows for individual tracks and entire projects
* Cleaning up uploaded audio files and empty upload folders after deletions
* Removing unused legacy frontend controller code and an unused backend utils folder

## Next Planned Work

Likely next steps:

* Serve uploaded audio files from the backend
* Add a real audio player placeholder implementation
* Load one uploaded track into an audio element
* Add basic playback controls
* Build toward multitrack playback from a shared start point

## Long-Term Goals

GrooveShare is being built in stages. The long-term goal is to move from a simple local stem player into a practical remote music collaboration tool.

For more detail, see the full [architecture notes](./docs/architecture.md).

### Version 1: Stem Player

The first useful version of GrooveShare is a browser-based stem player.

The goal is for a user to create a project, upload multiple audio files, open a project player, and play the uploaded tracks. This version should eventually support basic track controls such as volume, mute, solo, and pan.

### Version 2: Record a Take

After the stem player works, the next goal is browser-based recording.

A collaborator should be able to listen to the uploaded tracks, record a rough part through the browser, save that recording, and make it available to the project owner.

### Version 3: Sync Tools

After recording is possible, GrooveShare should add tools that make rough remote recordings more usable.

This may include count-in behavior, manual offset controls, nudge controls, waveform preview, and trimming.

### Version 4: Collaboration Polish

The final long-term goal is to make GrooveShare feel more like a real remote band workflow.

This may include private share links, authentication, collaborator permissions, comments, notifications, version history, collaborator names, and project status.