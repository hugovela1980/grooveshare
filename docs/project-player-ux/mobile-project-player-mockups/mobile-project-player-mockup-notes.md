# GrooveShare Mobile Project Player Mockup Notes

## Design direction

These mockups translate the `docs/project-player-ux` structure into a mobile-first GrooveShare interface. The wireframes guided hierarchy and behavior; the current mobile and desktop clients guided terminology, permissions, timeline behavior, mix controls, alignment semantics, and recovery rules.

The proposed visual system uses the current dark GrooveShare palette, compact raised surfaces, mint for active/primary state, and red only for recording or destructive actions. Controls are sized for touch and the player stays spatially stable while the recording workflow appears as a raised in-page workspace.

The normal player keeps Loop and Click as two compact side-by-side switches. Neither switch uses an enclosing card outline. The seek slider carries more visual weight than secondary controls so the current playback position remains easy to find and adjust.

## State coverage

1. Normal Project Player
2. Requesting microphone permission / preparing device
3. Microphone ready, before capture begins
4. Count-in
5. Active recording
6. Finishing capture and saving the recoverable draft
7. Immediate post-recording audition
8. Expanded recording alignment within the review flow
9. Expanded playback mix within the review flow
10. Keep/track-name confirmation
11. Permission denied
12. Discard confirmation
13. Retry with the sticky Bar/Beat anchor preserved
14. Recovered pending-take draft

## Preserved GrooveShare behavior

- The microphone button opens the workflow; it does not immediately start a take.
- Count-in and capture remain tied to the shared musical timeline.
- Bar/Beat uses whole beats in user-facing text.
- Retry preserves the recording anchor.
- Negative alignment moves the take earlier; positive alignment moves it later.
- Audition volume belongs to pending-take review.
- Keep confirms the track name and preserves musical placement and alignment.
- Closing or reloading cannot silently destroy a stopped recoverable take.
- Discard remains explicit and destructive.
- Mix channels retain name, volume, percentage, enabled state, and horizontal overflow.
- The mobile navigation contains `Projects`, `People`, `Library`, and `Logout`.
- The recording start position remains adjustable from the ready and Retry states.
- Review exposes separate collapsed disclosures for recording alignment and playback mix/audition volume.

## Planned microphone level meter

The recording-state mockup intentionally retains a live microphone input level meter. This is a planned enhancement and is not represented as existing implemented behavior.

It is appropriately scoped as one focused implementation task, but it is more than a styling change. The task should include:

- connecting an analyser to the active microphone stream without changing capture ownership;
- deriving and smoothing a display level without introducing another recording clock;
- starting and stopping visualization work with the recording lifecycle;
- handling permission failure, stream loss, and unavailable analyser support;
- avoiding feedback or software-monitoring behavior;
- respecting reduced-motion preferences;
- focused controller/integration tests and cleanup verification.

The meter should remain presentation-only. It must not affect recorded gain, audition volume, kept-track volume, or shared timeline behavior.

## Review flow and Playback Mix

When capture processing finishes, GrooveShare opens directly into the Audition review screen. There is no separate stopped-take screen that the user must pass through before auditioning.

The review flow has three views of the same pending take:

1. `Audition` — the default post-recording view;
2. `Set Recording Alignment` — expanded alignment controls;
3. `Playback Mix` — expanded project-track playback controls.

The second collapsed disclosure beneath `Set Recording Alignment` is:

- title: `Playback Mix`;
- summary: `Project tracks`;
- expanded content: existing project-track enable and volume controls used during audition.

The pending take's `Audition volume` slider remains directly visible in all three review views. It is not placed inside either disclosure, so the user can adjust it without changing views. Adjusting audition volume must not silently redefine the kept track volume.

In the default Audition view, the slider is compact and visually grouped with the audition action. In Alignment and Playback Mix, it remains full width beneath the expanded controls. The audition take timeline uses a neutral gray display treatment without a draggable thumb so it does not appear seekable.

`Discard` is the final action at the bottom of each review view, after the Alignment and Playback Mix content. It remains red and visually secondary, with explicit confirmation before removing the recoverable draft.

## Visual details that remain open to implementation

- Exact bottom-navigation destinations and iconography should match the mobile app's final information architecture.
- The approved bottom-navigation labels for these mockups are `Projects`, `People`, `Library`, and `Logout`; final icons should reuse the application's icon system.
- The count-in beat ring and microphone level meter are presentation concepts; they should read from existing state only and must not create a second timing source.
- Sheet height can adapt to viewport and safe-area constraints. During review, the sheet may become the main scroll owner while the underlying player stays fixed.
- Animation should be restrained and respect reduced-motion preferences.

## Suggested mobile layout rules

- Keep the transport and seek position visible before the recording sheet opens.
- Use one dominant action per recording state.
- Keep `Stop recording` visually isolated from Project Player Stop.
- Collapse alignment by default and show the current offset in its summary.
- Keep destructive actions visible but secondary until confirmation.
- Make the mixer a single horizontal row with snap-friendly channel widths; do not wrap channels into multiple rows.
