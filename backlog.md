# GrooveShare Project Backlog

## Current Version

- Current stable release: ``
- Stable branch: `main`
- Development branch: `develop`

## Current Focus

- [x] Reconnect Create Project form only
  Reconnect only the project creation form on the Create Project page and confirm it writes to `server/data/db.json`.

- [x] Navigate to Confirm Project after creation
  After a project is created, store the created project in app state and show the Confirm Project page.

- [x] Return to Project Menu after confirmation
  Clicking Submit on Confirm Project should return to Project Menu and show the new project at the top.

- [x] Open selected project in Project Player
  Let a user click a project from the Project Menu, store that project in app state, and render the Project Player page for that project.

- [x] Reconnect track upload in Project Player
  Let the selected project upload a track from the Project Player page and reload that project’s track list.

## Next Up

- [ ] Serve uploaded audio files
  Add a backend route that allows the frontend audio player to request and play uploaded audio files from local storage.

- [ ] Build single-track playback
  Add the first basic audio player behavior so one uploaded track can be loaded and played in the browser.

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

- [ ] Save track metadata
  Store each uploaded track’s ID, name, original filename, local file path, MIME type, upload date, and related project ID.

* [x] Add local audio file upload
  Added the first full local audio upload workflow, including track metadata types, separated JSON store helpers, tested track store functions, pure Node multipart upload handling, local project-specific upload folders, upload validation, tested upload/list API routes, a frontend upload form, uploaded track metadata display, and readable upload error handling.