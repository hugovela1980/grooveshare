import { renderAudioPlayer } from "../src/templates/audio-player.js";
import { tester } from "./test-runner/tester.js";

tester.describe("audio player template", () => {
    tester.it("renders the audio player controls", () => {
        const html = renderAudioPlayer();

        tester.expect(html.includes("Audio Player")).toBe(true);
        tester.expect(html.includes("No track loaded.")).toBe(true);
        tester.expect(html.includes("project-audio-player")).toBe(true);
        tester.expect(html.includes("audio-play-pause-button")).toBe(true);
        tester.expect(html.includes("audio-stop-button")).toBe(true);
        tester.expect(html.includes("audio-progress")).toBe(true);
        tester.expect(html.includes("audio-timestamp")).toBe(true);
    });

    tester.it("renders disabled controls before a track is loaded", () => {
        const html = renderAudioPlayer();

        tester.expect(html.includes("disabled")).toBe(true);
    });
});