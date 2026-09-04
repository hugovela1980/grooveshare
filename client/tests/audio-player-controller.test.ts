import {
    createHtmlAudioPlaybackEngine,
    createRecordingWorkspaceState,
    type PlaybackEngine,
    type RecordingWorkspaceState,
    type StorageProvider,
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
            void listeners.get("canplay")?.();
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
    type Handler = (event: { key: string; preventDefault(): void }) => void;
    const handlers = new Map<string, Handler>();
    return {
        disabled: true,
        value: "1",
        selectCalls: 0,
        select() { this.selectCalls += 1; },
        addEventListener(name: "keydown" | "focus" | "click", handler: Handler) { handlers.set(name, handler); },
        enter() { handlers.get("keydown")?.({ key: "Enter", preventDefault() {} }); },
        focus() { handlers.get("focus")?.({ key: "", preventDefault() {} }); },
        click() { handlers.get("click")?.({ key: "", preventDefault() {} }); },
    };
}

type AudioPlayerControllerInput = Parameters<typeof createAudioPlayerController>[0];

function createControllerTestSetup(options: {
    createAudioElement?: () => ReturnType<typeof createFakeAudioElement>;
    musicalTimeline?: AudioPlayerControllerInput["musicalTimeline"];
    projectId?: string;
    debugLogger?: AudioPlayerControllerInput["debugLogger"];
    recordingWorkspaceState?: RecordingWorkspaceState;
} = {}) {
    const audioElement = createFakeAudioElement();
    const seekBackwardButton = createFakeButton();
    const seekForwardButton = createFakeButton();
    const playPauseButton = createFakeButton();
    const stopButton = createFakeButton();
    const loopCheckbox = createFakeCheckbox();
    const metronomeCheckbox = createFakeCheckbox();
    const progressInput = createFakeRangeInput();
    const timestampElement = createFakeTextElement();
    const durationElement = createFakeTextElement();
    const musicalPositionElement = createFakeTextElement();
    const seekBarInput = createFakeNumberInput();
    const seekBeatInput = createFakeNumberInput();
    const seekStatusElement = createFakeTextElement();
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
        seekForwardButton,
        playPauseButton,
        stopButton,
        progressInput,
        timestampElement,
        durationElement,
        musicalPositionElement,
        seekBarInput,
        seekBeatInput,
        seekStatusElement,
        seekBarButton,
        trackNameElement,
        loopCheckbox,
        metronomeCheckbox,
        ...(options.recordingWorkspaceState
            ? { recordingWorkspaceState: options.recordingWorkspaceState }
            : {}),
    });

    return {
        audioElement,
        seekBackwardButton,
        seekForwardButton,
        playPauseButton,
        stopButton,
        progressInput,
        timestampElement,
        durationElement,
        musicalPositionElement,
        seekBarInput,
        seekBeatInput,
        seekStatusElement,
        seekBarButton,
        trackNameElement,
        loopCheckbox,
        metronomeCheckbox,
        controller,
    };
}

function createMemoryStorage(): StorageProvider {
    const values = new Map<string, string>();
    return {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, value); },
        removeItem(key) { values.delete(key); },
    };
}

tester.describe("audio player controller", () => {
    tester.it("selects the entire Go destination on focus and every click", () => {
        const h = createControllerTestSetup();
        h.controller.init();
        for (const input of [h.seekBarInput, h.seekBeatInput]) {
            input.value = "12";
            input.focus();
            input.click();
            input.click();
            tester.expect(input.selectCalls).toBe(3);
            tester.expect(input.value).toBe("12");
        }
    });
    tester.it("formats timestamps as minutes and seconds", () => {
        tester.expect(formatTimestamp(0)).toBe("00:00");
        tester.expect(formatTimestamp(5)).toBe("00:05");
        tester.expect(formatTimestamp(65)).toBe("01:05");
        tester.expect(formatTimestamp(600)).toBe("10:00");
        tester.expect(formatMusicalPosition({ bar: 3, beat: 2.5 })).toBe(
            "Bar 3 · Beat 2",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/guitar.wav",
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
            playbackDerivativeUrl: "/guitar.wav",
            volume: 1,
        }]);

        tester.expect(seekBarInput.value).toBe("12");

        controller.loadMix([{
            channelNumber: 1,
            trackId: "track-1",
            name: "Guitar Take",
            playbackDerivativeUrl: "/guitar.wav",
            volume: 1,
        }, {
            channelNumber: 2,
            trackId: "recorded-track",
            name: "Recorded Take",
            playbackDerivativeUrl: "/recorded.webm",
            volume: 1,
        }]);

        tester.expect(seekBarInput.value).toBe("12");
    });

    tester.it("keeps the Go anchor through mix reload and browser recreation until explicit Stop", async () => {
        const storage = createMemoryStorage();
        const workspace = createRecordingWorkspaceState({
            projectId: "project-1",
            storageProvider: storage,
        });
        const first = createControllerTestSetup({
            musicalTimeline: {
                bpm: 120,
                timeSignature: { numerator: 4, denominator: 4 },
            },
            recordingWorkspaceState: workspace,
        });
        first.controller.init();
        first.controller.loadMix([{
            channelNumber: 1,
            trackId: "track-1",
            name: "Guitar",
            playbackDerivativeUrl: "/guitar.wav",
            volume: 1,
        }]);

        first.seekBarInput.value = "12";
        await first.seekBarButton.click();
        tester.expect(first.audioElement.currentTime).toBe(22);
        tester.expect(workspace.getAnchor()).toEqual({ bar: 12, beat: 1 });

        first.controller.loadMix([{
            channelNumber: 1,
            trackId: "track-1",
            name: "Guitar",
            playbackDerivativeUrl: "/guitar.wav",
            volume: 1,
        }, {
            channelNumber: 2,
            trackId: "kept-take",
            name: "Kept Take",
            playbackDerivativeUrl: "/kept.webm",
            volume: 1,
        }]);
        tester.expect(first.audioElement.currentTime).toBe(22);

        first.controller.stop({ resetWorkspaceAnchor: false });
        tester.expect(workspace.getAnchor()).toEqual({ bar: 12, beat: 1 });

        const restoredWorkspace = createRecordingWorkspaceState({
            projectId: "project-1",
            storageProvider: storage,
        });
        const second = createControllerTestSetup({
            musicalTimeline: {
                bpm: 120,
                timeSignature: { numerator: 4, denominator: 4 },
            },
            recordingWorkspaceState: restoredWorkspace,
        });
        second.controller.init();
        second.controller.loadMix([{
            channelNumber: 1,
            trackId: "track-1",
            name: "Guitar",
            playbackDerivativeUrl: "/guitar.wav",
            volume: 1,
        }]);
        tester.expect(second.seekBarInput.value).toBe("1");
        tester.expect(second.audioElement.currentTime).toBe(22);

        await second.stopButton.click();
        tester.expect(second.audioElement.currentTime).toBe(0);
        tester.expect(restoredWorkspace.getAnchor()).toBe(null);
        tester.expect(second.seekBarInput.value).toBe("1");
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
            playbackDerivativeUrl: "/guitar.wav",
            volume: 1,
        }]);

        tester.expect(musicalPositionElement.textContent).toBe(
            "Bar 1 · Beat 1",
        );

        audioElement.currentTime = 0.625;
        await audioElement.trigger("timeupdate");
        tester.expect(musicalPositionElement.textContent).toBe(
            "Bar 1 · Beat 3",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/guitar.wav",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/guitar.wav",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/guitar.wav",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/guitar.wav",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/guitar.wav",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/guitar.wav",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/drums.wav",
                volume: 1,
            },
            {
                channelNumber: 2,
                trackId: "track-2",
                name: "Bass",
                playbackDerivativeUrl: "http://localhost:3000/audio/bass.wav",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/guitar.wav",
                volume: 1,
            },
        ]);

        audioElement.currentTime = 3;
        await seekBackwardButton.click();

        tester.expect(audioElement.currentTime).toBe(0);
    });

    tester.it("keeps the local Bar/Beat destination separate from playback and validates Go", async () => {
        const h = createControllerTestSetup({ musicalTimeline: { bpm: 120, timeSignature: { numerator: 6, denominator: 8 } } });
        h.controller.init();
        h.controller.loadMix([{ channelNumber: 1, trackId: "t", name: "Take", playbackDerivativeUrl: "/take.wav", volume: 1 }]);
        h.seekBarInput.value = "3";
        h.seekBeatInput.value = "4";
        h.seekBeatInput.enter();
        tester.expect(h.audioElement.currentTime).toBe(3.75);
        await h.playPauseButton.click();
        await h.seekForwardButton.click();
        await h.seekBackwardButton.click();
        h.progressInput.value = "50";
        h.progressInput.input();
        h.progressInput.change();
        await h.stopButton.click();
        tester.expect(h.seekBarInput.value).toBe("3");
        tester.expect(h.seekBeatInput.value).toBe("4");
        tester.expect(h.musicalPositionElement.textContent).toBe("Bar 1 · Beat 1");
        await h.playPauseButton.click();
        h.seekBarInput.enter();
        tester.expect(h.audioElement.currentTime).toBe(3.75);
        tester.expect(h.audioElement.paused).toBe(false);
        for (const [bar, beat] of [["0", "1"], ["1", "7"], ["1", "0"], ["", "1"], ["2.5", "1"], ["1", "1.5"], ["9999", "1"], ["abc", "1"]]) {
            h.seekBarInput.value = bar;
            h.seekBeatInput.value = beat;
            await h.seekBarButton.click();
            tester.expect(h.audioElement.currentTime).toBe(3.75);
            tester.expect(Boolean(h.seekStatusElement.textContent)).toBe(true);
        }
        h.seekBarInput.value = "1";
        h.seekBeatInput.value = "1";
        await h.seekBarButton.click();
        tester.expect(h.audioElement.currentTime).toBe(0);
        tester.expect(h.seekStatusElement.textContent).toBe("");
    });

    tester.it("previews fractional musical seeks without moving playback and resumes snapshot feedback", async () => {
        const { controller, audioElement, progressInput, musicalPositionElement, timestampElement } = createControllerTestSetup({
            musicalTimeline: { bpm: 120, timeSignature: { numerator: 6, denominator: 8 } },
        });
        controller.init();
        controller.loadMix([{ channelNumber: 1, trackId: "track-1", name: "Guitar", playbackDerivativeUrl: "/audio/guitar.wav", volume: 1 }]);
        audioElement.duration = 10;
        progressInput.value = "21.3";
        progressInput.input();
        tester.expect(audioElement.currentTime).toBe(0);
        tester.expect(musicalPositionElement.textContent).toBe("Bar 2 · Beat 3");
        audioElement.currentTime = 1;
        await audioElement.trigger("timeupdate");
        tester.expect(musicalPositionElement.textContent).toBe("Bar 2 · Beat 3");
        progressInput.change();
        tester.expect(audioElement.currentTime).toBe(2.13);
        audioElement.currentTime = 3;
        await audioElement.trigger("timeupdate");
        tester.expect(musicalPositionElement.textContent).toBe("Bar 3 · Beat 1");
        tester.expect(timestampElement.textContent).toBe("00:03");
        for (const [value, expected] of [["0", 0], ["100", 10]] as const) {
            progressInput.value = value;
            progressInput.input();
            progressInput.change();
            tester.expect(audioElement.currentTime).toBe(expected);
        }
    });

    tester.it("seeks forward five seconds", async () => {
        const { controller, audioElement, seekForwardButton } =
            createControllerTestSetup();

        controller.init();
        controller.loadMix([{
            channelNumber: 1,
            trackId: "track-1",
            name: "Guitar",
            playbackDerivativeUrl: "http://localhost:3000/audio/guitar.wav",
            volume: 1,
        }]);

        audioElement.currentTime = 3;
        await seekForwardButton.click();

        tester.expect(audioElement.currentTime).toBe(8);
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
                playbackDerivativeUrl:
                    "http://localhost:3000/audio/drums.wav",
                volume: 1,
            },
            {
                channelNumber: 2,
                trackId: "track-2",
                name: "Bass",
                playbackDerivativeUrl:
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
                    playbackDerivativeUrl: "http://localhost:3000/audio/drums.wav",
                    volume: 0.75,
                },
                {
                    channelNumber: 2,
                    trackId: "track-2",
                    name: "Bass",
                    playbackDerivativeUrl: "http://localhost:3000/audio/bass.wav",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/drums.wav",
                volume: 0.75,
            },
            {
                channelNumber: 2,
                trackId: "track-2",
                name: "Bass",
                playbackDerivativeUrl: "http://localhost:3000/audio/bass.wav",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/drums.wav",
                volume: 0.75,
                enabled: true,
            },
            {
                channelNumber: 2,
                trackId: "track-2",
                name: "Bass",
                playbackDerivativeUrl: "http://localhost:3000/audio/bass.wav",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/guitar.wav",
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

    tester.it("keeps navigation available but blocks Play when all channels are disabled", () => {
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
                playbackDerivativeUrl: "http://localhost:3000/audio/guitar.wav",
                volume: 0.8,
                enabled: false,
            },
        ]);

        tester.expect(audioElement.volume).toBe(0);
        tester.expect(playPauseButton.disabled).toBe(true);
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
                playbackDerivativeUrl: "http://localhost:3000/audio/guitar.wav",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/guitar.wav",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/drums.wav",
                volume: 1,
            },
            {
                channelNumber: 2,
                trackId: "track-2",
                name: "Bass",
                playbackDerivativeUrl: "http://localhost:3000/audio/bass.wav",
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
                playbackDerivativeUrl: "http://localhost:3000/audio/drums.wav",
                volume: 1,
            },
            {
                channelNumber: 2,
                trackId: "track-2",
                name: "Bass",
                playbackDerivativeUrl: "http://localhost:3000/audio/bass.wav",
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
        let snapshot: ReturnType<PlaybackEngine["getSnapshot"]> = {
            currentTime: 0,
            musicalPosition: { bar: 1, beat: 1 },
            duration: 120,
            isPlaying: false,
            hasLoadedChannels: false,
            preparation: {
                status: "idle",
                requiredChannelCount: 0,
                readyRequiredChannelCount: 0,
                channels: [],
                failure: null,
            },
        };

        const playbackEngine: PlaybackEngine = {
            loadMix(channels) {
                calls.push(`load:${channels.length}`);
                loadedTimelineOffsetSeconds = channels[0]?.timelineOffsetSeconds;
                snapshot = {
                    ...snapshot,
                    hasLoadedChannels: channels.length > 0,
                    preparation: {
                        status: channels.length > 0 ? "ready" : "idle",
                        requiredChannelCount: channels.length,
                        readyRequiredChannelCount: channels.length,
                        channels: [],
                        failure: null,
                    },
                };
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
            setMetronomeEnabled(enabled) {
                calls.push(`metronome:${enabled}`);
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
        const metronomeCheckbox = createFakeCheckbox();

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
            metronomeCheckbox,
        });

        controller.init();
        controller.loadMix([{
            channelNumber: 1,
            trackId: "track-1",
            name: "Guitar",
            playbackDerivativeUrl: "/audio/guitar.wav",
            volume: 0.8,
            enabled: true,
            timelineOffsetSeconds: 3.5,
        }]);

        metronomeCheckbox.checked = true;
        metronomeCheckbox.change();
        await playPauseButton.click();
        await seekBackwardButton.click();
        controller.setChannelVolume(1, 0.4);
        controller.setChannelEnabled(1, false);
        await stopButton.click();

        tester.expect(loadedTimelineOffsetSeconds).toBe(3.5);
        tester.expect(calls).toEqual([
            "loop:false",
            "metronome:false",
            "load:1",
            "metronome:true",
            "play",
            "seekBy:-5",
            "volume:1:0.4",
            "enabled:1:false",
            "stop",
        ]);
    });
});
