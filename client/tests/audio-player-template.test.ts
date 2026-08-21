import { renderAudioPlayer } from "../src/templates/audio-player.js";
import { tester } from "./test-runner/tester.js";

tester.describe("audio player template", () => {
    tester.it("renders the audio player controls", () => {
        const html = renderAudioPlayer();

        tester.expect(html.includes("Audio Player")).toBe(true);
        tester.expect(html.includes("No track loaded.")).toBe(true);
        tester.expect(html.includes("project-audio-player")).toBe(true);
        tester.expect(html.includes('crossorigin="use-credentials"')).toBe(true);
        tester.expect(html.includes("audio-seek-back-button")).toBe(true);
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
        tester.expect(html.includes("data-audio-loop-checkbox")).toBe(true);
        tester.expect(html.includes("▶")).toBe(true);
        tester.expect(html.includes("❚❚")).toBe(false);
    });

    tester.it("renders disabled controls before a track is loaded", () => {
        const html = renderAudioPlayer();

        tester.expect(html.includes("disabled")).toBe(true);
    });
});