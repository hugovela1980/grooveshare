import { renderMixChannelSlots } from "../src/templates/mix-channel-slots.js";
import type { Track } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

function createTrack(overrides: Partial<Track> = {}): Track {
    return {
        id: "track-1",
        projectId: "project-1",
        name: "Guitar",
        originalFilename: "guitar.wav",
        filePath: "server/uploads/projects/project-1/guitar.wav",
        mimeType: "audio/wav",
        fileSize: 123,
        createdAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

tester.describe("mix channel slots template", () => {
    tester.it("renders four mostly empty channel slots when there are no tracks", () => {
        const html = renderMixChannelSlots([]);

        const slotCount = (html.match(/data-mix-channel-slot/g) ?? []).length;

        tester.expect(slotCount).toBe(4);

        tester.expect(html.includes('data-mix-channel="1"')).toBe(true);
        tester.expect(html.includes('data-mix-channel="2"')).toBe(true);
        tester.expect(html.includes('data-mix-channel="3"')).toBe(true);
        tester.expect(html.includes('data-mix-channel="4"')).toBe(true);

        tester.expect(html.includes("Add Track")).toBe(true);

        tester.expect(html.includes("Empty slot")).toBe(false);
        tester.expect(html.includes("No track assigned.")).toBe(false);
        tester.expect(html.includes("Waveform placeholder")).toBe(false);
    });

    tester.it("renders the channel number as the enabled toggle for assigned tracks", () => {
        const html = renderMixChannelSlots([createTrack()]);

        tester.expect(html.includes("data-channel-enabled")).toBe(true);
        tester.expect(html.includes('aria-label="Enable channel 1"')).toBe(true);
        tester.expect(html.includes("checked")).toBe(true);

        tester.expect(html.includes('class="mix-channel-slot__channel-number"')).toBe(true);

        tester.expect(html.includes(">Enabled<")).toBe(false);
    });

    tester.it("renders an Add Track button for empty channel slots", () => {
        const html = renderMixChannelSlots([]);

        tester.expect(html.includes("Add Track")).toBe(true);
        tester.expect(html.includes("data-track-add-button")).toBe(true);
        tester.expect(html.includes('data-mix-channel="1"')).toBe(true);
        tester.expect(html.includes('data-mix-channel="2"')).toBe(true);
        tester.expect(html.includes('data-mix-channel="3"')).toBe(true);
        tester.expect(html.includes('data-mix-channel="4"')).toBe(true);
    });

    tester.it("renders the first uploaded track as Channel 1", () => {
        const html = renderMixChannelSlots([
            createTrack({
                id: "track-1",
                name: "Guitar",
                originalFilename: "guitar.wav",
            }),
        ]);

        tester.expect(html.includes('data-mix-channel="1"')).toBe(true);
        tester.expect(html.includes("Guitar")).toBe(true);
        tester.expect(html.includes('data-track-id="track-1"')).toBe(true);
        tester.expect(html.includes('data-mix-channel="2"')).toBe(true);
        tester.expect(html.includes("Empty slot")).toBe(false);
        tester.expect(html.includes("Add Track")).toBe(true);
    });

    tester.it("renders the first two uploaded tracks as Channel 1 and Channel 2", () => {
        const html = renderMixChannelSlots([
            createTrack({
                id: "track-1",
                name: "Drums",
                originalFilename: "drums.wav",
            }),
            createTrack({
                id: "track-2",
                name: "Bass",
                originalFilename: "bass.wav",
            }),
        ]);

        tester.expect(html.includes('data-mix-channel="1"')).toBe(true);
        tester.expect(html.includes("Drums")).toBe(true);
        tester.expect(html.includes('data-track-id="track-1"')).toBe(true);
        tester.expect(html.includes('data-mix-channel="1"')).toBe(true);

        tester.expect(html.includes('data-mix-channel="2"')).toBe(true);
        tester.expect(html.includes("Bass")).toBe(true);
        tester.expect(html.includes('data-track-id="track-2"')).toBe(true);
        tester.expect(html.includes('data-mix-channel="2"')).toBe(true);

        tester.expect(html.includes('data-mix-channel="3"')).toBe(true);
        tester.expect(html.includes('data-mix-channel="4"')).toBe(true);
        tester.expect(html.includes("Add Track")).toBe(true);
    });

    tester.it("renders enabled, volume, waveform, and delete controls for assigned tracks", () => {
        const html = renderMixChannelSlots([createTrack()]);

        tester.expect(html.includes("data-channel-enabled")).toBe(true);
        tester.expect(html.includes("data-channel-volume")).toBe(true);
        tester.expect(html.includes("Waveform placeholder")).toBe(true);
        tester.expect(html.includes("data-track-delete-button")).toBe(true);
        tester.expect(html.includes("Delete")).toBe(true);
        tester.expect(html.includes("data-mix-channel-slot")).toBe(true);
        tester.expect(html.includes('data-mix-channel="1"')).toBe(true);
    });

    tester.it("renders a Load Mix button for preparing the current channel setup", () => {
        const html = renderMixChannelSlots([]);

        tester.expect(html.includes("Load Mix")).toBe(true);
        tester.expect(html.includes('id="load-mix-button"')).toBe(true);
        tester.expect(html.includes("data-load-mix-button")).toBe(true);
        tester.expect(html.includes("Enable up to four tracks, set volume, then load the mix into the player.")).toBe(true);
    });

    tester.it("renders the first four uploaded tracks as Channels 1 through 4", () => {
        const html = renderMixChannelSlots([
            createTrack({
                id: "track-1",
                name: "Drums",
                originalFilename: "drums.wav",
            }),
            createTrack({
                id: "track-2",
                name: "Bass",
                originalFilename: "bass.wav",
            }),
            createTrack({
                id: "track-3",
                name: "Delay Guitar",
                originalFilename: "delay-guitar.wav",
            }),
            createTrack({
                id: "track-4",
                name: "Tremolo Guitar",
                originalFilename: "tremolo-guitar.wav",
            }),
        ]);

        tester.expect(html.includes('data-mix-channel="1"')).toBe(true);
        tester.expect(html.includes("Drums")).toBe(true);
        tester.expect(html.includes('data-track-id="track-1"')).toBe(true);

        tester.expect(html.includes('data-mix-channel="2"')).toBe(true);
        tester.expect(html.includes("Bass")).toBe(true);
        tester.expect(html.includes('data-track-id="track-2"')).toBe(true);

        tester.expect(html.includes('data-mix-channel="3"')).toBe(true);
        tester.expect(html.includes("Delay Guitar")).toBe(true);
        tester.expect(html.includes('data-track-id="track-3"')).toBe(true);

        tester.expect(html.includes('data-mix-channel="4"')).toBe(true);
        tester.expect(html.includes("Tremolo Guitar")).toBe(true);
        tester.expect(html.includes('data-track-id="track-4"')).toBe(true);

        tester.expect(html.includes("Add Track")).toBe(false);
    });

    tester.it("does not render more than four uploaded tracks as channel slots", () => {
        const html = renderMixChannelSlots([
            createTrack({
                id: "track-1",
                name: "Track One",
            }),
            createTrack({
                id: "track-2",
                name: "Track Two",
            }),
            createTrack({
                id: "track-3",
                name: "Track Three",
            }),
            createTrack({
                id: "track-4",
                name: "Track Four",
            }),
            createTrack({
                id: "track-5",
                name: "Track Five",
            }),
        ]);

        tester.expect(html.includes("Track One")).toBe(true);
        tester.expect(html.includes("Track Two")).toBe(true);
        tester.expect(html.includes("Track Three")).toBe(true);
        tester.expect(html.includes("Track Four")).toBe(true);
        tester.expect(html.includes("Track Five")).toBe(false);
    });

    tester.it("escapes assigned track names", () => {
        const html = renderMixChannelSlots([
            createTrack({
                name: "<Guitar & Bass>",
            }),
        ]);

        tester.expect(html.includes("&lt;Guitar &amp; Bass&gt;")).toBe(true);
        tester.expect(html.includes("<Guitar & Bass>")).toBe(false);
    });
});