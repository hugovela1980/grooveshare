# GrooveShare Project Backlog

## Current Version

- Current stable release: ``
- Stable branch: `main`
- Development branch: `develop`

## Current Focus

- [ ] Build local project metadata foundation
  Create the first Phase 1 data model for GrooveShare projects using a local JSON metadata file and pure Node API routes for creating and reading projects.
  - [x] Convert backend to TypeScript
    Move the pure Node backend from `server.js` to `src/server.ts` and add a simple TypeScript dev setup before building the project metadata store.
  - [x] Create local JSON data store
    Add a `server/data/db.json` file that acts as a temporary Phase 1 database with top-level `projects` and `tracks` collections.
  - [x] Define initial project metadata shape
    Decide the first project object structure, including ID, title, description, created date, updated date, and an empty tracks list.
  - [x] Create local data folder and metadata file
    Add a `server/data/projects.json` file that will act as the temporary Phase 1 metadata store.
  - [x] Add metadata read/write helpers
    Create small server-side helper functions for reading project metadata from JSON and writing updated metadata back to the file.
  - [x] Add project creation route
    Add a pure Node `POST /api/projects` route that accepts project data, creates a new project object, saves it to JSON, and returns the created project.
  - [x] Add projects list route
    Add a pure Node `GET /api/projects` route that reads the JSON metadata file and returns the current list of projects.
  - [x] Add single project route
    Add a pure Node `GET /api/projects/:projectId` route that returns one project by ID or a clear error if the project does not exist.
  - [x] Add frontend project creation form
    Add a simple form in the Vite frontend for entering a project title and description and submitting it to the backend.
  - [x] Add frontend project display
    Show created projects in the browser using data returned from the backend.
  - [x] Add basic API error handling
    Display readable frontend messages when project creation or project loading fails.
  - [x] Manually test project metadata flow
    Confirm that projects can be created, saved to `projects.json`, loaded from the backend, and displayed in the frontend after a refresh.
  - [ ] Update backlog and architecture notes
    Mark completed project metadata work and update architecture notes if the implemented data shape or route names differ from the plan.

## Next Up

- [ ] Define the project metadata shape
  Decide the initial JSON structure for a GrooveShare project, including project ID, title, description, created date, and an empty tracks list.

- [ ] Add project API routes
  Add pure Node backend routes for creating a project and reading existing project metadata from the local JSON file.

- [ ] Add basic project UI
  Add a simple frontend form for creating a project and a basic project list or project view that displays data returned from the backend.

## Backlog

- [ ] Add local audio file upload
  Allow a user to upload an audio file to a local project folder and save the track information in JSON metadata.

- [ ] Save track metadata
  Store each uploaded track’s ID, name, original filename, local file path, MIME type, upload date, and related project ID.

- [ ] Serve uploaded audio files
  Add a backend route that allows the frontend audio player to request and play uploaded audio files from local storage.

- [ ] Build single-track playback
  Add the first basic audio player behavior so one uploaded track can be loaded and played in the browser.

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

- [x] Add backend test runner
