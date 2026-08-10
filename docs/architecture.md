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

The current codebase is the local Version 1 four-channel stem-player implementation.

Current Version 1 stack:

* Vite + Vanilla TypeScript frontend
* Pure Node TypeScript backend
* Local JSON metadata storage
* Local file storage
* Organized CSS import structure
* Custom lightweight TypeScript tests
* Local development seed/reset tooling

Version 1 remains intentionally small and focused: create projects, upload up to four audio tracks, edit project/track labels, save a simple mix, and control multitrack playback in the browser.

## Version Plan

### Version 1: Four-Channel Stem Player

Version 1 is the first useful MVP.

The user should be able to:

* Create a project.
* Add up to four audio files during project creation.
* Review project details and selected tracks in a confirmation modal.
* Submit the project and move directly to the Project Player.
* Add another track from an empty Project Player channel slot.
* Open a Project Player.
* See up to four channel slots.
* Automatically fill Channel 1 through Channel 4 from the first four uploaded tracks.
* Enable or disable each assigned channel from the numbered channel square.
* Adjust channel volume and see the value as a percentage.
* Load the selected channel setup into the Audio Player and persist the mix settings.
* Restore saved enabled/volume settings when a project is reopened.
* Edit project title, project description, and track names inline with persisted updates.
* Play, pause/resume, stop, seek, loop, and reset the loaded mix from a shared transport.
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
  sample-audio-files/
  client/
  server/
  docs/
  backlog.md
  docker-compose.yml
  README.md
```

The `sample-audio-files/` folder contains the four user-facing sample stems used by the README Quick Start.

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
* Managing pending track selection before project submission.
* Uploading selected tracks after project creation.
* Displaying uploaded track metadata.
* Persisting inline edits to project title, project description, and track names.
* Persisting the current occupied-channel enabled/volume settings when a mix is loaded.
* Restoring saved mixer settings when a project is reopened.
* Deleting individual tracks and projects through backend API calls.
* Showing confirmation, success, and error messages for destructive actions.
* Rendering the Project Player Tracks panel as four channel slots.
* Reading channel enabled state and volume settings before loading a mix.
* Tracking whether the visible mixer still matches the currently loaded mix.
* Updating volume percentages while the user moves a channel slider.
* Managing browser audio playback and shared seeking through the Audio Player panel.
* Eventually managing browser microphone recording through browser APIs.

Current frontend structure:

```txt
client/src/
  api/
  css/
    main.css
    _imports/
      base.css
      layout.css
      utilities.css
      components/
      pages/
      responsive.css
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

Frontend module responsibilities:

* `api/` contains functions that communicate with the backend.
* `css/` contains the CSS entry point and organized stylesheet imports.
* `dev/` contains local-only development helpers, such as the development toolbar.
* `page-controllers/` contains page-specific behavior that can be tested with fake DOM helpers.
* `pages/` contains page-level markup for the main app screens.
* `project-draft/` contains temporary state for project details and selected audio files before submission.
* `router/` controls which app screen is currently shown.
* `templates/` contains smaller reusable markup helpers.
* `types.ts` contains shared frontend types.

Markup may be created from TypeScript template strings. Page-level markup should live in `pages/`, repeated markup should live in `templates/`, and page behavior should live in `page-controllers/` rather than being placed directly in `main.ts`.

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

The backend is a pure Node TypeScript server.

The backend is responsible for:

* Handling API requests from the frontend.
* Reading and writing local JSON metadata.
* Creating, reading, and updating project data.
* Persisting project title/description edits and mix settings.
* Receiving local audio uploads.
* Saving uploaded files to project-specific local folders.
* Creating and updating track metadata records, including persisted track-name edits.
* Streaming uploaded audio files from local storage with HTTP byte-range support for seeking.
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

The repository contains two intentionally separate sample/seed locations:

```txt
sample-audio-files/        # user-facing files for the normal Create Project Quick Start
server/data/seed-project/  # development-toolbar seed source
```

The root sample files exercise the real browser file-picker/upload workflow. The backend seed files are used only by the development toolbar to create test projects quickly.

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
updateProjectDetails(projectId, projectInput)
updateProjectMixSettings(projectId, mixSettings)
deleteProjectById(projectId)
```

Current track store functions include:

```txt
getTracksByProjectId(projectId)
getTrackById(projectId, trackId)
createTrack(trackInput)
updateTrackName(projectId, trackId, trackInput)
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

Current mix-setting shapes:

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
```

Current project shape:

```ts
type Project = {
  id: string;
  title: string;
  description: string;
  mixSettings?: MixSettings;
  createdAt: string;
  updatedAt: string;
};
```

New projects are created with an empty `mixSettings.channels` array. `mixSettings` remains optional in the TypeScript type so older local JSON records can still be read safely.

A project is created from:

```ts
type CreateProjectInput = {
  title: string;
  description: string;
};
```

Project title and description can later be updated independently:

```ts
type UpdateProjectDetailsInput = {
  title?: string;
  description?: string;
};
```

Pressing `Load Mix` persists the occupied channel settings on the project. Disabled occupied channels are saved too, so their enabled state and volume can be restored later.


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

Track names can be updated after upload:

```ts
type UpdateTrackNameInput = {
  name: string;
};
```

This keeps the Version 1 JSON structure close to a future relational database shape.

## API Direction

The API should stay small and grow only as needed.

Current routes:

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

The uploaded audio route is an exception to the normal JSON response pattern. `GET /api/projects/:projectId/tracks/:trackId/audio` streams the audio file with the track's stored MIME type. It advertises `Accept-Ranges: bytes` and returns `206 Partial Content` with `Content-Range` for valid browser `Range` requests, which allows the shared progress slider to seek without restarting from the beginning of the file.

The `/api/dev/*` routes are development helpers. The backend returns `404` for them when `NODE_ENV=production`.

Likely future routes may include waveform peak data, collaboration data, comments, or recording metadata.

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

GrooveShare includes development tooling to make repeated local manual testing faster.

The frontend toolbar lives in:

```txt
client/src/dev/dev-toolbar.ts
```

It is currently mounted from `client/src/main.ts` as:

```ts
mountDevToolbar({ visibleByDefault: false, enabledByDefault: true });
```

This means the toolbar is hidden on initial page load while its keyboard shortcut remains enabled. Pressing the `0` (zero) key toggles the toolbar.

The toolbar can:

* List supported seed audio files from `server/data/seed-project/`.
* Create a temporary `Dev Seed Project` from the selected seed files.
* Copy those seed files into the same runtime upload area used by normal projects.
* Reset local development metadata and uploaded files after confirmation.

Development backend routes live in `server/src/dev/`:

```txt
GET    /api/dev/seed-files
POST   /api/dev/seed-project
DELETE /api/dev/reset
```

The backend dev routes return `404` when `NODE_ENV=production`.

The root `sample-audio-files/` directory and `server/data/seed-project/` serve different purposes: the root samples document and exercise the normal user-facing upload flow, while the seed directory powers the faster dev-toolbar workflow.

Development tooling should stay isolated from normal product behavior and should not become a dependency of the user-facing project flow.


## Testing Direction

The project uses custom lightweight TypeScript test runners for both client and server tests.

Test coverage should focus on behavior and module boundaries:

* API helper functions should test request shape and response handling.
* Page controllers should be tested with fake DOM helpers.
* Templates should be tested for meaningful rendered markup.
* Router behavior should be tested independently from page logic.
* Backend routes should be tested with disposable local database files and upload folders.
* Store tests should verify metadata behavior without depending on the development database.

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
