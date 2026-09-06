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

## Milestone 4 — Derivative Delivery

Expose ready playback derivatives through GrooveShare's protected media architecture while preserving original media delivery.

### Work

- Add a separate protected derivative route using the same authorization and byte-range streaming behavior as original media.
- Preserve the authoritative original media route unchanged.
- Serve only `ready` derivative artifacts; do not fall back to originals or generate derivatives during delivery.

### Development-stage data policy

Pre-derivative projects and tracks are disposable test data. Before derivative playback rollout testing, desired tracks will be re-uploaded so they pass through the current normal generation pipeline. No existing-track backfill, compatibility layer, migration-time transcoding, lazy generation, or background repair process will be built.

---

## Milestone 5 — Frontend Dual-Source Preparation

Allow the shared playback layer to use derivatives for immediate readiness while making authoritative-original background preparation an explicit shared policy choice.

### Work

Each playback channel exposes distinct sources for:

- playback derivative
- authoritative original

One shared `PlaybackMediaPreparationPolicy` controls both clients:

- `derivative-only`
  - fetch/decode playback derivatives;
  - use derivatives as the active playback representation;
  - do not request or retain originals.
- `derivative-plus-original`
  - fetch/decode required enabled derivatives first;
  - declare playback ready when required derivatives are ready;
  - prepare other derivatives according to the existing disabled-track background behavior;
  - then fetch/decode originals as nonblocking background work and retain them separately.

In both policies:

1. the derivative remains the active playback buffer;
2. required derivative failure uses playback-preparation failure semantics without original fallback;
3. original state never gates derivative readiness;
4. the same authoritative Web Audio transport, scheduler, timeline, placement, alignment, and mixer behavior remain in use.

A future entitlement or tier layer may select the policy without introducing account concepts into the playback engine. Milestone 5 does not promote a prepared original or switch sources during playback; source-promotion behavior remains Milestone 6.

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

Required enabled derivatives define the shared Play and Record readiness contract. Under `derivative-only`, every transport run schedules derivatives and originals are neither requested nor considered. Under `derivative-plus-original`, each enabled channel independently selects a prepared original when a new transport run starts and otherwise selects its derivative. Original preparation failure remains nonblocking.

The selected representation is fixed for the lifetime of the transport run. Pause/resume, an active seek, and loop wrap may reschedule source nodes but retain the run's selection. Stop, natural termination, or replacement of the loaded mix ends the run; the next Play or synchronized Record reevaluates sources. A channel enabled during playback selects its best currently prepared representation once when it joins and does not hot-swap afterward.

### Validate

- recording placement against derivatives is identical to placement against originals;
- alignment/synchronization behavior remains stable;
- derivative playback does not alter musical timeline semantics.
- recording source selection does not alter the authoritative musical start,
  alignment offset, media lead-in, or recording anchor.

### Original Availability

Prepared originals are promoted only at a new transport-run boundary. Original completion never causes a mid-play or mid-record hot-swap, and neither seek nor loop wrap is a promotion boundary. The current mix, scheduler, AudioContext clock, timeline, and placement math remain representation-independent. Future account or quality-tier code may choose the shared media policy externally; no entitlement concepts belong in playback core.

---

## Milestone 7 — Failure UX + Regression Hardening

Handle derivative availability and failure without weakening the existing experience.

### Work

- Carry the server lifecycle into the shared playback-preparation model: `pending`/`processing` are not ready, `failed` is a generation failure, and an absent derivative without lifecycle metadata is unavailable.
- Classify derivative download and decode failures separately while keeping one presentation-independent failure contract.
- Block Play and synchronized Record for a failed enabled derivative, keep disabled-track failures nonblocking, and retry only failed required derivatives without refetching successful channels.
- Never use the authoritative original as a derivative fallback. Keep optional original-background download or decode failure from blocking a ready derivative.
- Present equivalent Audio unavailable and Retry behavior on desktop and mobile.
- Preserve regression coverage for:
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
- re-upload any desired disposable Labs test tracks through the normal generation pipeline;
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
