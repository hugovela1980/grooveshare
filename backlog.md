# GrooveShare Project Backlog

## Current Version

- Current stable release: ``
- Stable branch: `main`
- Development branch: `develop`

## Current Focus

- [ ] Overhaul CSS

- [ ] Add Cancel button to confirm and create project screens

- [ ] Maybe make the confirm screen be the modal, and all project creation details on the project create screen.  That way there isn't a separate page for creating a project.

### Replace multitrack playback with Web Audio engine
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

## Backlog

- add file url to test details in test failure summary

- move all types to a separate file to clean up the controller files
     
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

## Known Issues

- [ ] Revisit audio progress slider seeking
  The single-track audio player can load, play, pause, stop, and display timestamps, but slider seeking may need to be redesigned when the app moves toward simultaneous multitrack playback and streaming/range support.

## Phases

- [ ] Phase 1 Architecture
    Keep the first implementation focused on Vite + Vanilla TypeScript, pure Node backend, local file storage, and JSON file metadata before adding external services.

- [ ] Move to Phase 2 architecture
  Replace early local development pieces with a more realistic backend setup, including Express, PostgreSQL or Supabase metadata storage, and cloud/object storage for uploaded audio files.

- [ ] Move to Phase 3 collaboration features
  Add authentication, share links, email notifications, and stronger project permissions after the core local prototype is working.

## Versions

- [ ] Build Version 1: Stem player
  Create the first useful MVP where a user can create a project, upload multiple audio files, and share a link where someone can play, mute, solo, adjust volume, and pan tracks.

- [ ] Build Version 2: Record a take
  Add browser microphone recording so a collaborator can listen to the shared tracks, record a rough part, save it, and make it available to the project owner.

- [ ] Build Version 3: Sync tools
  Add practical tools for making rough phone recordings usable, such as count-in behavior, manual offset/nudge controls, waveform preview, and trimming.

- [ ] Build Version 4: Collaboration polish
  Add features that make the app feel like a real band workflow, such as email notifications, comments, version history, private links, collaborator names, and project status.

## Completed

- [x] Define initial project idea
  Established GrooveShare as a lightweight music collaboration app for sharing stems, practicing parts, and capturing rough remote takes from bandmates.

- [x] Choose initial Phase 1 stack
  Chose Vite + Vanilla TypeScript frontend, pure Node backend, local file storage, and JSON file metadata as the starting learning stack.

- [x] Set up branch workflow
  Established a main, develop, and feature branch workflow for the GrooveShare project.

- [x] Set up project skeleton
  Create the initial Vite + Vanilla TypeScript frontend and pure Node backend, including a basic health endpoint and frontend/backend connection test.

- [x] Add backend test runner
  Added a custom TypeScript test runner for the backend, based on the lightweight testing pattern from the split-timer project, including support for grouped tests, assertions, setup callbacks, and mock functions.

- [x] Build local project metadata foundation
  Created the first full project metadata flow using a local JSON data store, TypeScript backend types, tested store helpers, tested API routes, and a frontend project creation UI that can create, save, load, and display projects.

- [x] Save track metadata
  Store each uploaded track’s ID, name, original filename, local file path, MIME type, upload date, and related project ID.

- [x] Add local audio file upload
  Added the first full local audio upload workflow, including track metadata types, separated JSON store helpers, tested track store functions, pure Node multipart upload handling, local project-specific upload folders, upload validation, tested upload/list API routes, a frontend upload form, uploaded track metadata display, and readable upload error handling.

- [x] Refactor the frontend
  Refactor so that `main.ts` starts the app only and `app.ts` does routing coordination, app state, and page initialization.  Create and add directories and files to handle screen changes (`router/`), render page HTML templates (`pages/`), and handle page-specific behavior (`page-controllers/`)

- [x] Restyled the main app pages
  Updated the UI for the main project workflow so the app now feels more like a guided multi-page experience instead of a collection of rough development screens.

- [x] Added reusable track deletion
Added backend and frontend support for deleting individual tracks, including removing track metadata from `db.json`, deleting the linked uploaded audio file from `server/uploads/`, exposing a reusable `deleteTrack(projectId, trackId)` API helper, and wiring the first delete UI into the Project Player so tracks can be removed and the track list refreshes after deletion.

- [x] Added project deletion with linked track cleanup
Added backend and frontend support for deleting entire projects, including removing project metadata from `db.json`, removing linked track metadata, deleting uploaded audio files and project upload folders from `server/uploads/`, exposing a reusable `deleteProject(projectId)` API helper, and wiring delete buttons into the Project Menu and Project Player flows with confirmation prompts and status messages.

- [x] Add single-track audio playback path
Added backend audio serving, a single audio player template, an audio player controller, track Load buttons, and Project Player wiring so one uploaded track can be loaded and played from the browser.

- [x] Design four-channel track mixer layout
Replace the simple track list mindset with four channel slots in the Project Player Tracks panel. Each slot should be designed to eventually support an assigned track, enabled toggle, volume control, waveform display, offset/nudge controls, and trim/clipping controls.

- [x] Add two-channel slot prototype
Render the first two uploaded tracks as Channel 1 and Channel 2. Each channel should show the assigned track name, enabled toggle, volume slider, and a placeholder waveform area.

- [x] Add Load Mix behavior for two channels
  Add a Load Mix button that prepares the enabled channel slots for playback instead of loading one individual track at a time.

- [x] Update dev toolbar for real seed audio files
List audio files from `server/data/seed-project`, allow selecting which files to include, seed a project using the selected real audio files, keep reset-dev-data behavior, and keep the dev toolbar isolated so it can be removed later with minimal code changes.

- [x] Add two-track playback controller
Play, pause, stop, and reset two enabled tracks from a shared start point. Each track should respect its channel volume setting.

- [x] Expand mixer slots to four channels

- [x] Final Version 1 cleanup pass
  Remove obviously stale code, update backlog checkboxes, run all tests/typechecks, and merge to main when stable.