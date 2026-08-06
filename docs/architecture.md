# GrooveShare Architecture Notes

## Purpose

GrooveShare is a lightweight browser-based music collaboration tool for sharing audio stems, practicing parts, and building toward rough remote recording workflows.

The app is not intended to be a full DAW. The goal is to provide a focused workflow where a musician can create a project, upload audio tracks, review those tracks together, adjust a simple mix, and eventually capture rough collaborator takes.

## Product Direction

GrooveShare is built around a practical band workflow:

1. A user creates a project for a song idea, riff, section, rehearsal part, or practice track.
2. The user uploads individual audio files such as drums, bass, guitars, vocals, click tracks, or scratch references.
3. The Project Player displays the uploaded files as channel slots.
4. The user chooses which channels are enabled, adjusts channel volume, loads the mix, and controls playback from a shared transport.
5. Later versions should support waveform display, nudge, trim, browser recording, and collaboration features.

The app should stay focused on collaboration and practice rather than becoming a full production environment.

## Current Phase

The project is currently in the local Version 1 stem-player phase.

Current Version 1 stack:

* Vite + Vanilla TypeScript frontend
* Pure Node TypeScript backend
* Local JSON metadata storage
* Local file storage
* Custom lightweight TypeScript tests
* Local development seed/reset tooling

Version 1 should remain small and focused: create projects, upload audio files, load up to four tracks into a mix, and control playback in the browser.

## Version Plan

### Version 1: Four-Channel Stem Player

Version 1 is the first useful MVP.

The user should be able to:

* Create a project.
* Upload or seed multiple audio files.
* Open a Project Player.
* See up to four channel slots.
* Automatically fill Channel 1 through Channel 4 from the first four uploaded tracks.
* Enable or disable each assigned channel.
* Adjust channel volume before loading the mix.
* Load the selected channel setup into the Audio Player.
* Play, pause, stop, loop, and reset the loaded mix from a shared transport.
* Delete individual tracks.
* Delete entire projects and their linked uploaded files.

Version 1 uses the current local Node, JSON, and file-storage architecture.

### Version 2: Web Audio Mixer Engine

Version 2 should replace the current HTML audio element based multitrack playback with a Web Audio engine.

This version should support tighter synchronization, gapless looping, waveform analysis, shared playhead behavior, channel offset/nudge controls, and non-destructive trim/clipping.

### Version 3: Record a Take

Version 3 should add browser microphone recording.

A collaborator should be able to listen to the uploaded tracks, record a rough part through the browser, save that recording, and make it available in the project.

### Version 4: Collaboration and Production Services

Version 4 should move GrooveShare closer to a complete remote music collaboration workflow.

This may include authentication, private share links, collaborator permissions, comments, notifications, version history, persistent database storage, cloud audio storage, and production deployment.

## High-Level Structure

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

The `backlog.md` file tracks current focus, planned work, and completed work.

## Frontend Architecture

The frontend is a Vite + Vanilla TypeScript app.

Vite is used as the frontend development server, TypeScript build tool, and production bundler. The app uses browser DOM APIs rather than a frontend framework.

The frontend is responsible for:

* Rendering the GrooveShare interface.
* Calling backend API routes with `fetch`.
* Displaying project data returned from the backend.
* Displaying loading, error, and status messages.
* Managing the project creation flow.
* Managing track upload UI.
* Displaying uploaded track metadata.
* Deleting individual tracks and projects through backend API calls.
* Showing confirmation, success, and error messages for destructive actions.
* Rendering the Project Player Tracks panel as four channel slots.
* Reading channel enabled state and volume settings before loading a mix.
* Managing browser audio playback through the Audio Player panel.
* Eventually managing browser microphone recording through browser APIs.

Current frontend structure:

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

Frontend module responsibilities:

* `api/` contains functions that communicate with the backend.
* `dev/` contains local-only development helpers, such as the development toolbar.
* `page-controllers/` contains page-specific behavior that can be tested with fake DOM helpers.
* `pages/` contains page-level markup for the main app screens.
* `project-draft/` contains temporary state for the multi-step project creation flow.
* `router/` controls which app screen is currently shown.
* `templates/` contains smaller reusable markup helpers.
* `types.ts` contains shared frontend types.

Markup may be created from TypeScript template strings. Page-level markup should live in `pages/`, repeated markup should live in `templates/`, and page behavior should live in `page-controllers/` rather than being placed directly in `main.ts`.

## Backend Architecture

The backend is a pure Node TypeScript server.

The backend is responsible for:

* Handling API requests from the frontend.
* Reading and writing local JSON metadata.
* Creating and serving project data.
* Receiving local audio uploads.
* Saving uploaded files to project-specific local folders.
* Creating track metadata records for uploaded files.
* Serving uploaded audio files from local storage.
* Deleting individual tracks and their uploaded files.
* Deleting projects, linked track metadata, uploaded files, and project upload folders.
* Returning clear JSON responses and error messages.
* Handling CORS for the local Vite frontend.
* Supporting local development reset behavior.
* Supporting local development seed-project behavior from real audio files.

Current backend structure:

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

* `server/src/server.ts` starts the development server.
* `server/src/app.ts` creates the testable app server and route behavior.

The backend data access layer lives in `server/src/stores/`.

Upload-related helpers live in `server/src/uploads/`.

Development-only backend behavior, such as resetting local development data and seeding projects from local audio files, lives in `server/src/dev/`.

The current project and track stores use JSON storage, but they are shaped so future database-backed stores can use the same general function interfaces.

## Backend Framework Direction

Version 1 uses Node's built-in HTTP, file system, and stream tools.

This keeps the local backend implementation direct and keeps the project dependency surface small while the core product flow is being established.

In a later version, the backend may move to Express or another framework to simplify routing, middleware, upload handling, validation, authentication, and production concerns.

## Frontend and Backend Communication

During local development, the frontend and backend run on separate local servers:

```txt
Frontend: http://localhost:5173
Backend:  http://localhost:3000
```

The frontend calls the backend using `fetch`.

Because the frontend and backend use different local origins, the backend allows the frontend origin through CORS headers.

For local development, the allowed frontend origin is:

```txt
http://localhost:5173
```

The backend should handle preflight `OPTIONS` requests for routes that receive JSON or uploads from the frontend.

## Data Storage Direction

In Version 1, GrooveShare uses local JSON metadata instead of a database.

The current local metadata file is:

```txt
server/data/db.json
```

Local development seed audio files may live in:

```txt
server/data/seed-project/
```

Those seed files are used only for local development and manual testing.

The initial metadata shape is:

```json
{
  "projects": [],
  "tracks": []
}
```

This structure maps to future database tables:

```txt
projects → future projects table
tracks   → future tracks table
```

The JSON file stores metadata only. Audio files are stored separately in local folders.

## Future Data Storage Direction

In a later version, JSON metadata should be replaced by a real database.

Likely future options include:

* PostgreSQL
* Supabase PostgreSQL
* Another managed database service

In a later version, local audio file storage should be replaced by cloud object storage.

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
getTrackById(projectId, trackId)
createTrack(trackInput)
deleteTrackById(projectId, trackId)
```

The route layer should call these functions without needing to know whether data comes from a JSON file or a future database.

For testing, the JSON store can be created with a disposable test database path. This allows tests to verify real JSON file read/write behavior without modifying the development database at `server/data/db.json`.

Future store direction:

```txt
projects-json-store.ts      → Version 1 local JSON implementation
projects-postgres-store.ts  → possible future database implementation
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

Tracks are stored separately from projects in the JSON metadata file, using `projectId` to connect a track to a project.

This keeps the Version 1 JSON structure close to a future relational database shape.

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

The uploaded audio route is an exception to the normal JSON response pattern. `GET /api/projects/:projectId/tracks/:trackId/audio` returns the audio file bytes with the track's stored MIME type so the browser can load it.

The `/api/dev/*` routes are local development helper routes. They should remain isolated from the normal product API and should not become part of the production app surface.

Likely future routes may include waveform peak data or saved mix/edit settings after the app reaches waveform display, nudge, trim, and clipping features.

## File Upload Direction

Version 1 supports local audio uploads using pure Node.

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

The upload implementation should stay modular so local file-writing behavior can later be replaced with cloud object storage.

## Deletion and Cleanup Direction

Deleting an individual track should remove the track metadata and the linked uploaded audio file. If that was the last uploaded file in the project folder, the backend should remove the now-empty project upload folder. If other tracks still exist in the same project, the project upload folder should remain.

Deleting an entire project should remove the project metadata, all linked track metadata, all linked uploaded audio files, and the project upload folder. Project deletion should not remove metadata or files that belong to other projects.

## Audio Direction

GrooveShare needs browser-based audio playback for the Version 1 stem player workflow.

Current audio playback behavior:

* Serves uploaded audio files from the backend.
* Loads enabled channel slots into a shared mix.
* Plays up to four enabled tracks together from a shared start point.
* Applies the channel volume values that were present when the mix was loaded.
* Provides global play, pause, stop, loop, progress, and timestamp controls.

The current Version 1 implementation uses HTML audio elements. This is acceptable for a local stem-player MVP, but it is not the final architecture for tighter playback, waveform editing, or gapless looping.

As the app grows, multitrack playback should move to a Web Audio based engine using `AudioContext`, decoded `AudioBuffer` data, `AudioBufferSourceNode`, `GainNode`, and eventually pan nodes or additional routing nodes.

The app should aim for practical rehearsal usefulness rather than professional DAW-level editing.

## Project Player Mixer Direction

The Project Player is organized around two separate responsibilities:

```txt
Tracks panel       = channel setup and per-track mix/edit controls
Audio Player panel = global playback transport
```

The Tracks panel contains four channel slots. Each channel slot represents one possible audio lane in the current project mix.

A channel slot may be empty or assigned to one uploaded track.

Each assigned channel slot owns the controls and display elements that belong to an individual track:

* Assigned track name
* Enabled/on-off state
* Volume control
* Waveform placeholder
* Delete action
* Future waveform display
* Future offset/nudge controls
* Future trim/clipping controls

The Audio Player panel owns the global controls that affect the currently loaded mix:

* Load Mix
* Play
* Pause
* Stop
* Loop
* Shared progress control
* Shared timestamp display

This separation keeps the Project Player close to a small stem mixer. The user configures the mix in the Tracks panel, then uses the Audio Player panel to control playback of the prepared mix.

Channel 1 through Channel 4 automatically fill from the first four uploaded tracks for now. Extra uploaded tracks may exist in the project metadata, but they are not assigned to visible channel slots until manual assignment behavior is added later.

The `Load Mix` action reads the current channel setup from the Tracks panel. It gathers enabled channels, track names, audio URLs, channel numbers, and volume values, then prepares those channels for global playback in the Audio Player panel.

The Audio Player should play the enabled tracks together from a shared start point while respecting the volume setting captured when the mix was loaded.

Waveforms should live inside the channel slots rather than inside the global Audio Player panel. Waveform editing is track-specific, and future nudge, trim, and clipping behavior will need to line up visually with each individual track's waveform.

The global Audio Player may still show a shared progress bar and timestamp, but detailed waveform editing should happen inside the Tracks panel.

## Version 1 Transport Expectations

Version 1 transport behavior should be clear and intentionally limited.

Supported in Version 1:

* `Load Mix` captures the current channel setup.
* Enabled channels are included in the loaded mix.
* Disabled channels are excluded from the loaded mix.
* Channel volume values are applied when the mix is loaded.
* `Play` starts the loaded channels from a shared start point.
* `Pause` pauses the loaded mix.
* `Stop` pauses all loaded channels and resets playback to the beginning.
* The progress control and timestamp represent the shared mix position.
* The Loop checkbox restarts the loaded mix when playback reaches the end.

Known Version 1 transport limitations:

* Channel enabled and volume changes after `Load Mix` may require clicking `Load Mix` again before playback reflects the change.
* The current loop behavior may have a slight delay before restarting because it uses HTML audio elements and reacts to the browser's audio `ended` event.
* Progress and seeking are prototype-level for multitrack playback.
* The current transport does not provide DAW-level sample-accurate sync.
* Gapless looping is deferred to the Web Audio engine.

## Version 2 Web Audio Engine Plan

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
    Make playback respect each channel’s enabled state, volume, offset, clip start, and clip end values.

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

GrooveShare uses custom lightweight TypeScript test runners.

There are separate test setups for the backend and frontend:

```txt
server/tests/
client/tests/
```

The backend tests cover:

* The custom test runner.
* JSON store behavior.
* API route behavior.
* Disposable JSON test databases.
* Upload parsing and validation.
* Uploaded file serving behavior.
* Track and project deletion cleanup behavior.
* Development seed/reset behavior.

The frontend tests cover:

* The custom test runner.
* Page controller behavior.
* Template rendering behavior.
* Frontend API helper behavior.
* Fake DOM helpers.
* Form behavior.
* Error/status messaging.
* Delete confirmation and status behavior.
* Audio player controller behavior.
* Mix channel slot template behavior.
* Load Mix channel gathering behavior.

Frontend tests should avoid requiring a full browser environment at this stage. Instead, they should use small fake DOM helpers and dependency injection.

As the app grows, frontend code should stay organized into testable modules rather than placing all behavior directly in `main.ts`.

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

Feature work should use a `feature/` branch.

## Current Completed Foundation

The project currently has:

* Vite + Vanilla TypeScript frontend.
* Pure Node TypeScript backend.
* Backend health endpoint.
* Frontend/backend connection.
* Root `.gitignore`.
* Local `db.json` metadata store.
* Project metadata types.
* Tested JSON project store.
* Tested project API routes.
* Tested frontend page controllers.
* Project creation UI wired to the API.
* Readable frontend error handling for project loading and creation failures.
* Custom backend test runner.
* Custom client test runner.
* Track metadata types.
* Tested JSON track store.
* Tested upload path helpers.
* Tested multipart form data parser.
* Tested upload validation.
* Tested track upload API route.
* Tested project track list API route.
* Tested uploaded audio file route.
* Tested track deletion API route.
* Tested project deletion API route.
* Frontend track upload form wired to the API.
* Frontend uploaded track metadata display.
* Frontend upload error handling.
* Frontend track deletion UI.
* Frontend project deletion UI from the Project Menu and Project Player.
* Uploaded audio file cleanup when tracks or projects are deleted.
* Empty project upload folder cleanup when the last track is deleted.
* Single Audio Player panel with play, pause, stop, loop, progress, and timestamp controls.
* Uploaded audio loading and playback path.
* Four-channel mixer slot layout in the Project Player Tracks panel.
* Load Mix behavior that gathers enabled channels and volume values.
* Four-track mix playback from a shared start point.
* Local development reset route and development toolbar.
* Local seed-project audio file workflow for creating real test projects.
* Cleaned frontend structure with legacy controller code removed.
* Cleaned backend structure with unused utility code removed.

## Current Limitations

Current limitations:

* Channel assignment is automatic for now; manual assignment is not implemented yet.
* Extra uploaded tracks beyond the first four are not assigned to visible channel slots yet.
* Changing channel enabled state or volume after clicking `Load Mix` may require loading the mix again before playback reflects the change.
* Looping may have a small delay before restart because the current implementation uses HTML audio elements.
* Shared progress and seek behavior are prototype-level for multitrack playback.
* Waveforms are placeholders only.
* No pan control yet.
* No solo control yet.
* No offset/nudge controls yet.
* No trim/clipping controls yet.
* No share links yet.
* No recording yet.
* No authentication yet.
* No database yet.
* No cloud storage yet.
* No production deployment yet.

These limitations define the boundary between Version 1 and later versions.
