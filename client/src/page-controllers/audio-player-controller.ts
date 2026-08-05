type AudioTrackForPlayer = {
    name: string;
    audioUrl: string;
};

type AudioElementLike = {
    src: string;
    currentTime: number;
    duration: number;
    paused: boolean;
    play: () => Promise<void>;
    pause: () => void;
    load?: () => void;
    addEventListener: (
        eventName: "timeupdate" | "loadedmetadata" | "ended",
        handler: () => void,
    ) => void;
};

type ButtonElementLike = {
    disabled: boolean;
    textContent: string | null;
    addEventListener: (
        eventName: "click",
        handler: () => void | Promise<void>,
    ) => void;
};

type RangeInputElementLike = {
    disabled: boolean;
    value: string;
    addEventListener: (
        eventName: "input" | "change",
        handler: () => void,
    ) => void;
};

type TextElementLike = {
    textContent: string | null;
};

type AudioPlayerControllerOptions = {
    audioElement: AudioElementLike;
    playPauseButton: ButtonElementLike;
    stopButton: ButtonElementLike;
    progressInput: RangeInputElementLike;
    timestampElement: TextElementLike;
    trackNameElement: TextElementLike;
};

function isUsableDuration(duration: number): boolean {
    return Number.isFinite(duration) && duration > 0;
}

export function formatTimestamp(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
        return "00:00";
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function createAudioPlayerController({
    audioElement,
    playPauseButton,
    stopButton,
    progressInput,
    timestampElement,
    trackNameElement,
}: AudioPlayerControllerOptions) {
    let isSeeking = false;

    function setControlsEnabled(isEnabled: boolean): void {
        playPauseButton.disabled = !isEnabled;
        stopButton.disabled = !isEnabled;
        progressInput.disabled = !isEnabled;
    }

    function setPlayButtonText(): void {
        playPauseButton.textContent = audioElement.paused ? "Play" : "Pause";
    }

    function updateTimestamp(): void {
        if (isUsableDuration(audioElement.duration)) {
            timestampElement.textContent = `${formatTimestamp(
                audioElement.currentTime,
            )} / ${formatTimestamp(audioElement.duration)}`;

            return;
        }

        timestampElement.textContent = formatTimestamp(audioElement.currentTime);
    }

    function updateProgress(): void {
        if (isSeeking) {
            updateTimestamp();
            return;
        }

        if (!isUsableDuration(audioElement.duration)) {
            progressInput.value = "0";
            updateTimestamp();
            return;
        }

        const progressPercentage =
            (audioElement.currentTime / audioElement.duration) * 100;

        progressInput.value = String(progressPercentage);
        updateTimestamp();
    }

    async function handlePlayPauseClick(): Promise<void> {
        if (!audioElement.src) {
            return;
        }

        if (audioElement.paused) {
            await audioElement.play();
            setPlayButtonText();
            return;
        }

        audioElement.pause();
        setPlayButtonText();
    }

    function stop(): void {
        audioElement.pause();
        audioElement.currentTime = 0;
        setPlayButtonText();
        updateProgress();
    }

    function seek(): void {
        if (!isUsableDuration(audioElement.duration)) {
            return;
        }

        const progressPercentage = Number(progressInput.value);

        if (!Number.isFinite(progressPercentage)) {
            return;
        }

        audioElement.currentTime =
            (Math.max(0, Math.min(100, progressPercentage)) / 100) *
            audioElement.duration;

        updateProgress();
    }

    function beginSeeking(): void {
        isSeeking = true;
    }

    function finishSeeking(): void {
        seek();
        isSeeking = false;
        updateProgress();
    }

    function loadTrack(track: AudioTrackForPlayer): void {
        audioElement.src = track.audioUrl;
        audioElement.currentTime = 0;

        trackNameElement.textContent = track.name;
        progressInput.value = "0";
        timestampElement.textContent = "00:00";
        playPauseButton.textContent = "Play";

        setControlsEnabled(true);
        audioElement.load?.();
    }

    function init(): void {
        setControlsEnabled(false);
        setPlayButtonText();
        updateTimestamp();

        playPauseButton.addEventListener("click", () => handlePlayPauseClick());
        stopButton.addEventListener("click", stop);
        
        progressInput.addEventListener("input", beginSeeking);
        progressInput.addEventListener("change", finishSeeking);

        audioElement.addEventListener("timeupdate", updateProgress);
        audioElement.addEventListener("loadedmetadata", updateProgress);
        audioElement.addEventListener("ended", stop);
    }

    return {
        init,
        loadTrack,
        stop,
    };
}