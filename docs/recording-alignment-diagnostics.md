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

## AudioWorklet PCM-vs-MediaRecorder isolation test

Checkpoint 5A can temporarily observe the live microphone PCM stream **before**
MediaRecorder encoding. This diagnostic is enabled automatically when `Raw mic
(diagnostic)` is checked before `Enable Microphone`.

The browser adapter creates a second, silent Web Audio diagnostic branch from
the same `getUserMedia()` stream:

```text
getUserMedia microphone stream
        |
        +--> AudioWorklet PCM monitor --> zero-gain output
        |
        +--> MediaRecorder --> WebM take
```

The AudioWorklet does not change take placement or recording behavior. It only
looks for strong transients and reports their microphone-audio-clock timestamp.
The zero-gain output keeps the worklet graph rendered without feeding the
microphone signal back to the musician.

The completed trace adds:

- `pcmAlignmentMonitorStatus` to `microphone-prepared`
  - `ready` means the AudioWorklet tap started
  - `unsupported` means the browser lacks a required AudioWorklet API
  - `failed` means setup threw; `pcmAlignmentMonitorError` records the message
- `microphone-pcm-clock-anchor`
- one or more `microphone-pcm-transient-detected` events
- `analysis.firstPcmTransientRelativeToScheduledPlaybackMilliseconds`
- `analysis.firstPcmTransientRelativeToMediaRecorderStartEventMilliseconds`

The monitor currently uses a diagnostic transient threshold of `0.04` peak
amplitude and a 180 ms refractory window, which is appropriate for the loud
120 BPM click reference used in this investigation. It records at most 64
transients per attempt so the diagnostic trace stays bounded.

### Android Chrome test procedure

Use the 120 BPM / 4/4 diagnostic click project that has already produced a
repeatable raw-microphone offset.

1. Refresh the phone page so the diagnostic state is clean.
2. Check `Raw mic (diagnostic)` **before** enabling the microphone.
3. Tap `Enable Microphone` and confirm permission if needed.
4. Record the click project for several bars.
5. Stop and **Keep** the take so the exact WebM from the attempt is available.
6. Remote-debug the Android Chrome tab and copy the completed Recording
   Alignment JSON object.
7. Confirm `microphone-prepared.detail.pcmAlignmentMonitorStatus` is `ready`.
8. Confirm the trace contains `microphone-pcm-clock-anchor` and repeated
   `microphone-pcm-transient-detected` events.
9. Compare the AudioWorklet-derived first-transient delay with the transient
   positions in the matching saved WebM.

### How this isolates MediaRecorder

If the AudioWorklet already sees the microphone transient roughly as late as
the matching WebM, the large delay exists **before MediaRecorder** in the
speaker/output, device/OS, `getUserMedia`, or browser capture path.

If the AudioWorklet sees the transient much earlier while the matching WebM is
still hundreds of milliseconds late, MediaRecorder/encoding/timestamping is a
major contributor.

The AudioWorklet estimate is diagnostic evidence, not an automatic latency
compensation value. The monitor uses a separate browser audio clock bridged to
the trace's monotonic clock by `microphone-pcm-clock-anchor`; the result is
intended to separate large latency stages, not claim sample-perfect
cross-context calibration.

## Multi-level platform audio path probe

The 5A diagnostic now records several browser-visible checkpoints in a single
same-device recording attempt. The goal is to avoid inferring a whole
round-trip delay from one opaque measurement.

For an Android same-device test, the useful ladder is:

1. **GrooveShare/Web Audio schedule** — `project-playback-scheduled` records the
   authoritative `AudioContext` start time and the normal 30 ms scheduling
   lead.
2. **Browser output-device clock estimate** — the same event records
   `AudioContext.getOutputTimestamp()` when the browser exposes it. From that
   mapping the trace derives `estimatedScheduledOutputPerformanceTimeMilliseconds`.
   This is the browser's estimate of when the scheduled project frame reaches
   the output device; it is not a microphone measurement or an external sensor
   attached to the speaker.
3. **Output-path statistics** — the playback event and periodic
   `project-output-clock-sample` events record `baseLatency`, `outputLatency`,
   output clock lag, sample rate/sink information, and `AudioPlaybackStats`
   latency/underrun values when the browser implements that experimental API.
   Samples are taken shortly after start and later in the same take so startup
   behavior can be compared with steady state.
4. **Microphone track contract** — `microphone-prepared` records the actual
   processing settings, browser-reported input latency, whether the latency
   constraint is supported, the track's latency capability range when exposed,
   sample-rate/channel capabilities, and any applied latency constraint.
5. **Live microphone PCM** — `microphone-pcm-transient-detected` is produced by
   the AudioWorklet tap on the acquired `getUserMedia()` stream before
   `MediaRecorder` encoding.
6. **MediaRecorder** — start/stop events and the final encoded capture remain in
   the same correlated trace. The matching kept WebM can be measured offline
   against the same click source.

The completed `analysis` object now includes these additional summaries when
supported:

- `estimatedScheduledOutputDevicePerformanceTimeMilliseconds`
- `estimatedOutputDeviceRenderRelativeToScheduledPlaybackMilliseconds`
- `firstPcmTransientRelativeToEstimatedOutputDeviceRenderMilliseconds`
- `reportedOutputLatencyMilliseconds`
- `reportedInputLatencyMilliseconds`
- `reportedEndpointRoundTripLatencyMilliseconds`
- `unaccountedInputPathMilliseconds`

The most important new value is
`firstPcmTransientRelativeToEstimatedOutputDeviceRenderMilliseconds`. It
subtracts the browser's output-device timestamp estimate from the live PCM
transient time. On a phone using its own speaker and microphone, acoustic travel
through a few centimeters of air is negligible, so a large remainder points
primarily at the microphone hardware / Android capture / browser capture side
rather than at GrooveShare scheduling.

`unaccountedInputPathMilliseconds` subtracts the microphone track's own
reported input-latency setting from that remainder. It is diagnostic evidence,
not a safe automatic compensation value. Browser latency properties are
estimates and do not necessarily describe every platform buffer.

### Exact-minimum input-constraint experiment

The temporary `Raw mic (diagnostic)` path now requests:

```text
latency: { exact: 0.02 }
```

That is a 20 ms **exact** latency requirement. It is intentionally stronger
than the previous `ideal: 0.02` experiment. The tested Android/Chrome route
advertises a 20–40 ms input-latency capability range, but the prior ideal
request was accepted while `getSettings().latency` still reported 40 ms.

This experiment asks whether Chrome can actually select the advertised 20 ms
endpoint. Because `exact` is mandatory, microphone preparation may fail with
an over-constrained-style browser error if this route cannot provide 20 ms.
That failure is useful diagnostic evidence and should not be hidden or silently
retried with another latency value during this test.

`microphone-prepared` records the requested constraint and the acquired track's
actual setting. Compare these fields:

- `requestedLatencyConstraintExactMilliseconds` — should be 20 when preparation succeeds
- `appliedLatencyConstraintMilliseconds` / `appliedLatencyConstraintExactMilliseconds`
- `inputLatencyMilliseconds`
- `firstPcmTransientRelativeToEstimatedOutputDeviceRenderMilliseconds`
- `unaccountedInputPathMilliseconds`

Interpretation:

- If `inputLatencyMilliseconds` becomes about 20 ms and the real output→PCM
  measurement materially falls, the browser constraint is influencing the
  actual Android capture path.
- If preparation succeeds but `inputLatencyMilliseconds` remains about 40 ms,
  the browser's advertised capability/constraint surface is not controlling the
  underlying route as expected.
- If `getUserMedia` rejects the exact request, the advertised 20 ms minimum is
  not selectable on this active route through Chrome.

This remains a Checkpoint 5A experiment. Do not turn 20 ms into a permanent
platform assumption or compensation value from this test.

### One-run Android procedure

Use the phone for **both playback and recording** so the project schedule,
output timestamp, microphone PCM, and MediaRecorder observations are all tied to
the same browser/performance clock.

1. Open the 120 BPM / 4/4 click project in Android Chrome.
2. Refresh the page so the diagnostic attempt starts from a clean page session.
3. Check `Raw mic (diagnostic)` before enabling the microphone.
4. Enable the microphone and record the full click reference once.
5. Keep the take so the exact matching WebM is available.
6. Copy the completed `[GrooveShare][Recording Alignment]` JSON from remote
   DevTools.
7. Send the JSON and matching WebM together for analysis.

Do not compare an absolute transient offset from a phone recording a different
computer's playback against this same-device trace. Those devices have
independent clocks and independent start actions, so that recording is useful
for stability/drift observations but not for absolute round-trip latency.
