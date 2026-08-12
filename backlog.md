# GrooveShare Project Backlog

## Current Version

- Current stable release: v1.0.0
- Stable branch: `main`
- Development branch: `develop`
- Next planned release: Version 2 — Multi-user hosted beta

## Current Focus

- [ ] Chunk 4 — Enforce authorization in the server API
  Protect project, track, upload, edit, and delete routes based on membership and role. Viewers can read/play, Contributors can upload and manage their own contributions, and Owners can manage the project and its members.

### Version 2 Milestone 1 — Accounts and Authorization Foundation

Move GrooveShare from the Version 1 single-user/local-data model toward a true multi-user application. Establish PostgreSQL-backed metadata, authenticated users, project membership roles, and server-enforced authorization before deploying the Version 2 beta.

- [ ] Chunk 5 — Complete authorization integration tests and development tooling
  Add end-to-end server tests for allowed and forbidden actions, update seed/dev data so each role can be tested easily, verify migration behavior, and run the full client/server test and typecheck suites.

## Backlog

### Version 2 Milestone 2 — Permission-Aware UI

Make the client reflect the permissions already enforced by the server. Show or hide upload, edit, delete, project-management, and future recording controls according to the current user's role while keeping server authorization as the actual security boundary.

### Version 2 Milestone 3 — Production Configuration

Remove development-only assumptions before hosting. Move database, upload directory, port, API/client origins, and other deployment settings into environment-based configuration, and establish a stable production hostname so later infrastructure changes do not require redesigning the clients.

### Version 2 Milestone 4 — VPS Deployment

Deploy the multi-user application to a small Linux VPS. Configure Node, PostgreSQL, persistent audio storage, process startup, a reverse proxy, HTTPS, firewall rules, logs, and backups so trusted friends and band members can use GrooveShare through a normal public URL.

### Version 2 Milestone 5 — Web Audio Engine and Sync Tools

Replace the multiple-HTML-audio-element playback model when the product needs tighter musical editing and synchronization. Use a shared Web Audio clock and decoded buffers to support reliable multitrack scheduling, gapless looping, waveforms, a shared playhead, channel offset/nudge, non-destructive trimming, and playback that respects edited channel settings.

### Version 2.x — Private Beta and Stabilization

Use GrooveShare with real bandmates after the VPS deployment. Fix production bugs as patch releases, improve file validation and loading/error states where real usage exposes weaknesses, watch storage and bandwidth behavior, and use feedback to decide what Version 3 actually needs.

### Version 3 Milestone 1 — Desktop/Home Hosting with Cloudflare Tunnel

Begin the self-hosting path by running the same GrooveShare server from the desktop and publishing it safely through Cloudflare Tunnel, with the option to move the workload to a dedicated home server later. Keep the public API contract and hostname stable so the move from the VPS is primarily an infrastructure migration rather than an application rewrite.

### Version 3 Milestone 2 — Mobile-Ready Web Client

Do a full responsive/mobile interaction pass before creating native wrappers. Make the Project Player, mixer, authentication, uploads, and controls comfortable on phone-sized touch screens so the same web UI can be reused by Capacitor instead of maintaining a separate mobile interface.

### Version 3 Milestone 3 — Microphone Recording Workflow

Add recording to the web client first using browser microphone APIs. Let an authorized Contributor listen to the existing mix, record a rough take, stop and preview it, name it, and upload it as a normal project track without prematurely adding DAW-grade monitoring or native-audio complexity.

### Version 3 Milestone 4 — Capacitor Android/iOS Apps

Wrap the proven responsive GrooveShare client with Capacitor, beginning with Android and then iOS. Keep the mobile apps connected to the same centralized GrooveShare API and only introduce native audio plugins if real device testing shows that the browser/WebView recording implementation is insufficient.

### Version 4 Milestone 1 — Collaboration Workflow Polish

Expand GrooveShare from a shared stem/recording tool into a fuller band collaboration workflow. Add features such as invitations, project notes/instructions, comments, collaborator identity, notifications, private project access, project status, and useful history/version information based on what beta users actually need.

## Known Issues

- [ ] Version 1 has no user authentication or project permissions
  The current stable release assumes trusted/local use. There is no server-enforced distinction between a viewer, contributor, and project owner; Version 2 Milestone 1 addresses this directly.

- [ ] Version 1 JSON metadata storage is not intended for concurrent multi-user production use
  The current file-backed metadata model was appropriate for the local MVP but should be replaced before the hosted multi-user beta. Version 2 Milestone 1 moves metadata to PostgreSQL.

## Phases

- [x] Phase 1 — Local MVP foundation
  Build the initial GrooveShare stem-player experience with Vite + Vanilla TypeScript, a pure Node backend, JSON metadata, local audio storage, project/track management, four-channel playback, persistent mix settings, and the completed Version 1 release.

- [ ] Phase 2 — Multi-user production web application
  Introduce PostgreSQL, user authentication, project memberships and role-based authorization, permission-aware client behavior, production configuration, and deployment to a VPS for a real private beta.

- [ ] Phase 3 — Self-hosting, recording, and mobile clients
  Move the centralized service from the VPS toward desktop/home hosting through Cloudflare Tunnel, make the web UI truly mobile-ready, add microphone recording, and package the existing client for Android/iOS with Capacitor.

- [ ] Phase 4 — Mature collaboration and audio workflow
  Deepen the collaborative band workflow with invitations, comments, notifications, project history/status, stronger private sharing, and more advanced Web Audio/synchronization tools when real usage justifies them.

## Versions

- [x] Version 1 — Stem Player MVP
  Create projects, upload and delete tracks, edit project/track details, configure a persistent four-channel mix, and play/pause/stop/loop/seek the shared audio locally with the Version 1 JSON/local-file architecture.

- [ ] Version 2 — Multi-User Hosted Beta
  Add PostgreSQL-backed users/projects, authentication, Viewer/Contributor/Owner permissions, permission-aware UI, and production deployment to a VPS so trusted friends and band members can use one centralized GrooveShare instance over the internet.

- [ ] Version 3 — Self-Hosted Mobile Recording
  Move toward desktop/home-server hosting through Cloudflare Tunnel, complete the mobile web experience, add microphone recording for Contributors, and distribute Android/iOS clients with Capacitor while keeping one shared GrooveShare backend.

- [ ] Version 4 — Mature Collaboration Platform
  Build on the stable multi-user/mobile foundation with richer collaboration, notifications, project history/status, invitations/private sharing, and advanced audio/sync tools that support a practical remote band workflow.

## Completed

### Project Definition and Initial Architecture

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

### Project Metadata and Upload Foundation

- [x] Build local project metadata foundation
  Created the first full project metadata flow using a local JSON data store, TypeScript backend types, tested store helpers, tested API routes, and a frontend project creation UI that can create, save, load, and display projects.

- [x] Save track metadata
  Store each uploaded track’s ID, name, original filename, local file path, MIME type, upload date, and related project ID.

- [x] Add local audio file upload
  Added the first full local audio upload workflow, including track metadata types, separated JSON store helpers, tested track store functions, pure Node multipart upload handling, local project-specific upload folders, upload validation, tested upload/list API routes, a frontend upload form, uploaded track metadata display, and readable upload error handling.

### Frontend Structure and Project Management

- [x] Refactor the frontend
  Refactor so that `main.ts` starts the app only and `app.ts` does routing coordination, app state, and page initialization. Create and add directories and files to handle screen changes (`router/`), render page HTML templates (`pages/`), and handle page-specific behavior (`page-controllers/`).

- [x] Restyled the main app pages
  Updated the UI for the main project workflow so the app now feels more like a guided multi-page experience instead of a collection of rough development screens.

- [x] Added reusable track deletion
  Added backend and frontend support for deleting individual tracks, including removing track metadata from `db.json`, deleting the linked uploaded audio file from `server/uploads/`, exposing a reusable `deleteTrack(projectId, trackId)` API helper, and wiring the first delete UI into the Project Player so tracks can be removed and the track list refreshes after deletion.

- [x] Added project deletion with linked track cleanup
  Added backend and frontend support for deleting entire projects, including removing project metadata from `db.json`, removing linked track metadata, deleting uploaded audio files and project upload folders from `server/uploads/`, exposing a reusable `deleteProject(projectId)` API helper, and wiring delete buttons into the Project Menu and Project Player flows with confirmation prompts and status messages.

### Playback and Mixer Development

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

### Version 1 Polish and Release

- [x] Final Version 1 cleanup pass
  Remove obviously stale code, update backlog checkboxes, run all tests/typechecks, and merge to main when stable.

- [x] Finalize CSS import structure

- [x] Remove old Confirm Project page flow
  Convert the modal purpose from adding tracks to confirming project creation details.

- [x] Add mix settings to Project details so that mix setting data persists after sesssion ends.

- [x] Add data persistance to project details after editting on the project player page.

- [x] Fix progress slider not seeking

### Shared Test Runner Migration

- [x] Set up npm workspace structure
  Added a root workspace configuration for the client, server, and reusable test-runner package.

- [x] Consolidate workspace dependency management
  Replaced the separate client and server lockfiles with a single root `package-lock.json` and verified clean workspace installation.

- [x] Add reusable test-runner package
  Created `packages/test-runner` as an independent `@hugovela/test-runner` workspace with its own configuration, tests, and typechecking.

- [x] Refactor test runner to create independent instances
  Replaced module-level tester state with `createTester()` so each consumer can use its own isolated test-runner instance.

- [x] Migrate client and server to the shared test runner
  Replaced the duplicated client and server tester implementations with lightweight adapters that use `@hugovela/test-runner`.

- [x] Remove duplicate test-runner tests
  Moved responsibility for testing the custom framework into the shared package and removed duplicate framework tests from the client and server suites.

- [x] Standardize client and server test failure output
  Both test suites now use the same shared failure-reporting implementation, including filename, test, assertion, error, suite, and URL details.

- [x] Add root workspace test scripts
  Added root commands for running each workspace's tests and typecheck together, plus a command for checking all workspaces.

### Accounts and Authorization Foundation

- [x] Add PostgreSQL persistence for project/track metadata
  Define the relational schema for projects, tracks, and persisted mix/project data; add the database connection layer; implement PostgreSQL-backed stores; and switch the application from JSON metadata persistence to PostgreSQL without changing the user-facing workflow.

- [x] Add user accounts and authentication
  Add a User model plus account creation/login/logout behavior, secure password handling, and persistent authentication/session support so the server can identify the user making each request.

- [x] Add project memberships and roles
  Add project membership records with the initial `Viewer`, `Contributor`, and `Owner` roles. Define ownership for existing/new projects and make the role model ready for Contributors to upload now and record later.