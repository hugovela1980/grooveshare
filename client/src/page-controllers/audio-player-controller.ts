import {
    type MusicalTimeline,
    type PlaybackChannel,
    type PlaybackEngine,
    type PlaybackSnapshot,
} from "@hugovela/frontend-core";

type MixChannelForPlayer = {
    channelNumber: number;
    trackId: string;
    name: string;
    audioUrl: string;
    volume: number;
    enabled?: boolean;
    timelineOffsetSeconds?: number;
    musicalPlacement?: {
        start: { bar: number; beat: number };
        spanBeats: number | null;
    };
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
    addEventListener?: (
        eventName: "change",
        handler: () => void,
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

type NumberInputElementLike = {
    disabled: boolean;
    value: string;
};

type PlaybackMusicalTimelineDebugDetails = {
    projectId?: string;
    bpm: number;
    timeSignature: string;
    transportSeconds: number;
    musicalPosition: {
        bar: number;
        beat: number;
    };
};

type PlaybackDebugLogger = (
    message: string,
    details: PlaybackMusicalTimelineDebugDetails,
) => void;

type AudioPlayerControllerOptions = {
    playbackEngine: PlaybackEngine;
    musicalTimeline?: MusicalTimeline;
    projectId?: string;
    debugLogger?: PlaybackDebugLogger;
    seekBackwardButton: ButtonElementLike;
    playPauseButton: ButtonElementLike;
    stopButton: ButtonElementLike;
    progressInput: RangeInputElementLike;
    timestampElement: TextElementLike;
    durationElement: TextElementLike;
    musicalPositionElement: TextElementLike;
    seekBarInput: NumberInputElementLike;
    seekBarButton: ButtonElementLike;
    trackNameElement: TextElementLike;
    loopCheckbox: CheckboxElementLike;
};

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

function formatMusicalBeat(beat: number): string {
    const rounded = Number(beat.toFixed(3));
    return String(rounded);
}

export function formatMusicalPosition(position: { bar: number; beat: number }): string {
    return `Bar ${position.bar} · Beat ${formatMusicalBeat(position.beat)}`;
}

export function createAudioPlayerController({
    playbackEngine,
    musicalTimeline,
    projectId,
    debugLogger,
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
}: AudioPlayerControllerOptions) {
    let isSeeking = false;
    let loadedMixChannels: MixChannelForPlayer[] = [];

    function setControlsEnabled(isEnabled: boolean): void {
        seekBackwardButton.disabled = !isEnabled;
        playPauseButton.disabled = !isEnabled;
        stopButton.disabled = !isEnabled;
        progressInput.disabled = !isEnabled;
        seekBarInput.disabled = !isEnabled;
        seekBarButton.disabled = !isEnabled;
    }

    function setPlayPauseButtonIcon(snapshot: PlaybackSnapshot): void {
        playPauseButton.textContent = snapshot.isPlaying
            ? PAUSE_ICON
            : PLAY_ICON;
    }

    function updateTimestamp(snapshot: PlaybackSnapshot): void {
        timestampElement.textContent = formatTimestamp(snapshot.currentTime);
        durationElement.textContent = snapshot.duration > 0
            ? formatTimestamp(snapshot.duration)
            : "00:00";
        musicalPositionElement.textContent = formatMusicalPosition(
            snapshot.musicalPosition,
        );
    }

    function updateProgress(snapshot: PlaybackSnapshot): void {
        if (!isSeeking) {
            progressInput.value = snapshot.duration > 0
                ? String((snapshot.currentTime / snapshot.duration) * 100)
                : "0";
        }

        updateTimestamp(snapshot);
        setPlayPauseButtonIcon(snapshot);
        setControlsEnabled(snapshot.hasLoadedChannels);
    }

    function updateLoadedMixPresentation(): void {
        const enabledChannels = loadedMixChannels.filter((channel) => {
            return channel.enabled !== false;
        });

        if (loadedMixChannels.length === 0) {
            trackNameElement.textContent = "No track loaded.";
            return;
        }

        if (enabledChannels.length === 0) {
            trackNameElement.textContent = "All channels disabled.";
            return;
        }

        const trackNames = enabledChannels
            .map((channel) => channel.name)
            .join(", ");

        trackNameElement.textContent = enabledChannels.length === 1
            ? trackNames
            : `Mix loaded: ${trackNames}`;
    }

    function logMusicalTimeline(snapshot: PlaybackSnapshot): void {
        if (!musicalTimeline || !debugLogger) {
            return;
        }

        const musicalPosition = snapshot.musicalPosition;

        debugLogger("[GrooveShare] Playback musical timeline", {
            ...(projectId ? { projectId } : {}),
            bpm: musicalTimeline.bpm,
            timeSignature: `${musicalTimeline.timeSignature.numerator}/${musicalTimeline.timeSignature.denominator}`,
            transportSeconds: Number(snapshot.currentTime.toFixed(3)),
            musicalPosition: {
                bar: musicalPosition.bar,
                beat: Number(musicalPosition.beat.toFixed(3)),
            },
        });
    }

    async function handlePlayPauseClick(): Promise<void> {
        const snapshot = playbackEngine.getSnapshot();

        if (!snapshot.hasLoadedChannels) {
            return;
        }

        if (snapshot.isPlaying) {
            playbackEngine.pause();
            return;
        }

        logMusicalTimeline(snapshot);
        await playbackEngine.play();
    }

    function stop(): void {
        playbackEngine.stop();
    }

    function seek(): void {
        const snapshot = playbackEngine.getSnapshot();

        if (snapshot.duration <= 0) {
            return;
        }

        const progressPercentage = Number(progressInput.value);

        if (!Number.isFinite(progressPercentage)) {
            return;
        }

        const nextCurrentTime =
            (Math.max(0, Math.min(100, progressPercentage)) / 100) *
            snapshot.duration;

        playbackEngine.seek(nextCurrentTime);
    }

    function beginSeeking(): void {
        isSeeking = true;
    }

    function finishSeeking(): void {
        seek();
        isSeeking = false;
        updateProgress(playbackEngine.getSnapshot());
    }

    function seekToBar(): void {
        const bar = Number(seekBarInput.value);

        if (!Number.isInteger(bar) || bar < 1) {
            return;
        }

        playbackEngine.seekToMusicalPosition({ bar, beat: 1 });
        updateProgress(playbackEngine.getSnapshot());
    }

    function loadMix(channels: MixChannelForPlayer[]): void {
        loadedMixChannels = channels.map((channel) => ({ ...channel }));

        const playbackChannels: PlaybackChannel[] = channels.map((channel) => ({
            channelNumber: channel.channelNumber,
            trackId: channel.trackId,
            audioUrl: channel.audioUrl,
            volume: channel.volume,
            enabled: channel.enabled !== false,
            ...(channel.timelineOffsetSeconds !== undefined
                ? { timelineOffsetSeconds: channel.timelineOffsetSeconds }
                : {}),
            ...(channel.musicalPlacement
                ? {
                    musicalPlacement: {
                        start: { ...channel.musicalPlacement.start },
                        spanBeats: channel.musicalPlacement.spanBeats,
                    },
                }
                : {}),
        }));

        playbackEngine.loadMix(playbackChannels);
        updateLoadedMixPresentation();

        const snapshot = playbackEngine.getSnapshot();
        progressInput.value = "0";
        timestampElement.textContent = "00:00";
        durationElement.textContent = "00:00";
        musicalPositionElement.textContent = formatMusicalPosition(
            snapshot.musicalPosition,
        );
        seekBarInput.value = "1";
        setPlayPauseButtonIcon(snapshot);
        setControlsEnabled(snapshot.hasLoadedChannels);
    }

    function setChannelVolume(
        channelNumber: number,
        volume: number,
    ): boolean {
        const channel = loadedMixChannels.find((currentChannel) => {
            return currentChannel.channelNumber === channelNumber;
        });

        if (!channel) {
            return false;
        }

        const didUpdate = playbackEngine.setChannelVolume(
            channelNumber,
            volume,
        );

        if (didUpdate) {
            channel.volume = volume;
        }

        return didUpdate;
    }

    function setChannelEnabled(
        channelNumber: number,
        enabled: boolean,
    ): boolean {
        const channel = loadedMixChannels.find((currentChannel) => {
            return currentChannel.channelNumber === channelNumber;
        });

        if (!channel) {
            return false;
        }

        const didUpdate = playbackEngine.setChannelEnabled(
            channelNumber,
            enabled,
        );

        if (!didUpdate) {
            return false;
        }

        channel.enabled = enabled;
        updateLoadedMixPresentation();
        return true;
    }

    function setTrackName(trackId: string, name: string): boolean {
        const channel = loadedMixChannels.find((currentChannel) => {
            return currentChannel.trackId === trackId;
        });

        if (!channel) {
            return false;
        }

        channel.name = name;
        updateLoadedMixPresentation();
        return true;
    }

    function init(): void {
        playbackEngine.setLoopEnabled(loopCheckbox.checked);
        playbackEngine.subscribe((snapshot) => {
            updateProgress(snapshot);
        });

        updateLoadedMixPresentation();

        seekBackwardButton.addEventListener("click", () => {
            playbackEngine.seekBy(-SEEK_BACKWARD_SECONDS);
        });

        playPauseButton.addEventListener("click", () => {
            return handlePlayPauseClick();
        });

        stopButton.addEventListener("click", stop);
        seekBarButton.addEventListener("click", seekToBar);
        progressInput.addEventListener("input", beginSeeking);
        progressInput.addEventListener("change", finishSeeking);

        loopCheckbox.addEventListener?.("change", () => {
            playbackEngine.setLoopEnabled(loopCheckbox.checked);
        });
    }

    function destroy(): void {
        playbackEngine.destroy?.();
    }

    return {
        init,
        loadMix,
        setChannelVolume,
        setChannelEnabled,
        setTrackName,
        stop,
        destroy,
    };
}
