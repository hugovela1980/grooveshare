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

The user can create a project, include a track during the project creation flow, confirm the project, and then view the project in the Project Player.

## Project Structure

```txt
grooveshare/
  client/
    src/
      api/
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
      stores/
      uploads/
      app.ts
      server.ts
      types.ts
    tests/

  docker-compose.yml
  README.md
```

## Frontend Overview

The frontend uses Vite, TypeScript, and browser DOM APIs.

The frontend is organized around separated responsibilities:

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
* Saving metadata to a local JSON file
* Saving uploaded audio files locally

## Local Data Storage

Project and track metadata are stored in:

```txt
server/data/db.json
```

Uploaded audio files are stored in:

```txt
server/uploads/
```

The `server/uploads/` folder is ignored by Git because it contains runtime upload files.

## Current API Routes

```txt
GET  /api/health
GET  /api/projects
POST /api/projects
GET  /api/projects/:projectId
POST /api/projects/:projectId/tracks
GET  /api/projects/:projectId/tracks
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

The current focus is tidying the frontend so the project is easier for collaborators to understand and work on.

Recent work has focused on:

* Separating pages from controllers
* Adding a simple client-side router
* Moving project creation into a draft flow
* Moving track selection into the Create Project flow
* Keeping Project Player focused on displaying the selected project and its tracks

## Next Planned Work

Likely next steps:

* Finish polishing the page layouts
* Serve uploaded audio files from the backend
* Add a real audio player placeholder implementation
* Load one uploaded track into an audio element
* Add basic playback controls
* Later, add delete actions for tracks and projects
