# GrooveShare Playback Derivatives Roadmap

## Goal

Reduce project-open playback latency dramatically without compromising GrooveShare's authoritative Web Audio scheduling, musical timeline, recording placement, synchronization, or alignment behavior.

The core architecture remains:

- **Original media** = authoritative source asset
- **Playback derivative** = smaller, replaceable playback representation
- **Shared Web Audio transport** = still authoritative for timing and scheduling
- **No second preview player**
- **Recording may use derivatives as backing audio once derivative timing equivalence is proven**

---

## Milestone 1 — Derivative Proof of Concept + Timing Gate

Before integrating derivatives into GrooveShare, prove that a candidate derivative format is safe for synchronized multitrack playback and recording.

### Work

- Choose initial derivative candidates/settings, likely:
  - Opus
  - 48 kHz
  - test bitrates such as 192 kbps and 256 kbps
- Generate derivatives from known WAV fixtures using FFmpeg.
- Use fixtures with clear transients/clicks at known positions.
- Decode both originals and derivatives through the same browser/Web Audio path GrooveShare uses.
- Measure whether corresponding transients land at the same decoded timeline positions.
- Measure:
  - original file size
  - derivative file size
  - transcode time
  - download-size reduction
  - decode time
- Determine whether codec/container delay or padding requires any internal compensation.

### Gate

Do **not** proceed with derivative integration unless:

- derivative timing is stable and deterministic;
- derivative vs original timing falls within a deliberately strict accepted tolerance;
- no user-facing second alignment system is required;
- the expected loading improvement is large enough to justify the architecture.

---

## Milestone 2 — Server Media Model + Derivative Lifecycle

Model original and derivative media separately on the server.

### Work

- Add storage/database metadata for:
  - original media path
  - derivative media path
  - derivative generation status
  - derivative format/version
  - internal timing compensation only if proven necessary
- Define derivative lifecycle states such as:
  - `pending`
  - `processing`
  - `ready`
  - `failed`
- Preserve the original as the authoritative asset.
- Make derivatives disposable and regeneratable.
- Add the necessary database migration(s).

### Invariant

Derivative failure must never endanger or invalidate the user's original recording.

---

## Milestone 3 — Server-Side FFmpeg Generation

Generate playback derivatives automatically after a track is uploaded.

### Work

- Save the original successfully first.
- Invoke FFmpeg server-side.
- Generate the approved playback derivative.
- Validate the generated file.
- Store derivative metadata/status.
- Handle failures safely.
- Make regeneration possible.
- Cover:
  - ordinary uploaded tracks
  - kept recorded takes

### Boundary

The browser/mobile client uploads the original only.

The frontend does **not** transcode media.

---

## Milestone 4 — Derivative Delivery + Existing-Track Backfill

Expose derivatives through GrooveShare's authenticated media system and support existing tracks.

### Work

- Add derivative delivery through the existing authenticated media architecture.
- Preserve original media delivery.
- Build a controlled backfill command/process for tracks that predate derivative support.
- Make backfill safe to rerun.
- Generate derivatives for existing Labs tracks before rollout testing.

---

## Milestone 5 — Frontend Dual-Source Preparation

Allow the shared playback layer to prepare derivatives first while originals load quietly in the background.

### Work

Each track may expose:

- playback derivative
- authoritative original

On project open:

1. fetch/decode required enabled derivatives;
2. declare playback ready when required derivatives are ready;
3. begin downloading/decoding originals in the background;
4. continue using the same authoritative Web Audio transport and timeline.

### Invariants

Do not create:

- a second playback clock;
- a separate preview player;
- duplicate timeline math;
- client-specific scheduling behavior.

---

## Milestone 6 — Playback + Recording Behavior

Make derivatives legitimate backing audio for real playback and recording.

### Work

Once required derivatives are ready, allow:

- Play
- Pause
- Stop
- Seek
- Loop
- Click
- Track enable/disable
- Mixer changes
- Recording

Recording must **not** wait for original files merely because originals are still downloading.

### Validate

- recording placement against derivatives is identical to placement against originals;
- alignment/synchronization behavior remains stable;
- derivative playback does not alter musical timeline semantics.

### Original Availability

When originals finish loading:

- avoid unsafe mid-play hot-swaps;
- initially prefer switching at a safe transport boundary such as Stop → Play, seek/restart, or the next transport run;
- preserve current mix and timeline state.

---

## Milestone 7 — Failure UX + Regression Hardening

Handle derivative availability and failure without weakening the existing experience.

### Work

- Represent derivative preparation truthfully.
- Preserve enabled-track prioritization.
- Define fallback behavior for:
  - missing derivative
  - failed derivative generation
  - failed derivative download
- Keep original-background preparation from blocking normal derivative playback.
- Add regression coverage for:
  - playback readiness
  - synchronization
  - seek/loop
  - recording
  - recording placement
  - alignment
  - Take Review
  - independent review mix
  - desktop/mobile consistency

---

## Milestone 8 — Labs Rollout + Performance Validation

Deploy the derivative architecture to Labs and compare it against the measured baseline.

### Current Baseline

Recent Labs measurements showed approximately:

- ~37 MB per track
- ~148 seconds of audio per track
- ~2.4 minutes network transfer for a large original track
- only ~0.1–0.2 seconds to decode after download

The dominant problem is network transfer size, not browser decoding.

### Rollout

- apply migrations;
- install FFmpeg/runtime dependencies if required;
- generate/backfill Labs derivatives;
- deploy server and frontend changes;
- verify all health checks.

### Re-measure

Measure:

- derivative file size
- derivative transfer duration
- decode duration
- project-open → playback ready
- project-open → recording ready
- original background-load completion

Compare directly against the current Labs baseline.

---

## Architectural Principles

Throughout the roadmap:

1. **Originals remain authoritative.**
2. **Derivatives are replaceable artifacts.**
3. **The current Web Audio scheduler remains authoritative.**
4. **Timeline, placement, alignment, and recording semantics remain shared.**
5. **Users never align derivatives separately.**
6. **Derivative timing compensation, if required, is an internal implementation detail.**
7. **Server owns transcoding and media representations.**
8. **Frontend owns playback/timeline semantics, not media generation.**
9. **Desktop and mobile use the same shared timing behavior.**
10. **Performance improvements must not trade away synchronization correctness.**
