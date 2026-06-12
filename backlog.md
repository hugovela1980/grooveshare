# GrooveShare Project Backlog

## Current Version

- Current stable release: ``
- Stable branch: `main`
- Development branch: `develop`

## Current Focus

- [ ] Add local audio file upload
  Allow a user to upload an audio file to a local project folder and save the track information in JSON metadata.

  - [ ] Define initial track metadata shape
    Decide the first track object structure, including ID, project ID, track name, original filename, local file path, MIME type, file size, and created date.

  - [ ] Add tested track store helpers
    Add JSON store functions for creating a track record and reading tracks by project ID, using the existing local `db.json` structure.

  - [ ] Create local uploads folder structure
    Store uploaded files under a project-specific folder such as `server/uploads/projects/:projectId/`.

  - [ ] Add multipart upload handling
    Add backend support for receiving an uploaded audio file through a pure Node request without Express or Multer.

  - [ ] Add track upload API route
    Add a `POST /api/projects/:projectId/tracks` route that accepts an audio file, saves it locally, creates track metadata, and returns the saved track.

  - [ ] Add track list API route
    Add a `GET /api/projects/:projectId/tracks` route that returns track metadata for a specific project.

  - [ ] Add basic upload validation
    Reject uploads when the project does not exist, no file is provided, the file type is unsupported, or the file is too large.

  - [ ] Add tested upload API behavior
    Add backend tests for successful upload, missing project, missing file, unsupported file type, and saved metadata.

  - [ ] Add frontend upload form
    Add a project track upload form that lets the user choose an audio file and submit it for the current project.

  - [ ] Add frontend track display
    Show uploaded track metadata in the project UI after upload, including track name, original filename, and file type.

  - [ ] Add frontend upload error handling
    Display readable frontend messages when an upload fails because of missing file, invalid file type, missing project, or backend failure.

  - [ ] Manually test local upload flow
    Confirm that an audio file can be uploaded, saved to the local uploads folder, written to `db.json`, and displayed in the frontend.

  - [ ] Update backlog and architecture notes
    Mark completed upload work and update architecture notes if the implemented upload folder, track shape, or route names differ from the plan.

## Next Up

- [ ] Save track metadata
  Store each uploaded track’s ID, name, original filename, local file path, MIME type, upload date, and related project ID.

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

