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

    tester.it("renders manageable track names as desktop inline editors", () => {
        const html = renderMixChannelSlots([createTrack()]);

        tester.expect(html.includes("data-track-name-display")).toBe(true);
        tester.expect(html.includes("data-track-name-editor")).toBe(true);
        tester.expect(html.includes("data-track-edit-button")).toBe(false);
        tester.expect(html.includes('contenteditable="true"')).toBe(true);
        tester.expect(html.includes("✎")).toBe(false);
    });

    tester.it("omits timing UI without modifying stored musical placement", () => {
        const track = createTrack({ musicalPlacement: { start: { bar: 3, beat: 2.5 }, spanBeats: 8 } });
        const before = JSON.stringify(track);
        const html = renderMixChannelSlots(
            [track],
            undefined,
            {
                role: "owner",
                currentUserId: null,
                musicalTimeline: {
                    bpm: 120,
                    timeSignature: { numerator: 4, denominator: 4 },
                },
            },
        );

        for (const hook of ["data-track-timing", "data-track-musical", "Length (bars)", "Bar 3, beat"]) {
            tester.expect(html.includes(hook)).toBe(false);
        }
        tester.expect(JSON.stringify(track)).toBe(before);
        tester.expect(html.includes("data-track-name-editor")).toBe(true);
    });

    tester.it("renders enabled, volume, and delete controls without waveform placeholders", () => {
        const html = renderMixChannelSlots([createTrack()]);

        tester.expect(html.includes("data-channel-enabled")).toBe(true);
        tester.expect(html.includes("data-channel-volume")).toBe(true);
        tester.expect(html.includes("Waveform placeholder")).toBe(false);
        tester.expect(html.includes("mix-channel-slot__timeline-cell")).toBe(false);
        tester.expect(html.includes("data-track-delete-button")).toBe(true);
        tester.expect(html.includes("Delete")).toBe(true);
        tester.expect(html.includes("data-mix-channel-slot")).toBe(true);
        tester.expect(html.includes('data-mix-channel="1"')).toBe(true);
    });

    tester.it("describes the reactive mixer without rendering a Load Mix control", () => {
        const html = renderMixChannelSlots([]);

        tester.expect(html.includes("Load Mix")).toBe(false);
        tester.expect(html.includes('id="load-mix-button"')).toBe(false);
        tester.expect(html.includes("data-load-mix-button")).toBe(false);
        tester.expect(html.includes(">Timeline<")).toBe(false);
        tester.expect(html.includes("Toggle tracks and adjust volume.")).toBe(true);
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

    tester.it("restores saved enabled and volume settings for a track", () => {
        const html = renderMixChannelSlots(
            [createTrack()],
            {
                channels: [
                    {
                        channelNumber: 1,
                        trackId: "track-1",
                        enabled: false,
                        volume: 0.35,
                    },
                ],
            },
        );

        tester.expect(html.includes("data-channel-enabled")).toBe(true);
        tester.expect(html.includes("checked")).toBe(false);
        tester.expect(html.includes('value="0.35"')).toBe(true);
        tester.expect(html.includes("35%")).toBe(true);
    });

    tester.it("uses enabled and full volume when a track has no saved mix setting", () => {
        const html = renderMixChannelSlots([createTrack()], {
            channels: [],
        });

        tester.expect(html.includes("checked")).toBe(true);
        tester.expect(html.includes('value="1"')).toBe(true);
        tester.expect(html.includes("100%")).toBe(true);
    });

    tester.it("renders desktop track action affordances without phone-only hooks", () => {
        const assignedHtml = renderMixChannelSlots([createTrack()]);
        const emptyHtml = renderMixChannelSlots([]);

        tester.expect(assignedHtml.includes("data-track-delete-button")).toBe(true);
        tester.expect(assignedHtml.includes(">Delete</button>")).toBe(true);
        tester.expect(assignedHtml.includes("mix-channel-slot__delete-icon")).toBe(false);
        tester.expect(emptyHtml.includes("data-track-add-button")).toBe(true);
        tester.expect(emptyHtml.includes(">Add Track</button>")).toBe(true);
        tester.expect(emptyHtml.includes("mix-channel-slot__add-track-symbol")).toBe(false);
    });

    tester.it("keeps each channel's controls and Delete bound to its own track", () => {
        const tracks = Array.from({ length: 4 }, (_, index) =>
            createTrack({ id: `track-${index + 1}`, name: `Long track name ${index + 1}` }));
        for (const count of [1, 2, 3, 4]) {
            const html = renderMixChannelSlots(tracks.slice(0, count), {
                channels: tracks.map((track, index) => ({
                    channelNumber: index + 1, trackId: track.id,
                    enabled: index % 2 === 0, volume: index / 3,
                })),
            });
            const articles = html.match(/<article[\s\S]*?<\/article>/g) ?? [];
            tester.expect(articles.length).toBe(4);
            for (let index = 0; index < count; index++) {
                const article = articles[index];
                tester.expect(article.includes(`data-track-id="track-${index + 1}"`)).toBe(true);
                tester.expect(article.includes("data-track-name-editor")).toBe(true);
                tester.expect(article.includes(`aria-label="Delete track Long track name ${index + 1}"`)).toBe(true);
                tester.expect(article.indexOf("mix-channel-slot__actions") > article.indexOf("data-channel-volume")).toBe(true);
                tester.expect(article.includes(`${Math.round(index / 3 * 100)}%`)).toBe(true);
                tester.expect(article.includes("checked")).toBe(index % 2 === 0);
                tester.expect(article.includes('type="range"')).toBe(true);
                tester.expect(article.includes('min="0"')).toBe(true);
                tester.expect(article.includes('max="1"')).toBe(true);
                tester.expect(article.includes('step="0.01"')).toBe(true);
            }
        }
    });

    tester.it("renders a volume value target for each assigned channel", () => {
        const html = renderMixChannelSlots([createTrack()]);

        tester.expect(
            html.includes("data-channel-volume-value"),
        ).toBe(true);

        tester.expect(
            html.includes('data-mix-channel="1"'),
        ).toBe(true);

        tester.expect(
            html.includes("mix-channel-panel__load-button"),
        ).toBe(false);
    });
});
