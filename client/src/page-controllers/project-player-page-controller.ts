import type { Project, Track } from "../types.js";

type TracksApi = {
    getTracksByProjectId: (projectId: string) => Promise<Track[]>;
    deleteTrack: (projectId: string, trackId: string) => Promise<Track>;
};

type ProjectsApi = {
    deleteProject: (projectId: string) => Promise<Project>;
};

type ClickEventLike = {
    target: EventTarget | null;
};

type MixChannelForPlayer = {
    channelNumber: number;
    trackId: string;
    name: string;
    audioUrl: string;
    volume: number;
};

type AudioPlayerController = {
    loadTrack?: (track: { name: string; audioUrl: string }) => void;
    loadMix?: (channels: MixChannelForPlayer[]) => void;
};

type TrackListElementLike = {
    innerHTML: string;
    addEventListener: (
        eventName: "click",
        handler: (event: ClickEventLike) => void | Promise<void>,
    ) => void;
    querySelectorAll?: (selector: string) => Iterable<ChannelSlotElementLike>;
};

type ButtonElementLike = {
    addEventListener: (
        eventName: "click",
        handler: () => void | Promise<void>,
    ) => void;
};

type TextElementLike = {
    textContent: string | null;
};

type DeleteButtonLike = {
    dataset?: {
        trackId?: string;
    };
};

type ClosestElementLike = {
    closest?: (selector: string) => DeleteButtonLike | null;
};

type ChannelEnabledInputLike = {
    checked?: boolean;
};

type ChannelVolumeInputLike = {
    value?: string;
};

type ChannelSlotElementLike = {
    dataset?: {
        mixChannel?: string;
        trackId?: string;
    };
    querySelector?: (
        selector: string,
    ) => ChannelEnabledInputLike | ChannelVolumeInputLike | null;
};

type ProjectPlayerPageControllerOptions = {
    project: Project;
    trackListElement: TrackListElementLike;
    statusElement?: TextElementLike | null;
    deleteProjectButton?: ButtonElementLike | null;
    tracksApi: TracksApi;
    projectsApi?: ProjectsApi;
    renderTrackList: (tracks: Track[]) => string;
    confirmDeleteProject?: (message: string) => boolean;
    onProjectDeleted?: () => void;
    audioPlayerController?: AudioPlayerController;
    getTrackAudioUrl?: (projectId: string, trackId: string) => string;
};

function getDeleteTrackIdFromTarget(target: EventTarget | null): string | null {
    const element = target as ClosestElementLike | null;
    const deleteButton = element?.closest?.("[data-track-delete-button]");

    return deleteButton?.dataset?.trackId ?? null;
}

function getLoadTrackIdFromTarget(target: EventTarget | null): string | null {
    const element = target as ClosestElementLike | null;
    const loadButton = element?.closest?.("[data-track-load-button]");

    return loadButton?.dataset?.trackId ?? null;
}

function getIsLoadMixClickFromTarget(target: EventTarget | null): boolean {
    const element = target as ClosestElementLike | null;
    const loadMixButton = element?.closest?.("[data-load-mix-button]");

    return Boolean(loadMixButton);
}

function setStatus(
    statusElement: TextElementLike | null | undefined,
    message: string,
): void {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message;
}

export function createProjectPlayerPageController({
    project,
    trackListElement,
    statusElement,
    deleteProjectButton,
    tracksApi,
    projectsApi,
    renderTrackList,
    confirmDeleteProject = globalThis.confirm,
    onProjectDeleted,
    audioPlayerController,
    getTrackAudioUrl,
}: ProjectPlayerPageControllerOptions) {
    let currentTracks: Track[] = [];

    async function loadTracks(): Promise<void> {
        try {
            const tracks = await tracksApi.getTracksByProjectId(project.id);
            currentTracks = tracks;
            trackListElement.innerHTML = renderTrackList(tracks);
        } catch {
            trackListElement.innerHTML =
                '<p class="empty-state">Could not load tracks.</p>';
        }
    }

    function handleLoadTrack(trackId: string): void {
        if (!audioPlayerController?.loadTrack || !getTrackAudioUrl) {
            return;
        }

        const track = currentTracks.find((track) => track.id === trackId);

        if (!track) {
            setStatus(statusElement, "Could not load track.");
            return;
        }

        audioPlayerController.loadTrack({
            name: track.name,
            audioUrl: getTrackAudioUrl(project.id, track.id),
        });

        setStatus(statusElement, `Loaded ${track.name}.`);
    }

    function getEnabledMixChannels(): MixChannelForPlayer[] {
        if (!trackListElement.querySelectorAll || !getTrackAudioUrl) {
            return [];
        }

        const channelSlotElements = Array.from(
            trackListElement.querySelectorAll("[data-mix-channel-slot][data-track-id]"),
        );

        return channelSlotElements
            .map((channelSlotElement) => {
                const trackId = channelSlotElement.dataset?.trackId;
                const channelNumber = Number(channelSlotElement.dataset?.mixChannel);

                if (!trackId || !Number.isFinite(channelNumber)) {
                    return null;
                }

                const track = currentTracks.find((track) => track.id === trackId);

                if (!track) {
                    return null;
                }

                const enabledInput = channelSlotElement.querySelector?.(
                    "[data-channel-enabled]",
                ) as ChannelEnabledInputLike | null;

                const volumeInput = channelSlotElement.querySelector?.(
                    "[data-channel-volume]",
                ) as ChannelVolumeInputLike | null;

                const isEnabled = enabledInput?.checked ?? false;
                const volume = Number(volumeInput?.value ?? "1");

                if (!isEnabled) {
                    return null;
                }

                return {
                    channelNumber,
                    trackId: track.id,
                    name: track.name,
                    audioUrl: getTrackAudioUrl(project.id, track.id),
                    volume: Number.isFinite(volume) ? volume : 1,
                };
            })
            .filter((channel): channel is MixChannelForPlayer => {
                return channel !== null;
            });
    }

    function handleLoadMix(): void {
        if (!audioPlayerController?.loadMix) {
            setStatus(statusElement, "Mix playback is not ready yet.");
            return;
        }

        const enabledMixChannels = getEnabledMixChannels();

        if (enabledMixChannels.length === 0) {
            setStatus(statusElement, "Choose at least one enabled channel.");
            return;
        }

        audioPlayerController.loadMix(enabledMixChannels);

        const channelWord = enabledMixChannels.length === 1 ? "channel" : "channels";

        setStatus(
            statusElement,
            `Loaded ${enabledMixChannels.length} ${channelWord} into the mix.`,
        );
    }

    async function handleTrackListClick(event: ClickEventLike): Promise<void> {
        const isLoadMixClick = getIsLoadMixClickFromTarget(event.target);

        if (isLoadMixClick) {
            handleLoadMix();
            return;
        }

        const loadTrackId = getLoadTrackIdFromTarget(event.target);

        if (loadTrackId) {
            handleLoadTrack(loadTrackId);
            return;
        }

        const deleteTrackId = getDeleteTrackIdFromTarget(event.target);

        if (!deleteTrackId) {
            return;
        }

        try {
            setStatus(statusElement, "Deleting track...");
            await tracksApi.deleteTrack(project.id, deleteTrackId);
            await loadTracks();
            setStatus(statusElement, "Track deleted.");
        } catch {
            setStatus(statusElement, "Could not delete track.");
        }
    }

    async function handleDeleteProjectClick(): Promise<void> {
        if (!projectsApi) {
            return;
        }

        const confirmed = confirmDeleteProject(
            "Delete this project and all of its uploaded tracks?",
        );

        if (!confirmed) {
            return;
        }

        try {
            setStatus(statusElement, "Deleting project...");

            await projectsApi.deleteProject(project.id);

            setStatus(statusElement, "Project deleted.");
            onProjectDeleted?.();
        } catch {
            setStatus(statusElement, "Could not delete project.");
        }
    }

    async function init(): Promise<void> {
        trackListElement.addEventListener("click", (event) => {
            return handleTrackListClick(event);
        });

        deleteProjectButton?.addEventListener("click", () => {
            return handleDeleteProjectClick();
        });

        await loadTracks();
    }

    return {
        init,
    };
}