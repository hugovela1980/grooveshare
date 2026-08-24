import {
    createHtmlAudioPlaybackEngine,
    type PlaybackEngine,
} from "@hugovela/frontend-core";
import {
    createAudioPlayerController,
    formatMusicalPosition,
    formatTimestamp,
} from "../src/page-controllers/audio-player-controller.js";
import { tester } from "./test-runner/tester.js";

type Listener = () => void | Promise<void>;

function createFakeAudioElement() {
    const listeners = new Map<string, Listener>();

    let currentTime = 0;
    let currentTimeSetCallCount = 0;

    return {
        src: "",

        get currentTime(): number {
            return currentTime;
        },

        set currentTime(value: number) {
            currentTime = value;
            currentTimeSetCallCount += 1;
        },

        get currentTimeSetCallCount(): number {
            return currentTimeSetCallCount;
        },

        duration: 120,
        paused: true,
        volume: 1,
        playCallCount: 0,
        pauseCallCount: 0,
        loadCallCount: 0,

        async play(): Promise<void> {
            this.playCallCount += 1;
            this.paused = false;
        },

        pause(): void {
            this.pauseCallCount += 1;
            this.paused = true;
        },

        load(): void {
            this.loadCallCount += 1;
        },

        addEventListener(eventName: string, handler: Listener): void {
            listeners.set(eventName, handler);
        },

        async trigger(eventName: string): Promise<void> {
            await listeners.get(eventName)?.();
        },
    };
}

function createFakeButton() {
    let clickHandler: Listener | null = null;

    return {
        disabled: true,
        textContent: null as string | null,

        addEventListener(eventName: "click", handler: Listener): void {
            if (eventName === "click") {
                clickHandler = handler;
            }
        },

        async click(): Promise<void> {
            await clickHandler?.();
        },
    };
}

function createFakeCheckbox() {
    let changeHandler: Listener | null = null;

    return {
        checked: false,
        addEventListener(eventName: "change", handler: Listener): void {
            if (eventName === "change") {
                changeHandler = handler;
            }
        },
        change(): void {
            void changeHandler?.();
        },
    };
}

function createFakeRangeInput() {
    let inputHandler: Listener | null = null;
    let changeHandler: Listener | null = null;

    return {
        disabled: true,
        value: "0",

        addEventListener(
            eventName: "input" | "change",
            handler: Listener,
        ): void {
            if (eventName === "input") {
                inputHandler = handler;
            }

            if (eventName === "change") {
                changeHandler = handler;
            }
        },

        input(): void {
            inputHandler?.();
        },

        change(): void {
            changeHandler?.();
        },
    };
}

function createFakeTextElement() {
    return {
        textContent: null as string | null,
    };
}

function createFakeNumberInput() {
    return {
        disabled: true,
        value: "1",
    };
}

type AudioPlayerControllerInput = Parameters<typeof createAudioPlayerController>[0];

function createControllerTestSetup(options: {
    createAudioElement?: () => ReturnType<typeof createFakeAudioElement>;
    musicalTimeline?: AudioPlayerControllerInput["musicalTimeline"];
    projectId?: string;
    debugLogger?: AudioPlayerControllerInput["debugLogger"];
} = {}) {
    const audioElement = createFakeAudioElement();
    const seekBackwardButton = createFakeButton();
    const playPauseButton = createFakeButton();
    const stopButton = createFakeButton();
    const loopCheckbox = createFakeCheckbox();
    const progressInput = createFakeRangeInput();
    const timestampElement = createFakeTextElement();
    const durationElement = createFakeTextElement();
    const musicalPositionElement = createFakeTextElement();
    const seekBarInput = createFakeNumberInput();
    const seekBarButton = createFakeButton();
    const trackNameElement = createFakeTextElement();

    const playbackEngine = createHtmlAudioPlaybackEngine({
        primaryAudioElement: audioElement,
        createAudioElement:
            options.createAudioElement ?? (() => createFakeAudioElement()),
        ...(options.musicalTimeline
            ? { musicalTimeline: options.musicalTimeline }
            : {}),
    });

    const controller = createAudioPlayerController({
        playbackEngine,
        ...(options.musicalTimeline
            ? { musicalTimeline: options.musicalTimeline }
            : {}),
        ...(options.projectId ? { projectId: options.projectId } : {}),
        ...(options.debugLogger ? { debugLogger: options.debugLogger } : {}),
        seekBackwardButton,
        playPauseButton,
        stopButton,
        progressInput,
        timestampElement,
        durationElement,
        musicalPositionElement,
        seekBarInput,
        seekBarButton,
        trackNameElement,
        loopCheckbox,
    });

    return {
        audioElement,
        seekBackwardButton,
        playPauseButton,
        stopButton,
        progressInput,
        timestampElement,
        durationElement,
        musicalPositionElement,
        seekBarInput,
        seekBarButton,
        trackNameElement,
        loopCheckbox,
        controller,
    };
}

tester.describe("audio player controller", () => {
    tester.it("formats timestamps as minutes and seconds", () => {
        tester.expect(formatTimestamp(0)).toBe("00:00");
        tester.expect(formatTimestamp(5)).toBe("00:05");
        tester.expect(formatTimestamp(65)).toBe("01:05");
        tester.expect(formatTimestamp(600)).toBe("10:00");
        tester.expect(formatMusicalPosition({ bar: 3, beat: 2.5 })).toBe(
            "Bar 3 · Beat 2.5",
        );
    });

    tester.it("disables controls before a track is loaded", () => {
        const {
            controller,
            seekBackwardButton,
            playPauseButton,
            stopButton,
            progressInput,
        } = createControllerTestSetup();

        controller.init();

        tester.expect(seekBackwardButton.disabled).toBe(true);
        tester.expect(playPauseButton.disabled).toBe(true);
        tester.expect(stopButton.disabled).toBe(true);
        tester.expect(progressInput.disabled).toBe(true);
        tester.expect(playPauseButton.textContent).toBe("▶");
    });

    tester.it("loads a one-channel mix and enables the controls", () => {
        const {
            controller,
            audioElement,
            seekBackwardButton,
            playPauseButton,
            stopButton,
            progressInput,
            timestampElement,
            durationElement,
            trackNameElement,
        } = createControllerTestSetup();

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Guitar Take",
                audioUrl: "http://localhost:3000/audio/guitar.wav",
                volume: 1,
            },
        ]);

        tester.expect(audioElement.src).toBe("http://localhost:3000/audio/guitar.wav");
        tester.expect(audioElement.currentTime).toBe(0);
        tester.expect(audioElement.loadCallCount).toBe(1);
        tester.expect(seekBackwardButton.disabled).toBe(false);
        tester.expect(playPauseButton.disabled).toBe(false);
        tester.expect(stopButton.disabled).toBe(false);
        tester.expect(progressInput.disabled).toBe(false);
        tester.expect(progressInput.value).toBe("0");
        tester.expect(timestampElement.textContent).toBe("00:00");
        tester.expect(durationElement.textContent).toBe("00:00");
        tester.expect(trackNameElement.textContent).toBe("Guitar Take");
        tester.expect(playPauseButton.textContent).toBe("▶");
    });

    tester.it("preserves the go-to-bar value when the mix reloads after recording changes", () => {
        const { controller, seekBarInput } = createControllerTestSetup();

        controller.init();
        seekBarInput.value = "12";
        controller.loadMix([{
            channelNumber: 1,
            trackId: "track-1",
            name: "Guitar Take",
            audioUrl: "/guitar.wav",
            volume: 1,
        }]);

        tester.expect(seekBarInput.value).toBe("12");

        controller.loadMix([{
            channelNumber: 1,
            trackId: "track-1",
            name: "Guitar Take",
            audioUrl: "/guitar.wav",
            volume: 1,
        }, {
            channelNumber: 2,
            trackId: "recorded-track",
            name: "Recorded Take",
            audioUrl: "/recorded.webm",
            volume: 1,
        }]);

        tester.expect(seekBarInput.value).toBe("12");
    });

    tester.it("shows the shared musical position and jumps to a requested bar", async () => {
        const {
            controller,
            audioElement,
            musicalPositionElement,
            seekBarInput,
            seekBarButton,
        } = createControllerTestSetup({
            musicalTimeline: {
                bpm: 120,
                timeSignature: { numerator: 6, denominator: 8 },
            },
        });

        controller.init();
        controller.loadMix([{
            channelNumber: 1,
            trackId: "track-1",
            name: "Guitar Take",
            audioUrl: "/guitar.wav",
            volume: 1,
        }]);

        tester.expect(musicalPositionElement.textContent).toBe(
            "Bar 1 · Beat 1",
        );

        audioElement.currentTime = 0.625;
        await audioElement.trigger("timeupdate");
        tester.expect(musicalPositionElement.textContent).toBe(
            "Bar 1 · Beat 3.5",
        );

        seekBarInput.value = "3";
        await seekBarButton.click();

        tester.expect(audioElement.currentTime).toBe(3);
        tester.expect(musicalPositionElement.textContent).toBe(
            "Bar 3 · Beat 1",
        );
    });

    tester.it("plays and pauses the loaded audio track", async () => {
        const { controller, audioElement, playPauseButton } =
            createControllerTestSetup();

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Guitar Take",
                audioUrl: "http://localhost:3000/audio/guitar.wav",
                volume: 1,
            },
        ]);

        await playPauseButton.click();

        tester.expect(audioElement.playCallCount).toBe(1);
        tester.expect(audioElement.paused).toBe(false);
        tester.expect(playPauseButton.textContent).toBe("❚❚");

        await playPauseButton.click();

        tester.expect(audioElement.pauseCallCount).toBe(1);
        tester.expect(audioElement.paused).toBe(true);
        tester.expect(playPauseButton.textContent).toBe("▶");
    });

    tester.it("logs the project musical timeline when playback begins", async () => {
        let loggedMessage = "";
        let loggedDetails: unknown = null;
        const { controller, playPauseButton } = createControllerTestSetup({
            musicalTimeline: {
                bpm: 96,
                timeSignature: { numerator: 3, denominator: 4 },
            },
            projectId: "project-1",
            debugLogger(message, details) {
                loggedMessage = message;
                loggedDetails = details;
            },
        });

        controller.init();
        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Guitar Take",
                audioUrl: "http://localhost:3000/audio/guitar.wav",
                volume: 1,
            },
        ]);

        await playPauseButton.click();

        tester.expect(loggedMessage).toBe(
            "[GrooveShare] Playback musical timeline",
        );
        tester.expect(loggedDetails).toEqual({
            projectId: "project-1",
            bpm: 96,
            timeSignature: "3/4",
            transportSeconds: 0,
            musicalPosition: { bar: 1, beat: 1 },
        });
    });

    tester.it("resumes a paused track without seeking again", async () => {
        const { controller, audioElement, playPauseButton } =
            createControllerTestSetup();

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Guitar Take",
                audioUrl: "http://localhost:3000/audio/guitar.wav",
                volume: 1,
            },
        ]);

        await playPauseButton.click();

        audioElement.currentTime = 37;

        await playPauseButton.click();

        tester.expect(audioElement.paused).toBe(true);
        tester.expect(audioElement.currentTime).toBe(37);

        const currentTimeSetCallCountBeforeResume =
            audioElement.currentTimeSetCallCount;

        await playPauseButton.click();

        tester.expect(audioElement.playCallCount).toBe(2);
        tester.expect(audioElement.paused).toBe(false);
        tester.expect(audioElement.currentTime).toBe(37);
        tester.expect(audioElement.currentTimeSetCallCount).toBe(currentTimeSetCallCountBeforeResume);
        tester.expect(playPauseButton.textContent).toBe("❚❚");
    });

    tester.it("stops the loaded audio track", async () => {
        const { controller, audioElement, stopButton, playPauseButton } =
            createControllerTestSetup();

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Guitar Take",
                audioUrl: "http://localhost:3000/audio/guitar.wav",
                volume: 1,
            },
        ]);
        audioElement.currentTime = 45;
        audioElement.paused = false;

        await stopButton.click();

        tester.expect(audioElement.pauseCallCount).toBe(1);
        tester.expect(audioElement.currentTime).toBe(0);
        tester.expect(audioElement.paused).toBe(true);
        tester.expect(playPauseButton.textContent).toBe("▶");
    });

    tester.it("updates progress and timestamp as audio plays", async () => {
        const {
            controller,
            audioElement,
            progressInput,
            timestampElement,
            durationElement,
        } = createControllerTestSetup();

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Guitar Take",
                audioUrl: "http://localhost:3000/audio/guitar.wav",
                volume: 1,
            },
        ]);
        audioElement.duration = 120;
        audioElement.currentTime = 30;

        await audioElement.trigger("timeupdate");

        tester.expect(progressInput.value).toBe("25");
        tester.expect(timestampElement.textContent).toBe("00:30");
        tester.expect(durationElement.textContent).toBe("02:00");
    });

    tester.it("seeks when the progress input changes", () => {
        const {
            controller,
            audioElement,
            progressInput,
            timestampElement,
            durationElement,
        } = createControllerTestSetup();

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Guitar Take",
                audioUrl: "http://localhost:3000/audio/guitar.wav",
                volume: 1,
            },
        ]);
        audioElement.duration = 200;
        progressInput.value = "50";

        progressInput.input();
        progressInput.change();

        tester.expect(audioElement.currentTime).toBe(100);
        tester.expect(timestampElement.textContent).toBe("01:40");
        tester.expect(durationElement.textContent).toBe("03:20");
    });

    tester.it("seeks backward five seconds without interrupting playback", async () => {
        const secondAudioElement = createFakeAudioElement();
        const {
            controller,
            audioElement,
            seekBackwardButton,
            playPauseButton,
        } = createControllerTestSetup({
            createAudioElement: () => secondAudioElement,
        });

        controller.init();
        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Drums",
                audioUrl: "http://localhost:3000/audio/drums.wav",
                volume: 1,
            },
            {
                channelNumber: 2,
                trackId: "track-2",
                name: "Bass",
                audioUrl: "http://localhost:3000/audio/bass.wav",
                volume: 1,
            },
        ]);

        await playPauseButton.click();
        audioElement.currentTime = 42;
        secondAudioElement.currentTime = 42;

        await seekBackwardButton.click();

        tester.expect(audioElement.currentTime).toBe(37);
        tester.expect(secondAudioElement.currentTime).toBe(37);
        tester.expect(audioElement.paused).toBe(false);
        tester.expect(secondAudioElement.paused).toBe(false);
    });

    tester.it("clamps five-second back seek at the beginning", async () => {
        const { controller, audioElement, seekBackwardButton } =
            createControllerTestSetup();

        controller.init();
        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Guitar",
                audioUrl: "http://localhost:3000/audio/guitar.wav",
                volume: 1,
            },
        ]);

        audioElement.currentTime = 3;
        await seekBackwardButton.click();

        tester.expect(audioElement.currentTime).toBe(0);
    });

    tester.it("seeks all loaded tracks to the same position", () => {
        const secondAudioElement =
            createFakeAudioElement();

        const {
            controller,
            audioElement,
            progressInput,
        } = createControllerTestSetup({
            createAudioElement: () =>
                secondAudioElement,
        });

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Drums",
                audioUrl:
                    "http://localhost:3000/audio/drums.wav",
                volume: 1,
            },
            {
                channelNumber: 2,
                trackId: "track-2",
                name: "Bass",
                audioUrl:
                    "http://localhost:3000/audio/bass.wav",
                volume: 1,
            },
        ]);

        audioElement.duration = 200;
        secondAudioElement.duration = 200;

        progressInput.value = "50";

        progressInput.input();
        progressInput.change();

        tester.expect(
            audioElement.currentTime,
        ).toBe(100);

        tester.expect(
            secondAudioElement.currentTime,
        ).toBe(100);
    });

    tester.it("loads a two-track mix and plays both tracks together", async () => {
        const secondAudioElement = createFakeAudioElement();

        const {
            controller,
            audioElement,
            playPauseButton,
            trackNameElement,
        } = createControllerTestSetup({
            createAudioElement: () => secondAudioElement,
        });


        controller.init();

        controller.loadMix(
            [
                {
                    channelNumber: 1,
                    trackId: "track-1",
                    name: "Drums",
                    audioUrl: "http://localhost:3000/audio/drums.wav",
                    volume: 0.75,
                },
                {
                    channelNumber: 2,
                    trackId: "track-2",
                    name: "Bass",
                    audioUrl: "http://localhost:3000/audio/bass.wav",
                    volume: 0.5,
                },
            ],
        );

        tester.expect(audioElement.src).toBe("http://localhost:3000/audio/drums.wav");
        tester.expect(audioElement.volume).toBe(0.75);
        tester.expect(secondAudioElement.src).toBe("http://localhost:3000/audio/bass.wav");
        tester.expect(secondAudioElement.volume).toBe(0.5);
        tester.expect(trackNameElement.textContent).toBe("Mix loaded: Drums, Bass");

        await playPauseButton.click();

        tester.expect(audioElement.playCallCount).toBe(1);
        tester.expect(secondAudioElement.playCallCount).toBe(1);
        tester.expect(playPauseButton.textContent).toBe("❚❚");
    });

    tester.it("updates one loaded channel volume without reloading or resetting playback", () => {
        const secondAudioElement = createFakeAudioElement();

        const {
            controller,
            audioElement,
        } = createControllerTestSetup({
            createAudioElement: () => secondAudioElement,
        });

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Drums",
                audioUrl: "http://localhost:3000/audio/drums.wav",
                volume: 0.75,
            },
            {
                channelNumber: 2,
                trackId: "track-2",
                name: "Bass",
                audioUrl: "http://localhost:3000/audio/bass.wav",
                volume: 0.5,
            },
        ]);

        audioElement.currentTime = 42;
        secondAudioElement.currentTime = 42;

        const firstLoadCallCount = audioElement.loadCallCount;
        const secondLoadCallCount = secondAudioElement.loadCallCount;

        const wasUpdated = controller.setChannelVolume(2, 0.3);

        tester.expect(wasUpdated).toBe(true);
        tester.expect(audioElement.volume).toBe(0.75);
        tester.expect(secondAudioElement.volume).toBe(0.3);
        tester.expect(audioElement.currentTime).toBe(42);
        tester.expect(secondAudioElement.currentTime).toBe(42);
        tester.expect(audioElement.loadCallCount).toBe(firstLoadCallCount);
        tester.expect(secondAudioElement.loadCallCount).toBe(secondLoadCallCount);
        tester.expect(controller.setChannelVolume(3, 0.9)).toBe(false);
    });

    tester.it("keeps a disabled prepared channel advancing while muting and restoring it live", async () => {
        const secondAudioElement = createFakeAudioElement();

        const {
            controller,
            audioElement,
            playPauseButton,
        } = createControllerTestSetup({
            createAudioElement: () => secondAudioElement,
        });

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Drums",
                audioUrl: "http://localhost:3000/audio/drums.wav",
                volume: 0.75,
                enabled: true,
            },
            {
                channelNumber: 2,
                trackId: "track-2",
                name: "Bass",
                audioUrl: "http://localhost:3000/audio/bass.wav",
                volume: 0.5,
                enabled: false,
            },
        ]);

        tester.expect(audioElement.volume).toBe(0.75);
        tester.expect(secondAudioElement.volume).toBe(0);

        await playPauseButton.click();

        tester.expect(audioElement.playCallCount).toBe(1);
        tester.expect(secondAudioElement.playCallCount).toBe(1);

        audioElement.currentTime = 57;
        secondAudioElement.currentTime = 57;

        const firstLoadCallCount = audioElement.loadCallCount;
        const secondLoadCallCount = secondAudioElement.loadCallCount;

        tester.expect(controller.setChannelEnabled(2, true)).toBe(true);
        tester.expect(secondAudioElement.volume).toBe(0.5);
        tester.expect(secondAudioElement.currentTime).toBe(57);

        tester.expect(controller.setChannelEnabled(1, false)).toBe(true);
        tester.expect(audioElement.volume).toBe(0);
        tester.expect(audioElement.currentTime).toBe(57);

        tester.expect(audioElement.loadCallCount).toBe(firstLoadCallCount);
        tester.expect(secondAudioElement.loadCallCount).toBe(secondLoadCallCount);
        tester.expect(controller.setChannelEnabled(3, true)).toBe(false);
    });

    tester.it("remembers volume changes while a channel is disabled", () => {
        const { controller, audioElement } = createControllerTestSetup();

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Guitar",
                audioUrl: "http://localhost:3000/audio/guitar.wav",
                volume: 0.8,
                enabled: false,
            },
        ]);

        tester.expect(audioElement.volume).toBe(0);

        tester.expect(controller.setChannelVolume(1, 0.35)).toBe(true);
        tester.expect(audioElement.volume).toBe(0);

        tester.expect(controller.setChannelEnabled(1, true)).toBe(true);
        tester.expect(audioElement.volume).toBe(0.35);
    });

    tester.it("keeps transport available for a prepared mix when all channels are disabled", () => {
        const {
            controller,
            audioElement,
            playPauseButton,
            stopButton,
            progressInput,
            trackNameElement,
        } = createControllerTestSetup();

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Guitar",
                audioUrl: "http://localhost:3000/audio/guitar.wav",
                volume: 0.8,
                enabled: false,
            },
        ]);

        tester.expect(audioElement.volume).toBe(0);
        tester.expect(playPauseButton.disabled).toBe(false);
        tester.expect(stopButton.disabled).toBe(false);
        tester.expect(progressInput.disabled).toBe(false);
        tester.expect(trackNameElement.textContent).toBe("All channels disabled.");

        tester.expect(controller.setChannelEnabled(1, true)).toBe(true);
        tester.expect(trackNameElement.textContent).toBe("Guitar");
    });

    tester.it("clears the prepared player when the current project has no assigned tracks", () => {
        const {
            controller,
            playPauseButton,
            stopButton,
            progressInput,
            trackNameElement,
        } = createControllerTestSetup();

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Guitar",
                audioUrl: "http://localhost:3000/audio/guitar.wav",
                volume: 1,
                enabled: true,
            },
        ]);

        controller.loadMix([]);

        tester.expect(playPauseButton.disabled).toBe(true);
        tester.expect(stopButton.disabled).toBe(true);
        tester.expect(progressInput.disabled).toBe(true);
        tester.expect(trackNameElement.textContent).toBe("No track loaded.");
    });

    tester.it("updates a prepared track name without reloading playback", () => {
        const {
            controller,
            audioElement,
            trackNameElement,
        } = createControllerTestSetup();

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Guitar",
                audioUrl: "http://localhost:3000/audio/guitar.wav",
                volume: 1,
                enabled: true,
            },
        ]);

        const loadCallCount = audioElement.loadCallCount;

        tester.expect(controller.setTrackName("track-1", "Lead Guitar")).toBe(true);
        tester.expect(trackNameElement.textContent).toBe("Lead Guitar");
        tester.expect(audioElement.loadCallCount).toBe(loadCallCount);
        tester.expect(controller.setTrackName("missing-track", "Other")).toBe(false);
    });

    tester.it("stops all tracks in a loaded mix", async () => {
        const secondAudioElement = createFakeAudioElement();

        const {
            controller,
            audioElement,
            stopButton,
        } = createControllerTestSetup({
            createAudioElement: () => secondAudioElement,
        });

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Drums",
                audioUrl: "http://localhost:3000/audio/drums.wav",
                volume: 1,
            },
            {
                channelNumber: 2,
                trackId: "track-2",
                name: "Bass",
                audioUrl: "http://localhost:3000/audio/bass.wav",
                volume: 0.5,
            },
        ]);

        audioElement.currentTime = 30;
        secondAudioElement.currentTime = 30;
        audioElement.paused = false;
        secondAudioElement.paused = false;

        await stopButton.click();

        tester.expect(audioElement.pauseCallCount > 0).toBe(true);
        tester.expect(secondAudioElement.pauseCallCount > 0).toBe(true);
        tester.expect(audioElement.currentTime).toBe(0);
        tester.expect(secondAudioElement.currentTime).toBe(0);
    });

    tester.it("loops the loaded mix when loop is enabled", async () => {
        const secondAudioElement = createFakeAudioElement();

        const {
            controller,
            audioElement,
            playPauseButton,
            loopCheckbox,
        } = createControllerTestSetup({
            createAudioElement: () => secondAudioElement,
        });

        controller.init();

        controller.loadMix([
            {
                channelNumber: 1,
                trackId: "track-1",
                name: "Drums",
                audioUrl: "http://localhost:3000/audio/drums.wav",
                volume: 1,
            },
            {
                channelNumber: 2,
                trackId: "track-2",
                name: "Bass",
                audioUrl: "http://localhost:3000/audio/bass.wav",
                volume: 0.5,
            },
        ]);

        await playPauseButton.click();

        audioElement.currentTime = 120;
        secondAudioElement.currentTime = 120;
        loopCheckbox.checked = true;
        loopCheckbox.change();

        await audioElement.trigger("ended");

        tester.expect(audioElement.currentTime).toBe(0);
        tester.expect(secondAudioElement.currentTime).toBe(0);
        tester.expect(audioElement.playCallCount).toBe(2);
        tester.expect(secondAudioElement.playCallCount).toBe(2);
        tester.expect(playPauseButton.textContent).toBe("❚❚");
    });
});

tester.describe("audio player controller playback boundary", () => {
    tester.it("drives an injected PlaybackEngine without knowing HTML audio details", async () => {
        const calls: string[] = [];
        let loadedTimelineOffsetSeconds: number | undefined;
        let listener: ((snapshot: ReturnType<PlaybackEngine["getSnapshot"]>) => void) | null = null;
        let snapshot = {
            currentTime: 0,
            musicalPosition: { bar: 1, beat: 1 },
            duration: 120,
            isPlaying: false,
            hasLoadedChannels: false,
        };

        const playbackEngine: PlaybackEngine = {
            loadMix(channels) {
                calls.push(`load:${channels.length}`);
                loadedTimelineOffsetSeconds = channels[0]?.timelineOffsetSeconds;
                snapshot = { ...snapshot, hasLoadedChannels: channels.length > 0 };
                listener?.(snapshot);
            },
            async play() {
                calls.push("play");
                snapshot = { ...snapshot, isPlaying: true };
                listener?.(snapshot);
            },
            pause() {
                calls.push("pause");
                snapshot = { ...snapshot, isPlaying: false };
                listener?.(snapshot);
            },
            stop() {
                calls.push("stop");
                snapshot = { ...snapshot, currentTime: 0, isPlaying: false };
                listener?.(snapshot);
            },
            seek(seconds) {
                calls.push(`seek:${seconds}`);
                snapshot = { ...snapshot, currentTime: seconds };
                listener?.(snapshot);
            },
            seekBy(seconds) {
                calls.push(`seekBy:${seconds}`);
            },
            seekToMusicalPosition(position) {
                calls.push(`seekMusical:${position.bar}:${position.beat}`);
                snapshot = { ...snapshot, musicalPosition: { ...position } };
                listener?.(snapshot);
            },
            setLoopEnabled(enabled) {
                calls.push(`loop:${enabled}`);
            },
            setChannelVolume(channelNumber, volume) {
                calls.push(`volume:${channelNumber}:${volume}`);
                return true;
            },
            setChannelEnabled(channelNumber, enabled) {
                calls.push(`enabled:${channelNumber}:${enabled}`);
                return true;
            },
            getSnapshot() {
                return snapshot;
            },
            subscribe(nextListener) {
                listener = nextListener;
                nextListener(snapshot);
                return () => {
                    listener = null;
                };
            },
        };

        const seekBackwardButton = createFakeButton();
        const playPauseButton = createFakeButton();
        const stopButton = createFakeButton();
        const progressInput = createFakeRangeInput();
        const timestampElement = createFakeTextElement();
        const durationElement = createFakeTextElement();
        const musicalPositionElement = createFakeTextElement();
        const seekBarInput = createFakeNumberInput();
        const seekBarButton = createFakeButton();
        const trackNameElement = createFakeTextElement();
        const loopCheckbox = createFakeCheckbox();

        const controller = createAudioPlayerController({
            playbackEngine,
            seekBackwardButton,
            playPauseButton,
            stopButton,
            progressInput,
            timestampElement,
            durationElement,
            musicalPositionElement,
            seekBarInput,
            seekBarButton,
            trackNameElement,
            loopCheckbox,
        });

        controller.init();
        controller.loadMix([{
            channelNumber: 1,
            trackId: "track-1",
            name: "Guitar",
            audioUrl: "/audio/guitar.wav",
            volume: 0.8,
            enabled: true,
            timelineOffsetSeconds: 3.5,
        }]);

        await playPauseButton.click();
        await seekBackwardButton.click();
        controller.setChannelVolume(1, 0.4);
        controller.setChannelEnabled(1, false);
        await stopButton.click();

        tester.expect(loadedTimelineOffsetSeconds).toBe(3.5);
        tester.expect(calls).toEqual([
            "loop:false",
            "load:1",
            "play",
            "seekBy:-5",
            "volume:1:0.4",
            "enabled:1:false",
            "stop",
        ]);
    });
});
