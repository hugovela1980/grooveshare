import {
    normalizeMusicalTimeline,
    musicalPositionToTransportSeconds,
    transportSecondsToMusicalPosition,
    type MusicalTimeline,
    type PlaybackChannel,
    type PlaybackEngine,
    type PlaybackSnapshot,
    type RecordingWorkspaceState,
} from "@hugovela/frontend-core";

type MixChannelForPlayer = {
    channelNumber: number;
    trackId: string;
    name: string;
    audioUrl: string;
    volume: number;
    enabled?: boolean;
    timelineOffsetSeconds?: number;
    alignmentOffsetSeconds?: number;
    mediaLeadInSeconds?: number;
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
    style?: { setProperty(name: string, value: string): void };
    setAttribute?: (name: string, value: string) => void;
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
    select?: () => void;
    addEventListener?: (eventName: "keydown" | "focus" | "click", handler: (event: { key: string; preventDefault(): void }) => void) => void;
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
    seekForwardButton?: ButtonElementLike | null;
    playPauseButton: ButtonElementLike;
    stopButton: ButtonElementLike;
    progressInput: RangeInputElementLike;
    timestampElement: TextElementLike;
    durationElement: TextElementLike;
    musicalPositionElement: TextElementLike;
    seekBarInput: NumberInputElementLike;
    seekBeatInput?: NumberInputElementLike | null;
    seekStatusElement?: TextElementLike | null;
    seekBarButton: ButtonElementLike;
    trackNameElement: TextElementLike;
    loopCheckbox: CheckboxElementLike;
    metronomeCheckbox: CheckboxElementLike;
    recordingWorkspaceState?: RecordingWorkspaceState | null;
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
    return String(Math.floor(beat));
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
    recordingWorkspaceState,
}: AudioPlayerControllerOptions) {
    let isSeeking = false;
    let loadedMixChannels: MixChannelForPlayer[] = [];

    function setControlsEnabled(isEnabled: boolean): void {
        seekBackwardButton.disabled = !isEnabled;
        if (seekForwardButton) {
            seekForwardButton.disabled = !isEnabled;
        }
        playPauseButton.disabled = !isEnabled;
        stopButton.disabled = !isEnabled;
        progressInput.disabled = !isEnabled;
        seekBarInput.disabled = !isEnabled;
        if (seekBeatInput) seekBeatInput.disabled = !isEnabled;
        seekBarButton.disabled = !isEnabled;
    }

    function setPlayPauseButtonIcon(snapshot: PlaybackSnapshot): void {
        playPauseButton.textContent = snapshot.isPlaying
            ? PAUSE_ICON
            : PLAY_ICON;
    }

    function updateTimestamp(snapshot: PlaybackSnapshot): void {
        const selectedTime = isSeeking ? getSelectedTime(snapshot) : null;
        const currentTime = selectedTime ?? snapshot.currentTime;
        const position = selectedTime === null
            ? snapshot.musicalPosition
            : transportSecondsToMusicalPosition(normalizeMusicalTimeline(musicalTimeline), selectedTime);
        timestampElement.textContent = formatTimestamp(currentTime);
        durationElement.textContent = snapshot.duration > 0
            ? formatTimestamp(snapshot.duration)
            : "00:00";
        musicalPositionElement.textContent = formatMusicalPosition(
            position,
        );
        const percentage = snapshot.duration > 0
            ? Math.max(0, Math.min(100, currentTime / snapshot.duration * 100))
            : 0;
        progressInput.style?.setProperty("--seek-progress", `${percentage}%`);
        progressInput.setAttribute?.("aria-valuetext", `${formatMusicalPosition(position)}, ${formatTimestamp(currentTime)} of ${formatTimestamp(snapshot.duration)}`);
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

    function stop({ resetWorkspaceAnchor = true }: { resetWorkspaceAnchor?: boolean } = {}): void {
        playbackEngine.stop();
        if (resetWorkspaceAnchor) {
            recordingWorkspaceState?.clearAnchor();
        }
    }

    function getSelectedTime(snapshot: PlaybackSnapshot): number | null {
        if (snapshot.duration <= 0) {
            return null;
        }

        const progressPercentage = Number(progressInput.value);

        if (!Number.isFinite(progressPercentage)) {
            return null;
        }

        return (
            (Math.max(0, Math.min(100, progressPercentage)) / 100) *
            snapshot.duration);
    }

    function seek(): void {
        const nextCurrentTime = getSelectedTime(playbackEngine.getSnapshot());
        if (nextCurrentTime !== null) playbackEngine.seek(nextCurrentTime);
    }

    function beginSeeking(): void {
        isSeeking = true;
        updateTimestamp(playbackEngine.getSnapshot());
    }

    function finishSeeking(): void {
        seek();
        isSeeking = false;
        updateProgress(playbackEngine.getSnapshot());
    }

    function seekToBar(): void {
        const bar = Number(seekBarInput.value);
        const beat = seekBeatInput ? Number(seekBeatInput.value) : 1;
        const timeline = normalizeMusicalTimeline(musicalTimeline);
        const reportError = (message: string): void => {
            if (seekStatusElement) seekStatusElement.textContent = message;
        };

        if (!Number.isInteger(bar) || bar < 1 || !Number.isInteger(beat) || beat < 1 || beat > timeline.timeSignature.numerator) {
            reportError(`Enter a whole bar of 1 or more and a beat from 1 to ${timeline.timeSignature.numerator}.`);
            return;
        }

        const anchor = { bar, beat };
        const snapshot = playbackEngine.getSnapshot();
        const seconds = musicalPositionToTransportSeconds(timeline, anchor);
        if (!snapshot.hasLoadedChannels || seconds > snapshot.duration) {
            reportError("Choose a position within the loaded project.");
            return;
        }
        reportError("");
        recordingWorkspaceState?.setAnchor(anchor);
        playbackEngine.seekToMusicalPosition(anchor);
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
            ...(channel.alignmentOffsetSeconds !== undefined
                ? { alignmentOffsetSeconds: channel.alignmentOffsetSeconds }
                : {}),
            ...(channel.mediaLeadInSeconds !== undefined
                ? { mediaLeadInSeconds: channel.mediaLeadInSeconds }
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
        const workspaceAnchor = recordingWorkspaceState?.getAnchor() ?? null;
        if (workspaceAnchor) {
            playbackEngine.seekToMusicalPosition(workspaceAnchor);
        }
        updateLoadedMixPresentation();

        const snapshot = playbackEngine.getSnapshot();
        progressInput.value = "0";
        timestampElement.textContent = "00:00";
        durationElement.textContent = "00:00";
        musicalPositionElement.textContent = formatMusicalPosition(
            snapshot.musicalPosition,
        );
        // Preserve the collaborator's current navigation target across mix
        // reloads (for example after keeping a recorded take). The initial
        // markup already defaults this field to Bar 1.
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
        playbackEngine.setMetronomeEnabled?.(metronomeCheckbox.checked);
        playbackEngine.subscribe((snapshot) => {
            updateProgress(snapshot);
        });

        updateLoadedMixPresentation();

        seekBackwardButton.addEventListener("click", () => {
            playbackEngine.seekBy(-SEEK_BACKWARD_SECONDS);
        });

        seekForwardButton?.addEventListener("click", () => {
            playbackEngine.seekBy(SEEK_BACKWARD_SECONDS);
        });

        playPauseButton.addEventListener("click", () => {
            return handlePlayPauseClick();
        });

        stopButton.addEventListener("click", () => stop());
        seekBarButton.addEventListener("click", seekToBar);
        for (const input of [seekBarInput, seekBeatInput]) {
            input?.addEventListener?.("focus", () => input.select?.());
            input?.addEventListener?.("click", () => input.select?.());
            input?.addEventListener?.("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    seekToBar();
                }
            });
        }
        progressInput.addEventListener("input", beginSeeking);
        progressInput.addEventListener("change", finishSeeking);

        loopCheckbox.addEventListener?.("change", () => {
            playbackEngine.setLoopEnabled(loopCheckbox.checked);
        });

        metronomeCheckbox.addEventListener?.("change", () => {
            playbackEngine.setMetronomeEnabled?.(metronomeCheckbox.checked);
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
