import { renderAudioPlayer } from "../src/templates/audio-player.js";
import { tester } from "./test-runner/tester.js";

tester.describe("audio player template", () => {
    tester.it("renders the audio player controls", () => {
        const html = renderAudioPlayer();

        tester.expect(html.includes("Project Player")).toBe(true);
        tester.expect(html.includes("No track loaded.")).toBe(true);
        tester.expect(html.includes("project-audio-player")).toBe(true);
        tester.expect(html.includes('crossorigin="use-credentials"')).toBe(true);
        tester.expect(html.includes("audio-seek-back-button")).toBe(true);
        tester.expect(html.includes("audio-seek-forward-button")).toBe(true);
        tester.expect(html.includes('aria-label="Seek backward 5 seconds"')).toBe(true);
        tester.expect(html.includes("-5s")).toBe(true);
        tester.expect(html.includes("audio-play-pause-button")).toBe(true);
        tester.expect(html.includes("audio-stop-button")).toBe(true);
        tester.expect(html.includes("audio-progress")).toBe(true);
        tester.expect(html.includes("audio-timestamp")).toBe(true);
        tester.expect(html.includes("audio-duration")).toBe(true);
        tester.expect(html.includes("audio-musical-position")).toBe(true);
        tester.expect(html.includes("Bar 1 · Beat 1")).toBe(true);
        tester.expect(html.includes("audio-seek-bar-input")).toBe(true);
        tester.expect(html.includes("audio-seek-bar-button")).toBe(true);
        tester.expect(html.includes("Loop")).toBe(true);
        tester.expect(html.includes('id="audio-loop-checkbox"')).toBe(true);
        tester.expect(html.includes('type="checkbox"')).toBe(true);
        tester.expect(html.includes("data-audio-loop-checkbox")).toBe(true);
        tester.expect(html.includes('id="audio-metronome-checkbox"')).toBe(true);
        tester.expect(html.includes('id="audio-playback-preparation"')).toBe(true);
        tester.expect(html.includes('id="audio-playback-preparation-retry"')).toBe(true);
        tester.expect(html.includes("Click")).toBe(true);
        tester.expect(html.includes("▶")).toBe(true);
        tester.expect(html.includes("❚❚")).toBe(false);
    });

    tester.it("places the microphone preparation control in the primary transport when allowed", () => {
        const html = renderAudioPlayer({ showMicrophoneControl: true });
        const backIndex = html.indexOf('id="audio-seek-back-button"');
        const playIndex = html.indexOf('id="audio-play-pause-button"');
        const microphoneIndex = html.indexOf('id="microphone-arm-button"');
        const stopIndex = html.indexOf('id="audio-stop-button"');
        const forwardIndex = html.indexOf('id="audio-seek-forward-button"');
        const loopIndex = html.indexOf('id="audio-loop-checkbox"');

        tester.expect(backIndex < playIndex).toBe(true);
        tester.expect(playIndex < microphoneIndex).toBe(true);
        tester.expect(microphoneIndex < stopIndex).toBe(true);
        tester.expect(stopIndex < forwardIndex).toBe(true);
        tester.expect(forwardIndex < loopIndex).toBe(true);
        tester.expect(html.includes('aria-label="Prepare microphone"')).toBe(true);
        tester.expect(html.includes('aria-pressed="false"')).toBe(true);
        tester.expect(html.includes("audio-player__microphone-icon")).toBe(true);
        tester.expect(html.includes('aria-label="Stop"')).toBe(true);
        tester.expect(html.includes("audio-player__stop-icon")).toBe(true);
    });

    tester.it("renders disabled controls before a track is loaded", () => {
        const html = renderAudioPlayer();

        tester.expect(html.includes("disabled")).toBe(true);
    });
});
