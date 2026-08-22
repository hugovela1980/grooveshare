# Recording Alignment Diagnostics

Checkpoint 5A investigates where the audible recording offset enters the GrooveShare recording path. It intentionally does **not** compensate for latency or change take placement.

## What GrooveShare now records

Each synchronized microphone pass creates one correlated diagnostic attempt. When the take stops, desktop/mobile DevTools print a structured entry beginning with:

`[GrooveShare][Recording Alignment] recording-N completed`

The trace uses one browser monotonic observation clock for event ordering and also records the authoritative Web Audio clock where available.

Important observations include:

- project playback start requested
- authoritative Web Audio playback schedule and its lead time
- reported `AudioContext.baseLatency` / `outputLatency` when the browser exposes them
- microphone track settings such as reported input latency, sample rate, channel count, and processing flags when exposed
- `MediaRecorder.start()` called
- the browser's actual `MediaRecorder` `start` event
- the authoritative GrooveShare recording-start marker
- recording stop marker
- `MediaRecorder.stop()` and `stop` event
- final recorded-take placement

The completed trace also contains an `analysis` object with software-side deltas in milliseconds.

### Important limitation

These timestamps can reveal delay **inside GrooveShare/browser scheduling**, but they cannot directly measure when sound physically leaves a speaker/headset or reaches the microphone. Speaker, Bluetooth, operating-system, audio-driver, and microphone buffering must be measured with a repeatable acoustic/loopback transient.

## Generate an exact click reference

From the repository root:

```bash
npm run diagnostic:alignment-click -- --bpm=90 --numerator=4 --denominator=4 --bars=8
```

The generated WAV is written under the gitignored `sandbox/recording-alignment/` directory. Bar 1 / Beat 1 begins at WAV sample 0.

GrooveShare defines BPM as quarter-note BPM. Therefore a 6/8 test at 120 BPM uses an eighth-note project grid beat of 250 ms:

```bash
npm run diagnostic:alignment-click -- --bpm=120 --numerator=6 --denominator=8 --bars=8
```

## Controlled 5A test matrix

Run at least these tests on the same phone/audio route before changing compensation:

| BPM | Time signature | Suggested bars |
| ---: | :---: | ---: |
| 70 | 4/4 | 8 |
| 90 | 4/4 | 8 |
| 120 | 4/4 | 8 |
| 180 | 4/4 | 8 |
| 120 | 6/8 | 8 |

A second non-4/4 test such as 90 BPM in 6/4 is also useful if desired.

For each test:

1. Generate the matching click WAV.
2. Create/configure a GrooveShare project with the exact same BPM and time signature.
3. Upload the click WAV at Bar 1 / Beat 1.
4. Use the same phone and audio route for the whole comparison.
5. Arrange a deliberate loopback/acoustic path so the microphone captures the reference click. The built-in phone speaker + phone microphone is the simplest baseline. If testing Bluetooth, repeat it as a separate route rather than mixing results.
6. Arm and record several bars without manually trying to tap along. The recorded signal should contain the reference transient itself; human timing is not the measurement source.
7. Stop the recording and save/inspect the captured audio in a DAW or waveform-capable tool.
8. Measure the difference in milliseconds between the expected grid transient and the corresponding recorded transient at several points in the take.
9. Save the DevTools recording-alignment trace from the same attempt.

On Android Chrome, USB remote debugging can be used to inspect the phone tab from desktop Chrome (`chrome://inspect/#devices`) and copy the structured console trace.

## Record the results

Use a table like this for the physical measurement:

| BPM | Signature | Audio route | Offset near start (ms) | Offset later (ms) | Offset in project grid beats | Trace ID |
| ---: | :---: | --- | ---: | ---: | ---: | --- |
| 70 | 4/4 |  |  |  |  |  |
| 90 | 4/4 |  |  |  |  |  |
| 120 | 4/4 |  |  |  |  |  |
| 180 | 4/4 |  |  |  |  |  |
| 120 | 6/8 |  |  |  |  |  |

For a 4/4 project, one project grid beat is one quarter note. For 6/8, one project grid beat is one eighth note.

### How to interpret the pattern

- **Similar millisecond offset at different BPMs:** points toward a fixed audio/device/browser latency rather than a musical-timeline error.
- **Similar fraction of a beat while milliseconds change with BPM:** points toward a tempo-relative scheduling or musical-position error.
- **Offset grows from the beginning to the end of a take:** points toward clock/rate drift rather than a simple start offset.
- **Software trace is near zero but the recorded transient is late:** points outside GrooveShare's placement math toward output/input/device buffering.
- **MediaRecorder start-event delay closely matches the physical offset:** capture startup is a strong contributor.
- **The recording marker precedes the scheduled Web Audio start by roughly the fixed scheduling lead:** that is expected from GrooveShare's ahead scheduling and should not by itself be treated as the acoustic latency value.

## Current code-level observation before device measurement

The current recording flow schedules Web Audio slightly ahead, starts `MediaRecorder`, and then captures the authoritative recording marker. Before Checkpoint 5A, GrooveShare did not observe the browser's actual `MediaRecorder` `start` event at all.

That creates a measurable software gap worth investigating. It does **not** yet prove that this gap is the audible offset. The controlled transient test is required before Checkpoint 5B changes timing or compensation.


## Browser processing A/B test

The Project Player includes a temporary **Raw mic (diagnostic)** checkbox for Checkpoint 5A.

- **Unchecked** preserves the normal browser microphone request used before this diagnostic extension.
- **Checked before `Enable Microphone`** requests:
  - `echoCancellation: false`
  - `noiseSuppression: false`
  - `autoGainControl: false`

The browser may still choose what it can support, so the completed recording trace reports both the requested values and the actual `MediaStreamTrack.getSettings()` values. Treat the actual settings as authoritative for the experiment.

For the A/B comparison, hold every other variable constant: same project, source click, BPM/time signature, input device, output device, speakers, microphone position, browser session, and volume. Record one take with the checkbox unchecked and one with it checked. Keep both takes so their stored WebM files can be measured against the same source WAV.

Do not toggle the checkbox after the microphone has already been enabled; constraints are resolved when the browser stream is acquired. Finish/Discard the current take so the microphone is released, choose the next checkbox state, and enable the microphone again.
