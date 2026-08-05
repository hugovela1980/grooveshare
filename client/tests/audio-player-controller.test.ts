import {
    createAudioPlayerController,
    formatTimestamp,
} from "../src/page-controllers/audio-player-controller.js";
import { tester } from "./test-runner/tester.js";

type Listener = () => void | Promise<void>;

function createFakeAudioElement() {
    const listeners = new Map<string, Listener>();

    return {
        src: "",
        currentTime: 0,
        duration: 120,
        paused: true,
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

function createFakeRangeInput() {
    let inputHandler: Listener | null = null;

    return {
        disabled: true,
        value: "0",

        addEventListener(eventName: "input", handler: Listener): void {
            if (eventName === "input") {
                inputHandler = handler;
            }
        },

        input(): void {
            inputHandler?.();
        },
    };
}

function createFakeTextElement() {
    return {
        textContent: null as string | null,
    };
}

function createControllerTestSetup() {
    const audioElement = createFakeAudioElement();
    const playPauseButton = createFakeButton();
    const stopButton = createFakeButton();
    const progressInput = createFakeRangeInput();
    const timestampElement = createFakeTextElement();
    const trackNameElement = createFakeTextElement();

    const controller = createAudioPlayerController({
        audioElement,
        playPauseButton,
        stopButton,
        progressInput,
        timestampElement,
        trackNameElement,
    });

    return {
        audioElement,
        playPauseButton,
        stopButton,
        progressInput,
        timestampElement,
        trackNameElement,
        controller,
    };
}

tester.describe("audio player controller", () => {
    tester.it("formats timestamps as minutes and seconds", () => {
        tester.expect(formatTimestamp(0)).toBe("00:00");
        tester.expect(formatTimestamp(5)).toBe("00:05");
        tester.expect(formatTimestamp(65)).toBe("01:05");
        tester.expect(formatTimestamp(600)).toBe("10:00");
    });

    tester.it("disables controls before a track is loaded", () => {
        const { controller, playPauseButton, stopButton, progressInput } =
            createControllerTestSetup();

        controller.init();

        tester.expect(playPauseButton.disabled).toBe(true);
        tester.expect(stopButton.disabled).toBe(true);
        tester.expect(progressInput.disabled).toBe(true);
    });

    tester.it("loads a track and enables the controls", () => {
        const {
            controller,
            audioElement,
            playPauseButton,
            stopButton,
            progressInput,
            timestampElement,
            trackNameElement,
        } = createControllerTestSetup();

        controller.init();

        controller.loadTrack({
            name: "Guitar Take",
            audioUrl: "http://localhost:3000/audio/guitar.wav",
        });

        tester.expect(audioElement.src).toBe("http://localhost:3000/audio/guitar.wav");
        tester.expect(audioElement.currentTime).toBe(0);
        tester.expect(audioElement.loadCallCount).toBe(1);
        tester.expect(playPauseButton.disabled).toBe(false);
        tester.expect(stopButton.disabled).toBe(false);
        tester.expect(progressInput.disabled).toBe(false);
        tester.expect(progressInput.value).toBe("0");
        tester.expect(timestampElement.textContent).toBe("00:00");
        tester.expect(trackNameElement.textContent).toBe("Guitar Take");
    });

    tester.it("plays and pauses the loaded audio track", async () => {
        const { controller, audioElement, playPauseButton } =
            createControllerTestSetup();

        controller.init();

        controller.loadTrack({
            name: "Bass Take",
            audioUrl: "http://localhost:3000/audio/bass.wav",
        });

        await playPauseButton.click();

        tester.expect(audioElement.playCallCount).toBe(1);
        tester.expect(audioElement.paused).toBe(false);
        tester.expect(playPauseButton.textContent).toBe("Pause");

        await playPauseButton.click();

        tester.expect(audioElement.pauseCallCount).toBe(1);
        tester.expect(audioElement.paused).toBe(true);
        tester.expect(playPauseButton.textContent).toBe("Play");
    });

    tester.it("stops the loaded audio track", async () => {
        const { controller, audioElement, stopButton, playPauseButton } =
            createControllerTestSetup();

        controller.init();

        controller.loadTrack({
            name: "Drum Take",
            audioUrl: "http://localhost:3000/audio/drums.wav",
        });

        audioElement.currentTime = 45;
        audioElement.paused = false;

        await stopButton.click();

        tester.expect(audioElement.pauseCallCount).toBe(1);
        tester.expect(audioElement.currentTime).toBe(0);
        tester.expect(audioElement.paused).toBe(true);
        tester.expect(playPauseButton.textContent).toBe("Play");
    });

    tester.it("updates progress and timestamp as audio plays", async () => {
        const { controller, audioElement, progressInput, timestampElement } =
            createControllerTestSetup();

        controller.init();

        controller.loadTrack({
            name: "Keys Take",
            audioUrl: "http://localhost:3000/audio/keys.wav",
        });

        audioElement.duration = 120;
        audioElement.currentTime = 30;

        await audioElement.trigger("timeupdate");

        tester.expect(progressInput.value).toBe("25");
        tester.expect(timestampElement.textContent).toBe("00:30 / 02:00");
    });

    tester.it("seeks when the progress input changes", () => {
        const { controller, audioElement, progressInput, timestampElement } =
            createControllerTestSetup();

        controller.init();

        controller.loadTrack({
            name: "Vocal Take",
            audioUrl: "http://localhost:3000/audio/vocal.wav",
        });

        audioElement.duration = 200;
        progressInput.value = "50";

        progressInput.input();

        tester.expect(audioElement.currentTime).toBe(100);
        tester.expect(timestampElement.textContent).toBe("01:40 / 03:20");
    });
});