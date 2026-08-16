type MixChannelForPlayer = {
    channelNumber: number;
    trackId: string;
    name: string;
    audioUrl: string;
    volume: number;
    enabled?: boolean;
};

type LoadedMixChannel = {
    channel: MixChannelForPlayer;
    audioElement: AudioElementLike;
};

type AudioElementLike = {
    src: string;
    crossOrigin?: string | null;
    currentTime: number;
    duration: number;
    paused: boolean;
    volume: number;
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

type CheckboxElementLike = {
    checked: boolean;
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
    seekBackwardButton: ButtonElementLike;
    playPauseButton: ButtonElementLike;
    stopButton: ButtonElementLike;
    progressInput: RangeInputElementLike;
    timestampElement: TextElementLike;
    durationElement: TextElementLike;
    trackNameElement: TextElementLike;
    createAudioElement?: () => AudioElementLike;
    loopCheckbox: CheckboxElementLike;
};

function isUsableDuration(duration: number): boolean {
    return Number.isFinite(duration) && duration > 0;
}

const PLAY_ICON = "▶";
const PAUSE_ICON = "❚❚";
const SEEK_BACKWARD_SECONDS = 5;

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
    seekBackwardButton,
    playPauseButton,
    stopButton,
    progressInput,
    timestampElement,
    durationElement,
    trackNameElement,
    loopCheckbox,
    createAudioElement = () => document.createElement("audio"),
}: AudioPlayerControllerOptions) {
    let isSeeking = false;
    let loadedMixChannels: LoadedMixChannel[] = [];

    function setControlsEnabled(isEnabled: boolean): void {
        seekBackwardButton.disabled = !isEnabled;
        playPauseButton.disabled = !isEnabled;
        stopButton.disabled = !isEnabled;
        progressInput.disabled = !isEnabled;
    }

    function setPlayPauseButtonIcon(): void {
        const primaryAudioElement = getPrimaryAudioElement();

        playPauseButton.textContent = primaryAudioElement.paused
            ? PLAY_ICON
            : PAUSE_ICON;
    }

    function updateTimestamp(): void {
        const primaryAudioElement = getPrimaryAudioElement();

        timestampElement.textContent = formatTimestamp(
            primaryAudioElement.currentTime,
        );
        durationElement.textContent = isUsableDuration(primaryAudioElement.duration)
            ? formatTimestamp(primaryAudioElement.duration)
            : "00:00";
    }

    function updateProgress(): void {
        const primaryAudioElement = getPrimaryAudioElement();

        if (isSeeking) {
            updateTimestamp();
            return;
        }

        if (!isUsableDuration(primaryAudioElement.duration)) {
            progressInput.value = "0";
            updateTimestamp();
            return;
        }

        const progressPercentage =
            (primaryAudioElement.currentTime / primaryAudioElement.duration) * 100;

        progressInput.value = String(progressPercentage);
        updateTimestamp();
    }

    async function handlePlayPauseClick(): Promise<void> {
        const primaryAudioElement = getPrimaryAudioElement();

        if (!primaryAudioElement.src) {
            return;
        }

        if (primaryAudioElement.paused) {
            await Promise.all(
                getLoadedAudioElements().map((loadedAudioElement) => {
                    return loadedAudioElement.play();
                }),
            );

            setPlayPauseButtonIcon();
            return;
        }

        for (const loadedAudioElement of getLoadedAudioElements()) {
            loadedAudioElement.pause();
        }

        setPlayPauseButtonIcon();
    }

    function stop(): void {
        for (const loadedAudioElement of getLoadedAudioElements()) {
            if (loadedAudioElement.src) {
                loadedAudioElement.pause();
            }

            loadedAudioElement.currentTime = 0;
        }

        setPlayPauseButtonIcon();
        updateProgress();
    }

    async function handleAudioEnded(): Promise<void> {
        if (!loopCheckbox.checked) {
            stop();
            return;
        }

        setAllAudioElementsToCurrentTime(0);

        await Promise.all(
            getLoadedAudioElements().map((loadedAudioElement) => {
                return loadedAudioElement.play();
            }),
        );

        setPlayPauseButtonIcon();
        updateProgress();
    }

    function seek(): void {
        const primaryAudioElement = getPrimaryAudioElement();

        if (!isUsableDuration(primaryAudioElement.duration)) {
            return;
        }

        const progressPercentage = Number(progressInput.value);

        if (!Number.isFinite(progressPercentage)) {
            return;
        }

        const nextCurrentTime =
            (Math.max(0, Math.min(100, progressPercentage)) / 100) *
            primaryAudioElement.duration;

        setAllAudioElementsToCurrentTime(nextCurrentTime);
        updateProgress();
    }

    function seekBySeconds(seconds: number): void {
        const primaryAudioElement = getPrimaryAudioElement();

        if (!primaryAudioElement.src || !Number.isFinite(seconds)) {
            return;
        }

        const unclampedTime = primaryAudioElement.currentTime + seconds;
        const nextCurrentTime = isUsableDuration(primaryAudioElement.duration)
            ? Math.max(0, Math.min(primaryAudioElement.duration, unclampedTime))
            : Math.max(0, unclampedTime);

        setAllAudioElementsToCurrentTime(nextCurrentTime);
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

    function updateLoadedMixPresentation(): void {
        const enabledChannels = loadedMixChannels.filter(({ channel }) => {
            return channel.enabled !== false;
        });

        if (loadedMixChannels.length === 0) {
            trackNameElement.textContent = "No track loaded.";
            setControlsEnabled(false);
            return;
        }

        if (enabledChannels.length === 0) {
            trackNameElement.textContent = "All channels disabled.";
        } else {
            const trackNames = enabledChannels
                .map(({ channel }) => channel.name)
                .join(", ");

            trackNameElement.textContent =
                enabledChannels.length === 1
                    ? trackNames
                    : `Mix loaded: ${trackNames}`;
        }

        setControlsEnabled(true);
    }

    function setChannelVolume(
        channelNumber: number,
        volume: number,
    ): boolean {
        const loadedChannel = loadedMixChannels.find(({ channel }) => {
            return channel.channelNumber === channelNumber;
        });

        if (!loadedChannel) {
            return false;
        }

        const nextVolume = clampVolume(volume);

        loadedChannel.channel.volume = nextVolume;
        loadedChannel.audioElement.volume =
            loadedChannel.channel.enabled === false ? 0 : nextVolume;

        return true;
    }

    function setChannelEnabled(
        channelNumber: number,
        enabled: boolean,
    ): boolean {
        const loadedChannel = loadedMixChannels.find(({ channel }) => {
            return channel.channelNumber === channelNumber;
        });

        if (!loadedChannel) {
            return false;
        }

        loadedChannel.channel.enabled = enabled;
        loadedChannel.audioElement.volume = enabled
            ? clampVolume(loadedChannel.channel.volume)
            : 0;

        updateLoadedMixPresentation();
        return true;
    }

    function setTrackName(trackId: string, name: string): boolean {
        const loadedChannel = loadedMixChannels.find(({ channel }) => {
            return channel.trackId === trackId;
        });

        if (!loadedChannel) {
            return false;
        }

        loadedChannel.channel.name = name;
        updateLoadedMixPresentation();
        return true;
    }

    function loadMix(channels: MixChannelForPlayer[]): void {
        stop();

        loadedMixChannels = channels.map((channel, index) => {
            const channelAudioElement =
                index === 0 ? audioElement : createAudioElement();

            channelAudioElement.crossOrigin = "use-credentials";
            channelAudioElement.src = channel.audioUrl;
            channelAudioElement.currentTime = 0;
            channelAudioElement.volume = channel.enabled === false
                ? 0
                : clampVolume(channel.volume);
            channelAudioElement.load?.();

            return {
                channel,
                audioElement: channelAudioElement,
            };
        });

        progressInput.value = "0";
        timestampElement.textContent = "00:00";
        durationElement.textContent = "00:00";
        setPlayPauseButtonIcon();
        updateLoadedMixPresentation();
    }

    function init(): void {
        setControlsEnabled(false);
        setPlayPauseButtonIcon();
        updateTimestamp();

        seekBackwardButton.addEventListener("click", () => {
            seekBySeconds(-SEEK_BACKWARD_SECONDS);
        });
        playPauseButton.addEventListener("click", () => handlePlayPauseClick());
        stopButton.addEventListener("click", stop);

        progressInput.addEventListener("input", beginSeeking);
        progressInput.addEventListener("change", finishSeeking);

        audioElement.addEventListener("timeupdate", updateProgress);
        audioElement.addEventListener("loadedmetadata", updateProgress);
        audioElement.addEventListener("ended", () => {
            void handleAudioEnded();
        });
    }

    function clampVolume(volume: number): number {
        if (!Number.isFinite(volume)) {
            return 1;
        }

        return Math.max(0, Math.min(1, volume));
    }

    function getPrimaryAudioElement(): AudioElementLike {
        return loadedMixChannels[0]?.audioElement ?? audioElement;
    }

    function getLoadedAudioElements(): AudioElementLike[] {
        if (loadedMixChannels.length > 0) {
            return loadedMixChannels.map((loadedChannel) => {
                return loadedChannel.audioElement;
            });
        }

        return [audioElement];
    }

    function setAllAudioElementsToCurrentTime(currentTime: number): void {
        for (const loadedAudioElement of getLoadedAudioElements()) {
            loadedAudioElement.currentTime = currentTime;
        }
    }

    return {
        init,
        loadMix,
        setChannelVolume,
        setChannelEnabled,
        setTrackName,
        stop,
    };
}
