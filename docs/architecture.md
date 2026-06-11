# GrooveShare Architecture Notes

## Purpose

GrooveShare is a lightweight browser-based music collaboration tool for sharing audio stems, practicing parts, and capturing rough remote takes from bandmates.

The app is not intended to be a full DAW. The goal is to provide a simple workflow where one musician can upload rough tracks, share a link with a collaborator, and allow that collaborator to listen, practice, and eventually record a rough synced take from the browser.

## Product Direction

GrooveShare is built around a practical band workflow:

A user creates a project for a song idea, riff, section, or practice track. The user uploads individual audio files such as guitar, scratch drums, bass, vocals, or click tracks. A collaborator opens a shared project link, listens to the tracks together, adjusts the mix for practice, and eventually records a rough part back into the project.

The app should stay focused on simple collaboration and practice rather than becoming a full music production environment.

## Current Phase

The current project phase is Phase 1.

Phase 1 is focused on learning the core browser, Node, file, and data-modeling concepts before adding larger services or frameworks.

Current Phase 1 stack:

* Vite + Vanilla TypeScript frontend
* Pure Node backend
* Local file storage
* JSON file metadata
* No React
* No Express
* No database
* No cloud storage
* No authentication yet

## Version Plan

### Version 1: Stem Player

Version 1 should create the first useful MVP.

The user should be able to create a project, upload multiple audio files, and open a project view where those tracks can be played together. The player should eventually support basic track controls such as mute, solo, volume, and pan.

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

The `docs/` folder contains project documentation such as architecture notes, data model notes, and API notes.

The `backlog.md` file tracks current focus, next steps, planned work, and completed work.

## Frontend Architecture

The frontend is a Vite + Vanilla TypeScript app.

Vite is used as the frontend development server, TypeScript build tool, and production bundler. It does not provide the UI structure itself. The app uses normal browser APIs rather than React or another frontend framework.

The frontend is responsible for:

* Rendering the GrooveShare interface
* Calling backend API routes with `fetch`
* Displaying project data returned from the backend
* Managing browser audio playback
* Managing user controls such as play, mute, solo, volume, and pan
* Eventually managing microphone recording through browser APIs

The current frontend entry point is:

```txt
client/src/main.ts
```

The current CSS entry point is:

```txt
client/src/style.css
```

For now, markup may be created from TypeScript template strings. To keep the app organized as it grows, larger markup sections should eventually move into focused template or UI modules.

Possible future frontend organization:

```txt
client/src/
  main.ts
  style.css
  api/
  audio/
  templates/
  ui/
  types/
```

## Backend Architecture

The backend is a pure Node server using Node’s built-in HTTP tools.

The backend is responsible for:

* Handling API requests from the frontend
* Reading and writing local JSON metadata
* Creating and serving project data
* Eventually receiving audio uploads
* Eventually serving uploaded audio files from local storage
* Returning clear JSON responses and error messages

The current backend entry point is:

```txt
server/server.js
```

The current backend includes a basic health endpoint:

```txt
GET /api/health
```

This endpoint exists to confirm that the server is running and that the frontend can successfully call the backend.

## Frontend and Backend Communication

During local development, the frontend and backend run on separate local servers:

```txt
Frontend: http://localhost:5173
Backend:  http://localhost:3000
```

The frontend calls the backend using `fetch`.

Example:

```txt
GET http://localhost:3000/api/health
```

Because the frontend and backend use different local origins, the backend must allow the frontend origin through CORS headers.

For Phase 1, the allowed frontend origin is:

```txt
http://localhost:5173
```

## Data Storage Direction

In Phase 1, GrooveShare will use local JSON metadata instead of a database.

The JSON metadata file will store project and track information, such as:

* Project ID
* Project title
* Project description
* Created date
* Track list
* Track metadata
* Local file paths for uploaded audio

The JSON file should not store the actual audio file contents.

Audio files should be stored separately in local folders.

A likely Phase 1 storage structure is:

```txt
server/
  data/
    projects.json
  uploads/
    project-id/
      track-id-audio-file.wav
```

This local storage approach is temporary and intended for learning and prototyping.

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

## Initial Data Model Direction

The first core data object is a project.

A project represents one song idea, riff, section, or practice session.

Initial project shape:

```json
{
  "id": "project_123",
  "title": "Chorus Riff Idea",
  "description": "Guitar riff with scratch drums",
  "createdAt": "2026-06-10T00:00:00.000Z",
  "tracks": []
}
```

A track represents one uploaded audio file connected to a project.

Initial track shape:

```json
{
  "id": "track_123",
  "projectId": "project_123",
  "name": "Guitar",
  "originalFilename": "guitar-riff.wav",
  "filePath": "uploads/project_123/track_123.wav",
  "mimeType": "audio/wav",
  "createdAt": "2026-06-10T00:00:00.000Z"
}
```

These shapes may change as the app develops.

## API Direction

The API should start small and grow only as needed.

Current route:

```txt
GET /api/health
```

Likely next routes:

```txt
POST /api/projects
GET /api/projects
GET /api/projects/:projectId
POST /api/projects/:projectId/tracks
GET /api/projects/:projectId/tracks/:trackId/audio
```

Routes should return JSON responses.

API responses should be predictable and readable.

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

## Audio Direction

GrooveShare will eventually need browser-based multitrack audio playback.

The likely direction is to use browser audio APIs rather than a full DAW framework.

Early audio goals:

* Load one uploaded audio file
* Play and pause one track
* Load multiple uploaded audio files
* Start multiple tracks together
* Add volume controls
* Add mute and solo behavior
* Add pan controls

As the app grows, the Web Audio API may become important for better synchronized playback and per-track gain/pan routing.

The app should aim for practical rehearsal usefulness, not professional DAW-level editing.

## Recording Direction

Recording is planned for Version 2, not Version 1.

The likely browser API direction is:

* `navigator.mediaDevices.getUserMedia`
* `MediaRecorder`

Recording should be treated as a rough collaboration tool. Phone microphone recordings will not be studio quality and may require headphones to avoid audio bleed.

Sync may not be perfect across all devices, so later versions should include manual offset or nudge controls.

## Development Workflow

The project uses a branch workflow:

```txt
main      = stable / release-ready code
develop   = active integration branch
feature/* = app features
docs/*    = documentation-only work
fix/*     = bug fixes
refactor/* = code cleanup without behavior changes
chore/*   = setup, config, or maintenance
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

## Current Limitations

The current app is only a project skeleton.

Current limitations:

* No project creation yet
* No JSON metadata yet
* No audio uploads yet
* No audio playback yet
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

Use the project to practice real development workflow, including branches, commits, pull requests, documentation, and readable code.
