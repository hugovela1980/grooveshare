# GrooveShare Version 1 Player Flow Notes

## Purpose

These notes capture the intended Version 1 user flow and early player-screen direction for GrooveShare.

The goal is to keep the app moving toward a useful stem-player experience without getting stuck in visual polish too early.

## Proposed App Pages / Screens

GrooveShare can be thought of as having several main pages or screens:

```txt
1. Project Menu
2. Create Project
3. Confirm Project Creation
4. Audio Player with Tracks
5. Record Screen
6. About Page
```

## Project Menu

The Project Menu acts like the home or dashboard screen.

Its main purpose is to list all existing projects so the user can choose one to open.

Possible responsibilities:

* List all projects
* Let the user open a project
* Provide a path to create a new project
* Eventually provide project actions such as edit, delete, share, or duplicate

## Create Project

The Create Project page is where a user starts a new GrooveShare project.

Possible elements:

* Project form
* Track form
* Submit button

The track form may eventually support two paths:

* Upload an existing track
* Record a track

This screen should focus on setup, not playback.

## Confirm Project Creation

After creating a project, the app may show a confirmation screen.

Possible responsibilities:

* Show project details
* Allow the user to edit project details
* Confirm that the project was created successfully
* Redirect or navigate back to the Project Menu
* Eventually offer a direct path into the Audio Player screen

## Audio Player with Tracks

The Audio Player with Tracks page is the main Version 1 target experience.

This screen should feel less like a file upload page and more like a small mobile-friendly mixer/player.

The uploaded tracks are not just files in a list. They become track channels in a player workspace.

The visual direction includes:

* Back button
* Menu button
* Track strips
* Track names
* Mixer-style volume faders
* Project name
* Timeline/progress bar
* Time display
* Transport controls

Possible transport controls:

* Previous/start
* Pause/play
* Main play
* Restart/rewind
* Next/end

## Audio Player Design Direction

The player screen should eventually have two main areas:

```txt
Track mixer area
- Track name
- Track strip
- Volume/fader control
- Later: mute, solo, pan

Player/control area
- Project name
- Progress bar
- Current time
- Total duration
- Transport controls
```

The important design idea is that the transport controls should eventually control the project playback as a whole, not just individual tracks.

This sets the app up for future multitrack playback.

## Recommended Build Layers

The full mixer UI should not be built all at once.

A practical build order:

### First Pass

* Project name
* One uploaded track
* One playable audio source
* Basic play/pause through a browser audio element
* Track name and basic metadata

### Second Pass

* Multiple uploaded tracks listed as channels
* Basic per-track volume controls
* Simple mute behavior

### Later Pass

* Solo controls
* Pan controls
* Synchronized multitrack playback
* Custom mixer-style vertical faders
* Rewind/skip controls
* More polished player visuals

## About Vertical Faders

The vertical fader idea fits the music/mixer concept well.

However, custom vertical sliders can become a styling and browser-behavior rabbit hole. HTML range inputs are naturally horizontal, so the first implementation should prioritize working playback over perfect mixer styling.

A reasonable path:

```txt
First: simple horizontal volume slider
Later: styled vertical mixer fader
```

This keeps the app moving toward a working Version 1 milestone while preserving the visual direction.

## User Flow Recommendation

The current app has working pieces:

* Create project
* Upload track
* Save audio file locally
* Save track metadata
* Display uploaded track metadata

The next design/user-flow improvement should be structural, not purely visual.

Recommended Version 1 flow:

```txt
Project Menu
  → Create Project
  → Confirm Project Creation
  → Project Menu or Audio Player

Project Menu
  → Open Project
  → Audio Player with Tracks
```

The upload form should eventually belong inside a project-focused flow, not as a disconnected global panel.

## Near-Term Development Recommendation

Before building a polished player, define the screen structure enough so playback lands in the right place.

A useful next milestone could be:

```md
- [ ] Define Version 1 project workflow
  Decide how users move from project creation to track upload to track playback, and adjust the UI structure so the upcoming audio player has a clear place to live.
```

Then continue with:

```md
- [ ] Build first playable uploaded track
  Serve uploaded audio files from local storage and add a basic frontend audio player that can play one uploaded track.
```

## Design Timing

It is productive to think about user flow and layout now.

It is probably too early for final visual polish.

Good things to decide now:

* What screens exist
* Where project creation happens
* Where upload happens
* Where playback happens
* How a user moves from project list to player
* Where the player UI will live

Things to avoid spending too much time on yet:

* Final colors
* Final typography
* Perfect spacing
* Animations
* Fully custom mixer controls
* Pixel-perfect mobile layout

The goal is to prevent a major structural refactor later while still reaching the Version 1 stem-player milestone.

