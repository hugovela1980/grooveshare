# GrooveShare

GrooveShare is a lightweight browser-based music collaboration app for creating song projects, adding audio tracks, and playing those tracks in a simple stem-player interface.

The current Version 1 goal is a local four-channel stem player. A user can create a project, upload or seed audio tracks, open the Project Player, load up to four tracks into channel slots, and control playback from a shared Audio Player panel.

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

The Project Player uses a small stem-mixer layout:

```txt
Tracks panel       = channel setup
Audio Player panel = global playback controls
```

Current Project Player behavior includes:

* Displaying up to four uploaded tracks as Channel 1 through Channel 4.
* Automatically filling the channel slots from the first four uploaded tracks.
* Showing an enabled toggle, volume slider, waveform placeholder, and delete button for assigned channels.
* Keeping empty channel slots visible when fewer than four tracks exist.
* Loading enabled channels into the Audio Player with `Load Mix`.
* Playing, pausing, stopping, and resetting a loaded four-track mix from the Audio Player panel.
* Supporting a global Loop checkbox for the loaded mix.
* Deleting individual tracks and deleting entire projects with their linked track metadata and uploaded files.

## Version 1 Transport Expectations

Version 1 uses browser audio elements for the current local stem-player implementation.

Expected transport behavior:

* `Load Mix` reads the current channel setup from the Tracks panel.
* Enabled channels are included in the loaded mix.
* Disabled channels are excluded from the loaded mix.
* Channel volume values are applied when the mix is loaded.
* `Play` starts the loaded channels together from a shared start point.
* `Pause` pauses the loaded mix.
* `Stop` pauses the loaded mix and resets playback to the beginning.
* The progress control and timestamp represent the shared mix position.
* The Loop checkbox restarts the loaded mix when playback reaches the end.

Current Version 1 limitations:

* Changing a channel enabled state or volume after clicking `Load Mix` may require clicking `Load Mix` again before playback reflects the change.
* Looping may have a small delay before the mix restarts because the current implementation uses HTML audio elements and reacts to the browser audio `ended` event.
* Progress and seek behavior are prototype-level for multitrack playback and may be replaced when the app moves to a Web Audio engine.
* Waveforms are placeholders only.
* Manual channel assignment, pan, solo, offset/nudge, and trim/clipping are not implemented yet.

Gapless looping, waveform display, nudge, trim, and edited playback are planned for a later Web Audio engine version.

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
      seed-project/
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

`server/data/seed-project/` contains local development audio files that can be used by the dev toolbar to seed a test project. Runtime uploads go into `server/uploads/`, which is ignored by Git.

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
* Serving uploaded audio files back to the browser
* Deleting individual tracks
* Deleting projects and linked tracks
* Cleaning up uploaded audio files and empty project upload folders
* Saving metadata to a local JSON file
* Saving uploaded audio files locally
* Listing local seed audio files for development
* Creating seeded development projects from selected real audio files
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
GET    /api/projects/:projectId/tracks/:trackId/audio
DELETE /api/projects/:projectId/tracks/:trackId
GET    /api/dev/seed-files
POST   /api/dev/seed-project
DELETE /api/dev/reset
```

Most API routes return JSON responses. The audio route returns the uploaded audio file content with the track's MIME type.

The `/api/dev/*` routes are development-only helper routes for local testing.

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

The current focus is finishing the Version 1 four-channel stem player.

Recent work has focused on:

* Serving uploaded audio files from the backend.
* Adding a single Audio Player panel with play, pause, stop, loop, progress, and timestamp controls.
* Replacing the simple track list with channel slots in the Project Player Tracks panel.
* Rendering the first four uploaded tracks as Channel 1 through Channel 4.
* Adding a `Load Mix` action that reads enabled channel slots and volume settings.
* Playing a loaded four-track mix from a shared start point.
* Updating the dev toolbar so it can seed projects from real audio files in `server/data/seed-project/`.
* Keeping delete flows for individual tracks and entire projects.
* Cleaning up uploaded audio files and empty upload folders after deletions.

## Next Planned Work

Likely next steps before declaring Version 1 complete:

* Confirm the full four-track stem-player workflow through manual testing.
* Keep the README, architecture notes, and backlog aligned with the current app behavior.
* Run all frontend and backend tests and typechecks.
* Merge the stable Version 1 work to `main`.

Planned Version 2 work:

* Replace multitrack playback with a Web Audio engine.
* Add gapless loop behavior.
* Add read-only waveform displays inside channel slots.
* Add shared playhead behavior across channel waveforms.
* Add offset/nudge and non-destructive trim/clipping controls.

## Roadmap

### Version 1: Four-Channel Stem Player

The first useful version of GrooveShare is a browser-based four-channel stem player.

The goal is for a user to create a project, upload multiple audio files, open a Project Player, load up to four tracks into a mix, and control playback from a shared Audio Player panel.

### Version 2: Web Audio Mixer Engine

After the local stem player works, the next goal is a Web Audio based playback engine.

This version should support better synchronized playback, gapless looping, waveform display, shared playhead behavior, offset/nudge controls, and non-destructive trim/clipping.

### Version 3: Record a Take

After the playback engine is stable, the next goal is browser-based recording.

A collaborator should be able to listen to the uploaded tracks, record a rough part through the browser, save that recording, and make it available in the project.

### Version 4: Collaboration and Production Services

Later versions should make GrooveShare feel more like a complete remote collaboration workflow.

This may include private share links, authentication, collaborator permissions, comments, notifications, version history, persistent database storage, cloud audio storage, and production deployment.

For more detail, see the full [architecture notes](./docs/architecture.md).
