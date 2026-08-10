# GrooveShare

GrooveShare is a lightweight browser-based music collaboration app for creating song projects, adding audio tracks, and playing those tracks in a simple stem-player interface.

Version 1 is a local four-channel stem player. A user can create a project, add or seed audio tracks, open the Project Player, save and load a four-channel mix, edit project/track labels, and control playback from a shared Audio Player panel.

## Quick Start

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

The current app flow is:

```txt
Project Menu
→ Create Project
→ Project Player
```

The Create Project page owns the full project creation workflow:

* Enter project title and description.
* Click the Add Audio Tracks button to open the browser's native file picker.
* Select up to four audio files.
* Review selected tracks inline on the Create Project page.
* Edit pending track names before submission.
* Remove pending tracks before submission.
* Click `Create a New Project` to open a confirmation modal.
* Review project details and selected tracks in the modal.
* Submit the modal to create the project, upload the selected tracks, clear the draft, and move directly to the Project Player.

The Project Player uses a small stem-mixer layout:

```txt
Tracks panel       = channel setup
Audio Player panel = global playback controls
```

Current Project Player behavior includes:

* Displaying up to four uploaded tracks as Channel 1 through Channel 4.
* Automatically filling the channel slots from the first four uploaded tracks.
* Using each numbered channel square as the channel enable/disable toggle.
* Showing live volume percentages, a volume slider, waveform placeholder, and delete button for assigned channels.
* Keeping empty channel slots visible when fewer than four tracks exist.
* Showing an Add Track button in empty channel slots so a user can add another track to the current project.
* Editing project title, project description, and assigned track names inline and persisting those edits.
* Loading enabled channels into the Audio Player with `Load Mix`.
* Saving the occupied-channel enabled/volume settings whenever `Load Mix` succeeds so they can be restored when the project is reopened.
* Dimming `Load Mix` while the visible mixer still matches the loaded mix and making it prominent again when channel settings change.
* Playing, pausing, stopping, seeking, and resetting a loaded four-track mix from the Audio Player panel.
* Supporting a global Loop checkbox for the loaded mix.
* Deleting individual tracks and deleting entire projects with their linked track metadata and uploaded files.

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
    Bass.wav
    Delay Guitar.wav
    Drums.wav
    Tremolo Guitar.wav

  client/
    src/
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

`sample-audio-files/` contains the user-facing sample stems used by the Quick Start. `server/data/seed-project/` contains a separate copy of seed audio used by the dev toolbar to create test projects quickly. Runtime uploads go into `server/uploads/`, which is ignored by Git.

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

It currently handles:

* Creating and reading projects
* Updating project title and description
* Saving and restoring project mix settings
* Uploading tracks
* Reading track metadata
* Updating persisted track names
* Streaming uploaded audio files back to the browser, including byte-range responses for seeking
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
PUT    /api/projects/:projectId
PUT    /api/projects/:projectId/mix-settings
DELETE /api/projects/:projectId
POST   /api/projects/:projectId/tracks
GET    /api/projects/:projectId/tracks
PUT    /api/projects/:projectId/tracks/:trackId
GET    /api/projects/:projectId/tracks/:trackId/audio
DELETE /api/projects/:projectId/tracks/:trackId
GET    /api/dev/seed-files
POST   /api/dev/seed-project
DELETE /api/dev/reset
```

Most API routes return JSON responses. The audio route streams the uploaded file with the track's MIME type and supports `Range` requests, returning `206 Partial Content` when the browser seeks.

The `/api/dev/*` routes are development-only helper routes for local testing.

## Development Toolbar

The frontend development toolbar is mounted in `client/src/main.ts` with:

```ts
mountDevToolbar({ visibleByDefault: false, enabledByDefault: true });
```

With those settings, the toolbar is **hidden when the app first loads**, but its keyboard shortcut remains enabled.

Press the **`0` (zero) key** to show or hide the toolbar.

The toolbar provides two local-development shortcuts:

* **Seed project + selected tracks** — loads the available files from `server/data/seed-project/`, lets you choose which seed files to use, creates a temporary `Dev Seed Project`, copies those files into the normal runtime upload area, and reloads the app.
* **Reset dev data** — after confirmation, clears the local development database and removes runtime uploaded files, then reloads the app.

The seed-file checkboxes are selected by default, so pressing the seed button without changing the selection creates a project with all available seed tracks.

The toolbar uses the development-only backend routes under `/api/dev/*`. The backend returns `404` for those routes when `NODE_ENV=production`.

The toolbar's seed files are separate from the root `sample-audio-files/` directory: use `sample-audio-files/` to exercise the normal Create Project upload flow, and use the dev toolbar when you want a faster test setup.

## Testing

The app uses custom lightweight TypeScript test runners.

Run frontend tests from `client/`:

```bash
npm test
npm run typecheck
```

Run backend tests from `server/`:

```bash
npm test
npm run typecheck
```

## Current Development Focus

The Version 1 local four-channel stem player is now in its final stabilization/release pass.

Recent Version 1 work includes:

* A four-slot Mix Channels UI with numbered enable/disable controls and live volume percentages.
* Persisted mix settings saved through `Load Mix` and restored when a project is reopened.
* A current/modified visual state for the `Load Mix` button.
* Inline persistent editing of project title, project description, and track names.
* Shared play, pause/resume, stop, loop, timestamp, and seek behavior for loaded tracks.
* HTTP byte-range audio streaming so the progress slider can seek without restarting from byte zero.
* Add Track and Delete Track behavior directly from the Project Player.
* Project deletion with linked metadata/upload cleanup and audio shutdown.
* A root `sample-audio-files/` set for the normal Quick Start workflow.
* Development seed/reset tooling for faster manual testing.


## Next Planned Work

Before tagging or publishing Version 1:

* Run the full client and server test/typecheck suites.
* Complete one final manual pass through the Quick Start workflow.
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

Version 1 lets a user create a project, upload multiple audio files, open a Project Player, save/load up to four tracks as a mix, edit project and track labels, and control playback from a shared Audio Player panel.

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
