# GrooveShare Project Backlog

## Current Version

- Current stable release: ``
- Stable branch: `main`
- Development branch: `develop`

## Current Focus

- [x] Serve uploaded audio files
  Add a backend route that returns the audio file for a track.

- [x] Add single audio player template
  Add a simple player area with play, pause/stop, progress, and timestamp.

- [x] Add single audio player controller
Reuse the media-control ideas from your old video player: play/pause, stop, progress update, seek, and time formatting.

- [x] Add track load/play behavior
  Add a button to each track in the Project Player that loads that track into the audio player.

- [x] Manually test one-track playback
  Upload a track, open the Project Player, load the track, play it, pause it, stop it, and seek through it.

## Backlog

- [ ] Build multitrack playback
  Allow multiple uploaded tracks in the same project to play together from a shared start point.

- [ ] Add track controls
  Add per-track controls for mute, solo, volume, and pan so a collaborator can shape their own practice mix.

- [ ] Add project detail page
  Create a focused project view where the user can see project notes, uploaded tracks, and playback controls in one place.

- [ ] Add share-link style route
  Create a simple shareable project URL that opens a collaborator-friendly view without requiring authentication.

- [ ] Add collaborator playback view
  Build a simplified view for bandmates that focuses only on reading the project notes and playing, muting, soloing, adjusting volume, and panning tracks.

- [ ] Add basic project notes
  Let the project owner add short instructions for collaborators, such as what part to practice or what kind of drum part to try.

- [ ] Add basic file validation
  Check uploaded files for supported audio types and reject files that are too large or not usable by the app.

- [ ] Add simple error and loading states
  Display clear messages when projects, uploads, audio files, or backend requests fail.

- [ ] Add basic responsive layout
  Make the Version 1 project and playback views usable on both desktop and phone screens.

- [ ] Add Version 1 README notes
  Document the local Phase 1 setup, current features, known limitations, and how to run the client and server locally.

## General Plan

### Phases

- [ ] Phase 1 Architecture
    Keep the first implementation focused on Vite + Vanilla TypeScript, pure Node backend, local file storage, and JSON file metadata before adding external services.

- [ ] Move to Phase 2 architecture
  Replace early local development pieces with a more realistic backend setup, including Express, PostgreSQL or Supabase metadata storage, and cloud/object storage for uploaded audio files.

- [ ] Move to Phase 3 collaboration features
  Add authentication, share links, email notifications, and stronger project permissions after the core local prototype is working.

### Versions

- [ ] Build Version 1: Stem player
  Create the first useful MVP where a user can create a project, upload multiple audio files, and share a link where someone can play, mute, solo, adjust volume, and pan tracks.

- [ ] Build Version 2: Record a take
  Add browser microphone recording so a collaborator can listen to the shared tracks, record a rough part, save it, and make it available to the project owner.

- [ ] Build Version 3: Sync tools
  Add practical tools for making rough phone recordings usable, such as count-in behavior, manual offset/nudge controls, waveform preview, and trimming.

- [ ] Build Version 4: Collaboration polish
  Add features that make the app feel like a real band workflow, such as email notifications, comments, version history, private links, collaborator names, and project status.

## Completed

* [x] Define initial project idea
  Established GrooveShare as a lightweight music collaboration app for sharing stems, practicing parts, and capturing rough remote takes from bandmates.

* [x] Choose initial Phase 1 stack
  Chose Vite + Vanilla TypeScript frontend, pure Node backend, local file storage, and JSON file metadata as the starting learning stack.

* [x] Set up branch workflow
  Established a main, develop, and feature branch workflow for the GrooveShare project.

* [x] Set up project skeleton
  Create the initial Vite + Vanilla TypeScript frontend and pure Node backend, including a basic health endpoint and frontend/backend connection test.

* [x] Add backend test runner
  Added a custom TypeScript test runner for the backend, based on the lightweight testing pattern from the split-timer project, including support for grouped tests, assertions, setup callbacks, and mock functions.

* [x] Build local project metadata foundation
  Created the first full project metadata flow using a local JSON data store, TypeScript backend types, tested store helpers, tested API routes, and a frontend project creation UI that can create, save, load, and display projects.

- [x] Save track metadata
  Store each uploaded track’s ID, name, original filename, local file path, MIME type, upload date, and related project ID.

* [x] Add local audio file upload
  Added the first full local audio upload workflow, including track metadata types, separated JSON store helpers, tested track store functions, pure Node multipart upload handling, local project-specific upload folders, upload validation, tested upload/list API routes, a frontend upload form, uploaded track metadata display, and readable upload error handling.

* [x] Refactor the frontend
  Refactor so that `main.ts` starts the app only and `app.ts` does routing coordination, app state, and page initialization.  Create and add directories and files to handle screen changes (`router/`), render page HTML templates (`pages/`), and handle page-specific behavior (`page-controllers/`)

- [x] Restyled the main app pages
  Updated the UI for the main project workflow so the app now feels more like a guided multi-page experience instead of a collection of rough development screens.

  - [x] Added reusable track deletion
  Added backend and frontend support for deleting individual tracks, including removing track metadata from `db.json`, deleting the linked uploaded audio file from `server/uploads/`, exposing a reusable `deleteTrack(projectId, trackId)` API helper, and wiring the first delete UI into the Project Player so tracks can be removed and the track list refreshes after deletion.

  - [x] Added project deletion with linked track cleanup
  Added backend and frontend support for deleting entire projects, including removing project metadata from `db.json`, removing linked track metadata, deleting uploaded audio files and project upload folders from `server/uploads/`, exposing a reusable `deleteProject(projectId)` API helper, and wiring delete buttons into the Project Menu and Project Player flows with confirmation prompts and status messages.