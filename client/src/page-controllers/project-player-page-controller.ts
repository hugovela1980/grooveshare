import type {
    MixChannelSetting,
    MixSettings,
    Project,
    Track,
} from "../types.js";

type TracksApi = {
    getTracksByProjectId: (projectId: string) => Promise<Track[]>;
    deleteTrack: (projectId: string, trackId: string) => Promise<Track>;
    uploadTrack?: (input: {
        projectId: string;
        trackName: string;
        audioFile: File;
    }) => Promise<Track>;
};

type ProjectsApi = {
    deleteProject: (projectId: string) => Promise<Project>;

    saveMixSettings?: (
        projectId: string,
        mixSettings: MixSettings,
    ) => Promise<Project>;
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
    loadMix?: (channels: MixChannelForPlayer[]) => void;
    stop?: () => void;
};

type ChooseAudioFile = () => Promise<File | null>;

type GetTrackNameFromFile = (audioFile: File) => string;

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
    renderTrackList: (
        tracks: Track[],
        mixSettings?: MixSettings,
    ) => string;
    confirmDeleteProject?: (message: string) => boolean;
    onProjectDeleted?: () => void;
    audioPlayerController?: AudioPlayerController;
    getTrackAudioUrl?: (projectId: string, trackId: string) => string;
    chooseAudioFile?: ChooseAudioFile;
    getTrackNameFromFile?: GetTrackNameFromFile;
};

function getDeleteTrackIdFromTarget(target: EventTarget | null): string | null {
    const element = target as ClosestElementLike | null;
    const deleteButton = element?.closest?.("[data-track-delete-button]");

    return deleteButton?.dataset?.trackId ?? null;
}

function getIsLoadMixClickFromTarget(target: EventTarget | null): boolean {
    const element = target as ClosestElementLike | null;
    const loadMixButton = element?.closest?.("[data-load-mix-button]");

    return Boolean(loadMixButton);
}

function getIsAddTrackClickFromTarget(target: EventTarget | null): boolean {
    const element = target as ClosestElementLike | null;
    const addTrackButton = element?.closest?.("[data-track-add-button]");

    return Boolean(addTrackButton);
}

function getDefaultTrackNameFromFile(audioFile: File): string {
    const filename = audioFile.name;
    const extensionStartIndex = filename.lastIndexOf(".");

    if (extensionStartIndex <= 0) {
        return filename;
    }

    return filename.slice(0, extensionStartIndex);
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
    chooseAudioFile = async () => null,
    getTrackNameFromFile = getDefaultTrackNameFromFile,
}: ProjectPlayerPageControllerOptions) {
    let currentTracks: Track[] = [];
    let currentMixSettings: MixSettings | undefined = project.mixSettings;

    async function loadTracks(): Promise<void> {
        try {
            const tracks = await tracksApi.getTracksByProjectId(project.id);
            currentTracks = tracks;
            trackListElement.innerHTML = renderTrackList(
                tracks,
                currentMixSettings,
            );
        } catch {
            trackListElement.innerHTML =
                '<p class="empty-state">Could not load tracks.</p>';
        }
    }

    function getMixSettings(): MixSettings {
        if (!trackListElement.querySelectorAll) {
            return {
                channels: [],
            };
        }

        const channelSlotElements = Array.from(
            trackListElement.querySelectorAll(
                "[data-mix-channel-slot][data-track-id]",
            ),
        );

        const channels = channelSlotElements
            .map((channelSlotElement): MixChannelSetting | null => {
                const trackId =
                    channelSlotElement.dataset?.trackId;

                const channelNumber = Number(
                    channelSlotElement.dataset?.mixChannel,
                );

                if (
                    !trackId ||
                    !Number.isFinite(channelNumber)
                ) {
                    return null;
                }

                const enabledInput =
                    channelSlotElement.querySelector?.(
                        "[data-channel-enabled]",
                    ) as ChannelEnabledInputLike | null;

                const volumeInput =
                    channelSlotElement.querySelector?.(
                        "[data-channel-volume]",
                    ) as ChannelVolumeInputLike | null;

                const volume = Number(
                    volumeInput?.value ?? "1",
                );

                return {
                    channelNumber,
                    trackId,
                    enabled: enabledInput?.checked ?? false,
                    volume: Number.isFinite(volume)
                        ? volume
                        : 1,
                };
            })
            .filter(
                (
                    channel,
                ): channel is MixChannelSetting => {
                    return channel !== null;
                },
            );

        return {
            channels,
        };
    }

    function getEnabledMixChannels(
        mixSettings: MixSettings,
    ): MixChannelForPlayer[] {
        if (!getTrackAudioUrl) {
            return [];
        }

        return mixSettings.channels
            .filter((channel) => channel.enabled)
            .map((channel) => {
                const track = currentTracks.find((currentTrack) => {
                    return currentTrack.id === channel.trackId;
                });

                if (!track) {
                    return null;
                }

                return {
                    channelNumber: channel.channelNumber,
                    trackId: track.id,
                    name: track.name,
                    audioUrl: getTrackAudioUrl(
                        project.id,
                        track.id,
                    ),
                    volume: channel.volume,
                };
            })
            .filter(
                (
                    channel,
                ): channel is MixChannelForPlayer => {
                    return channel !== null;
                },
            );
    }

    async function handleLoadMix(): Promise<void> {
        if (!audioPlayerController?.loadMix) {
            setStatus(
                statusElement,
                "Mix playback is not ready yet.",
            );

            return;
        }

        const mixSettings = getMixSettings();

        try {
            if (projectsApi?.saveMixSettings) {
                const updatedProject =
                    await projectsApi.saveMixSettings(
                        project.id,
                        mixSettings,
                    );

                currentMixSettings =
                    updatedProject.mixSettings ??
                    mixSettings;
            }
        } catch {
            setStatus(
                statusElement,
                "Could not save mix settings.",
            );

            return;
        }

        const enabledMixChannels =
            getEnabledMixChannels(mixSettings);

        if (enabledMixChannels.length === 0) {
            setStatus(
                statusElement,
                "Choose at least one enabled channel.",
            );

            return;
        }

        audioPlayerController.loadMix(
            enabledMixChannels,
        );

        const channelWord =
            enabledMixChannels.length === 1
                ? "channel"
                : "channels";

        setStatus(
            statusElement,
            `Loaded ${enabledMixChannels.length} ${channelWord} into the mix.`,
        );
    }

    async function handleAddTrack(): Promise<void> {
        if (!tracksApi.uploadTrack) {
            setStatus(statusElement, "Track upload is not ready yet.");
            return;
        }

        try {
            const audioFile = await chooseAudioFile();

            if (!audioFile) {
                setStatus(statusElement, "No audio file selected.");
                return;
            }

            setStatus(statusElement, "Uploading track...");

            await tracksApi.uploadTrack({
                projectId: project.id,
                trackName: getTrackNameFromFile(audioFile),
                audioFile,
            });

            await loadTracks();
            setStatus(statusElement, "Track added.");
        } catch {
            setStatus(statusElement, "Could not add track.");
        }
    }

    async function handleTrackListClick(event: ClickEventLike): Promise<void> {
        const isLoadMixClick = getIsLoadMixClickFromTarget(event.target);

        if (isLoadMixClick) {
            await handleLoadMix();
            return;
        }

        const isAddTrackClick = getIsAddTrackClickFromTarget(event.target);

        if (isAddTrackClick) {
            await handleAddTrack();
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
            audioPlayerController?.stop?.();

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