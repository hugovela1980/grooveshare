import {
    canContribute,
    canManageProject,
    canManageTrack,
    createMixPersistenceCoordinator,
    type StorageProvider,
} from "@hugovela/frontend-core";
import {
    setControlBusy,
    setRegionBusy,
    type BusyControlLike,
    type BusyRegionLike,
} from "../ui/async-state.js";
import type {
    MixChannelSetting,
    MixSettings,
    Project,
    ProjectRole,
    Track,
} from "../types.js";

type TracksApi = {
    getTracksByProjectId: (projectId: string) => Promise<Track[]>;
    deleteTrack: (projectId: string, trackId: string) => Promise<Track>;
    updateTrackName?: (
        projectId: string,
        trackId: string,
        name: string,
    ) => Promise<Track>;
    uploadTrack?: (input: {
        projectId: string;
        trackName: string;
        audioFile: File;
    }) => Promise<Track>;
};

type ProjectsApi = {
    deleteProject: (projectId: string) => Promise<Project>;

    updateProjectDetails?: (
        projectId: string,
        projectInput: {
            title?: string;
            description?: string;
        },
    ) => Promise<Project>;

    saveMixSettings?: (
        projectId: string,
        mixSettings: MixSettings,
    ) => Promise<Project>;
};

type TrackListEventLike = {
    target: EventTarget | null;
};

type FormEventLike = {
    preventDefault?: () => void;
};

type MixChannelForPlayer = {
    channelNumber: number;
    trackId: string;
    name: string;
    audioUrl: string;
    volume: number;
    enabled: boolean;
};

type AudioPlayerController = {
    loadMix?: (channels: MixChannelForPlayer[]) => void;
    setChannelVolume?: (channelNumber: number, volume: number) => boolean;
    setChannelEnabled?: (channelNumber: number, enabled: boolean) => boolean;
    setTrackName?: (trackId: string, name: string) => boolean;
    stop?: () => void;
};

type ChooseAudioFile = () => Promise<File | null>;

type GetTrackNameFromFile = (audioFile: File) => string;

type TimeoutId = ReturnType<typeof globalThis.setTimeout>;
type ScheduleTimeout = (handler: () => void, delayMs: number) => TimeoutId;
type ClearScheduledTimeout = (timeoutId: TimeoutId) => void;

type TrackListElementLike = BusyRegionLike & {
    innerHTML: string;

    addEventListener: (
        eventName: "click" | "input" | "change",
        handler: (
            event: TrackListEventLike,
        ) => void | Promise<void>,
    ) => void;

    querySelector?: (
        selector: string,
    ) => unknown;

    querySelectorAll?: (
        selector: string,
    ) => ArrayLike<ChannelSlotElementLike>;
};

type ButtonElementLike = BusyControlLike & {
    addEventListener: (
        eventName: "click",
        handler: () => void | Promise<void>,
    ) => void;
};

type TextElementLike = {
    textContent: string | null;
};

type FormElementLike = {
    addEventListener: (
        eventName: "submit",
        handler: (event: FormEventLike) => void | Promise<void>,
    ) => void;
};

type ValueInputLike = {
    value: string;
    focus?: () => void;
    select?: () => void;
};

type DialogElementLike = VisibilityElementLike;

type TrackActionButtonLike = BusyControlLike & {
    dataset?: {
        trackId?: string;
    };
};

type ClosestElementLike = {
    closest?: (selector: string) => TrackActionButtonLike | null;
};

type VisibilityElementLike = {
    hidden: boolean | string;
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

type TrackListTargetLike = {
    value?: string;
    checked?: boolean;
    textContent?: string | null;
    blur?: () => void | Promise<void>;

    dataset?: {
        channelVolume?: string;
        channelEnabled?: string;
        mixChannel?: string;
        trackId?: string;
    };
};

type ProjectPlayerPageControllerOptions = {
    project: Project;
    trackListElement: TrackListElementLike;
    loadingElement?: VisibilityElementLike | null;
    contentElement?: VisibilityElementLike | null;
    statusElement?: TextElementLike | null;
    deleteProjectButton?: ButtonElementLike | null;
    projectTitleElement?: TextElementLike | null;
    projectMobileTitleElement?: TextElementLike | null;
    projectDescriptionElement?: TextElementLike | null;
    projectEditModal?: DialogElementLike | null;
    projectEditForm?: FormElementLike | null;
    projectEditTitleInput?: ValueInputLike | null;
    projectEditDescriptionInput?: ValueInputLike | null;
    projectEditSaveButton?: ButtonElementLike | null;
    projectEditCancelButton?: ButtonElementLike | null;
    projectEditCloseButton?: ButtonElementLike | null;
    projectEditStatusElement?: TextElementLike | null;
    trackEditModal?: DialogElementLike | null;
    trackEditForm?: FormElementLike | null;
    trackEditNameInput?: ValueInputLike | null;
    trackEditSaveButton?: ButtonElementLike | null;
    trackEditCancelButton?: ButtonElementLike | null;
    trackEditCloseButton?: ButtonElementLike | null;
    trackEditStatusElement?: TextElementLike | null;
    tracksApi: TracksApi;
    projectsApi?: ProjectsApi;
    renderTrackList: (
        tracks: Track[],
        mixSettings?: MixSettings,
        context?: {
            role: ProjectRole;
            currentUserId: string | null;
        },
    ) => string;
    projectRole?: ProjectRole;
    currentUserId?: string | null;
    storageProvider?: StorageProvider | null;
    confirmDeleteProject?: (message: string) => boolean;
    confirmDeleteTrack?: (message: string) => boolean;
    onProjectDeleted?: () => void;
    audioPlayerController?: AudioPlayerController;
    getTrackAudioUrl?: (projectId: string, trackId: string) => string;
    chooseAudioFile?: ChooseAudioFile;
    getTrackNameFromFile?: GetTrackNameFromFile;
    mixPersistenceDelayMs?: number;
    scheduleTimeout?: ScheduleTimeout;
    clearScheduledTimeout?: ClearScheduledTimeout;
};

function getDeleteTrackButtonFromTarget(
    target: EventTarget | null,
): TrackActionButtonLike | null {
    const element = target as ClosestElementLike | null;
    return element?.closest?.("[data-track-delete-button]") ?? null;
}

function getEditTrackButtonFromTarget(
    target: EventTarget | null,
): TrackActionButtonLike | null {
    const element = target as ClosestElementLike | null;
    return element?.closest?.("[data-track-edit-button]") ?? null;
}

function getAddTrackButtonFromTarget(
    target: EventTarget | null,
): TrackActionButtonLike | null {
    const element = target as ClosestElementLike | null;
    return element?.closest?.("[data-track-add-button]") ?? null;
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
    loadingElement,
    contentElement,
    statusElement,
    deleteProjectButton,
    projectTitleElement,
    projectMobileTitleElement,
    projectDescriptionElement,
    projectEditModal,
    projectEditForm,
    projectEditTitleInput,
    projectEditDescriptionInput,
    projectEditSaveButton,
    projectEditCancelButton,
    projectEditCloseButton,
    projectEditStatusElement,
    trackEditModal,
    trackEditForm,
    trackEditNameInput,
    trackEditSaveButton,
    trackEditCancelButton,
    trackEditCloseButton,
    trackEditStatusElement,
    tracksApi,
    projectsApi,
    renderTrackList,
    projectRole = project.role ?? "owner",
    currentUserId = null,
    storageProvider = null,
    confirmDeleteProject = globalThis.confirm,
    confirmDeleteTrack = globalThis.confirm,
    onProjectDeleted,
    audioPlayerController,
    getTrackAudioUrl,
    chooseAudioFile = async () => null,
    getTrackNameFromFile = getDefaultTrackNameFromFile,
    mixPersistenceDelayMs = 2000,
    scheduleTimeout = globalThis.setTimeout.bind(globalThis),
    clearScheduledTimeout = globalThis.clearTimeout.bind(globalThis),
}: ProjectPlayerPageControllerOptions) {
    let currentTracks: Track[] = [];
    const saveProjectMixSettings = projectsApi?.saveMixSettings;
    const mixPersistence = createMixPersistenceCoordinator({
        projectId: project.id,
        projectRole,
        currentUserId,
        initialMixSettings: project.mixSettings,
        storageProvider,
        saveServerMixSettings: saveProjectMixSettings
            ? async (mixSettings) => {
                const updatedProject = await saveProjectMixSettings(
                    project.id,
                    mixSettings,
                );

                return updatedProject.mixSettings ?? mixSettings;
            }
            : undefined,
        persistenceDelayMs: mixPersistenceDelayMs,
        scheduleTimeout,
        clearScheduledTimeout,
        onPersistenceError: () => {
            setStatus(statusElement, "Could not save mix settings.");
        },
        onPersistedMixSettings: (mixSettings) => {
            project.mixSettings = mixSettings;
        },
    });
    let currentProjectTitle = project.title;
    let currentProjectDescription = project.description;
    let trackMutationInFlight = false;
    let trackEditInFlight = false;
    let projectEditInFlight = false;
    let projectDeletionInFlight = false;
    let activeTrackEditId: string | null = null;

    async function loadTracks({
        revealPlayer = false,
    }: { revealPlayer?: boolean } = {}): Promise<void> {
        setRegionBusy(trackListElement, true);

        try {
            const tracks = await tracksApi.getTracksByProjectId(project.id);
            currentTracks = tracks;
            trackListElement.innerHTML = renderTrackList(
                currentTracks,
                mixPersistence.getCurrentMixSettings(),
                {
                    role: projectRole,
                    currentUserId,
                },
            );
            prepareCurrentMixForPlayback();
        } catch {
            trackListElement.innerHTML =
                '<p class="empty-state">Could not load tracks.</p>';
            setStatus(statusElement, "Could not load project tracks.");
        } finally {
            setRegionBusy(trackListElement, false);

            if (revealPlayer) {
                if (loadingElement) {
                    loadingElement.hidden = true;
                }

                if (contentElement) {
                    contentElement.hidden = false;
                }
            }
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

    function getMixChannelsForPlayer(
        mixSettings: MixSettings,
    ): MixChannelForPlayer[] {
        if (!getTrackAudioUrl) {
            return [];
        }

        return mixSettings.channels
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
                    enabled: channel.enabled,
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

    function prepareCurrentMixForPlayback(): void {
        if (!audioPlayerController?.loadMix) {
            return;
        }

        const mixSettings = getMixSettings();
        const mixChannels = getMixChannelsForPlayer(mixSettings);

        audioPlayerController.loadMix(mixChannels);
    }

    function normalizeSingleLineText(value: string): string {
        return value.trim().replace(/\s+/g, " ");
    }

    function replaceCurrentTrackName(
        trackId: string,
        name: string,
    ): void {
        currentTracks = currentTracks.map((currentTrack) => {
            if (currentTrack.id !== trackId) {
                return currentTrack;
            }

            return {
                ...currentTrack,
                name,
            };
        });
    }

    function updateRenderedTrackName(trackId: string, name: string): void {
        const trackNameElement = trackListElement.querySelector?.(
            `[data-track-name-display][data-track-id="${trackId}"]`,
        ) as TextElementLike | null;

        if (trackNameElement) {
            trackNameElement.textContent = name;
        }
    }

    function setDialogOpen(
        dialog: DialogElementLike | null | undefined,
        isOpen: boolean,
    ): void {
        if (dialog) {
            dialog.hidden = !isOpen;
        }
    }

    function openProjectEditor(): void {
        if (
            !canManageProject(projectRole) ||
            !projectEditModal ||
            !projectEditTitleInput ||
            !projectEditDescriptionInput
        ) {
            return;
        }

        projectEditTitleInput.value = currentProjectTitle;
        projectEditDescriptionInput.value = currentProjectDescription;
        setStatus(projectEditStatusElement, "");
        setDialogOpen(projectEditModal, true);
        projectEditTitleInput.focus?.();
        projectEditTitleInput.select?.();
    }

    function closeProjectEditor(): void {
        if (projectEditInFlight) {
            return;
        }

        setDialogOpen(projectEditModal, false);
        setStatus(projectEditStatusElement, "");
    }

    async function handleProjectEditSubmit(
        event: FormEventLike,
    ): Promise<void> {
        event.preventDefault?.();

        if (
            projectEditInFlight ||
            !canManageProject(projectRole) ||
            !projectsApi?.updateProjectDetails ||
            !projectEditTitleInput ||
            !projectEditDescriptionInput
        ) {
            return;
        }

        const title = normalizeSingleLineText(projectEditTitleInput.value);
        const description = projectEditDescriptionInput.value.trim();

        if (!title) {
            setStatus(projectEditStatusElement, "Project title is required.");
            projectEditTitleInput.focus?.();
            return;
        }

        if (
            title === currentProjectTitle &&
            description === currentProjectDescription
        ) {
            closeProjectEditor();
            return;
        }

        projectEditInFlight = true;
        setControlBusy(projectEditSaveButton, true);
        setStatus(projectEditStatusElement, "Saving project details...");

        try {
            const updatedProject = await projectsApi.updateProjectDetails(
                project.id,
                {
                    title,
                    description,
                },
            );

            currentProjectTitle = updatedProject.title;
            currentProjectDescription = updatedProject.description;
            project.title = updatedProject.title;
            project.description = updatedProject.description;

            if (projectTitleElement) {
                projectTitleElement.textContent = updatedProject.title;
            }

            if (projectMobileTitleElement) {
                projectMobileTitleElement.textContent = updatedProject.title;
            }

            if (projectDescriptionElement) {
                projectDescriptionElement.textContent = updatedProject.description;
            }

            setStatus(statusElement, "Project details updated.");
            setDialogOpen(projectEditModal, false);
            setStatus(projectEditStatusElement, "");
        } catch {
            setStatus(projectEditStatusElement, "Could not save project details.");
        } finally {
            setControlBusy(projectEditSaveButton, false);
            projectEditInFlight = false;
        }
    }

    function openTrackEditor(track: Track): void {
        if (
            !canManageTrack({
                role: projectRole,
                currentUserId,
                track,
            }) ||
            !trackEditModal ||
            !trackEditNameInput
        ) {
            return;
        }

        activeTrackEditId = track.id;
        trackEditNameInput.value = track.name;
        setStatus(trackEditStatusElement, "");
        setDialogOpen(trackEditModal, true);
        trackEditNameInput.focus?.();
        trackEditNameInput.select?.();
    }

    function closeTrackEditor(): void {
        if (trackEditInFlight) {
            return;
        }

        activeTrackEditId = null;
        setDialogOpen(trackEditModal, false);
        setStatus(trackEditStatusElement, "");
    }

    async function handleTrackEditSubmit(
        event: FormEventLike,
    ): Promise<void> {
        event.preventDefault?.();

        if (
            trackEditInFlight ||
            !activeTrackEditId ||
            !trackEditNameInput ||
            !tracksApi.updateTrackName
        ) {
            return;
        }

        const track = currentTracks.find((currentTrack) => {
            return currentTrack.id === activeTrackEditId;
        });

        if (
            !track ||
            !canManageTrack({
                role: projectRole,
                currentUserId,
                track,
            })
        ) {
            setStatus(trackEditStatusElement, "Track access denied.");
            return;
        }

        const nextName = normalizeSingleLineText(trackEditNameInput.value);

        if (!nextName) {
            setStatus(trackEditStatusElement, "Track name is required.");
            trackEditNameInput.focus?.();
            return;
        }

        if (nextName === track.name) {
            closeTrackEditor();
            return;
        }

        trackEditInFlight = true;
        setControlBusy(trackEditSaveButton, true);
        setStatus(trackEditStatusElement, "Saving track name...");

        try {
            const updatedTrack = await tracksApi.updateTrackName(
                project.id,
                track.id,
                nextName,
            );

            replaceCurrentTrackName(track.id, updatedTrack.name);
            updateRenderedTrackName(track.id, updatedTrack.name);
            audioPlayerController?.setTrackName?.(
                track.id,
                updatedTrack.name,
            );

            setStatus(statusElement, "Track name updated.");
            activeTrackEditId = null;
            setDialogOpen(trackEditModal, false);
            setStatus(trackEditStatusElement, "");
        } catch {
            setStatus(trackEditStatusElement, "Could not save track name.");
        } finally {
            setControlBusy(trackEditSaveButton, false);
            trackEditInFlight = false;
        }
    }

    function updateLoadedChannelVolume(
        channelNumber: number,
        volume: number,
    ): void {
        audioPlayerController?.setChannelVolume?.(channelNumber, volume);
    }

    function updateLoadedChannelEnabled(
        channelNumber: number,
        enabled: boolean,
    ): void {
        audioPlayerController?.setChannelEnabled?.(channelNumber, enabled);
    }

    function handleTrackListInput(
        event: TrackListEventLike,
    ): void {
        const target =
            event.target as TrackListTargetLike | null;

        if (!target?.dataset) {
            return;
        }

        const isVolumeInput =
            target.dataset.channelVolume !== undefined;

        const isEnabledInput =
            target.dataset.channelEnabled !== undefined;

        if (!isVolumeInput && !isEnabledInput) {
            return;
        }

        if (isVolumeInput) {
            const volume = Number(target.value ?? "0");
            const channelNumberText = target.dataset.mixChannel;
            const channelNumber = Number(channelNumberText);

            if (
                Number.isFinite(volume) &&
                Number.isFinite(channelNumber) &&
                channelNumberText
            ) {
                const volumeValueElement =
                    trackListElement.querySelector?.(
                        `[data-channel-volume-value][data-mix-channel="${channelNumberText}"]`,
                    ) as TextElementLike | null;

                if (volumeValueElement) {
                    volumeValueElement.textContent =
                        `${Math.round(volume * 100)}%`;
                }

                updateLoadedChannelVolume(channelNumber, volume);
            }
        }

        if (isEnabledInput) {
            const channelNumberText = target.dataset.mixChannel;
            const channelNumber = Number(channelNumberText);

            if (Number.isFinite(channelNumber) && channelNumberText) {
                updateLoadedChannelEnabled(
                    channelNumber,
                    target.checked ?? false,
                );
            }
        }

    }

    async function persistCurrentMixSettings(): Promise<void> {
        mixPersistence.persist(getMixSettings());
    }

    async function flushPendingMixSettings(): Promise<void> {
        await mixPersistence.flush();
    }

    async function handleTrackListChange(
        event: TrackListEventLike,
    ): Promise<void> {
        const target = event.target as TrackListTargetLike | null;

        if (!target?.dataset) {
            return;
        }

        const isVolumeInput =
            target.dataset.channelVolume !== undefined;

        const isEnabledInput =
            target.dataset.channelEnabled !== undefined;

        if (!isVolumeInput && !isEnabledInput) {
            return;
        }

        await persistCurrentMixSettings();
    }

    async function handleAddTrack(
        addTrackButton: TrackActionButtonLike | null,
    ): Promise<void> {
        if (!canContribute(projectRole)) {
            setStatus(statusElement, "Project access denied.");
            return;
        }

        if (!tracksApi.uploadTrack) {
            setStatus(statusElement, "Track upload is not ready yet.");
            return;
        }

        if (trackMutationInFlight) {
            return;
        }

        trackMutationInFlight = true;
        setControlBusy(addTrackButton, true);

        try {
            const audioFile = await chooseAudioFile();

            if (!audioFile) {
                setStatus(statusElement, "No audio file selected.");
                return;
            }

            setStatus(statusElement, "Uploading track...");
            setRegionBusy(trackListElement, true);

            await tracksApi.uploadTrack({
                projectId: project.id,
                trackName: getTrackNameFromFile(audioFile),
                audioFile,
            });

            await loadTracks();
            setStatus(statusElement, "Track added.");
        } catch {
            setStatus(statusElement, "Could not add track.");
        } finally {
            setRegionBusy(trackListElement, false);
            setControlBusy(addTrackButton, false);
            trackMutationInFlight = false;
        }
    }

    async function handleTrackListClick(
        event: TrackListEventLike,
    ): Promise<void> {
        const editTrackButton = getEditTrackButtonFromTarget(event.target);
        const editTrackId = editTrackButton?.dataset?.trackId;

        if (editTrackId) {
            const trackToEdit = currentTracks.find((track) => {
                return track.id === editTrackId;
            });

            if (!trackToEdit) {
                setStatus(statusElement, "Track not found.");
                return;
            }

            openTrackEditor(trackToEdit);
            return;
        }

        const addTrackButton = getAddTrackButtonFromTarget(event.target);

        if (addTrackButton) {
            await handleAddTrack(addTrackButton);
            return;
        }

        const deleteTrackButton = getDeleteTrackButtonFromTarget(event.target);
        const deleteTrackId = deleteTrackButton?.dataset?.trackId;

        if (!deleteTrackId) {
            return;
        }

        const trackToDelete = currentTracks.find((track) => {
            return track.id === deleteTrackId;
        });

        if (
            !trackToDelete ||
            !canManageTrack({
                role: projectRole,
                currentUserId,
                track: trackToDelete,
            })
        ) {
            setStatus(statusElement, "Track access denied.");
            return;
        }

        if (trackMutationInFlight) {
            return;
        }

        const confirmed = confirmDeleteTrack(
            `Delete "${trackToDelete.name}" from this project?`,
        );

        if (!confirmed) {
            return;
        }

        trackMutationInFlight = true;
        setControlBusy(deleteTrackButton, true);
        setRegionBusy(trackListElement, true);

        try {
            setStatus(statusElement, "Deleting track...");
            await tracksApi.deleteTrack(project.id, deleteTrackId);
            await loadTracks();
            setStatus(statusElement, "Track deleted.");
        } catch {
            setStatus(statusElement, "Could not delete track.");
        } finally {
            setRegionBusy(trackListElement, false);
            setControlBusy(deleteTrackButton, false);
            trackMutationInFlight = false;
        }
    }

    async function handleDeleteProjectClick(): Promise<void> {
        if (!projectsApi || !canManageProject(projectRole)) {
            return;
        }

        if (projectDeletionInFlight) {
            return;
        }

        const confirmed = confirmDeleteProject(
            `Delete "${currentProjectTitle}" and all of its uploaded tracks?`,
        );

        if (!confirmed) {
            return;
        }

        projectDeletionInFlight = true;
        setControlBusy(deleteProjectButton, true);

        try {
            audioPlayerController?.stop?.();

            setStatus(statusElement, "Deleting project...");
            await projectsApi.deleteProject(project.id);

            mixPersistence.clearRecovery();

            setStatus(statusElement, "Project deleted.");
            onProjectDeleted?.();
        } catch {
            setStatus(statusElement, "Could not delete project.");
        } finally {
            setControlBusy(deleteProjectButton, false);
            projectDeletionInFlight = false;
        }
    }

    async function init(): Promise<void> {
        trackListElement.addEventListener("click", (event) => {
            return handleTrackListClick(event);
        });

        trackListElement.addEventListener("input", (event) => {
            handleTrackListInput(event);
        });

        trackListElement.addEventListener("change", (event) => {
            return handleTrackListChange(event);
        });

        projectEditForm?.addEventListener("submit", (event) => {
            return handleProjectEditSubmit(event);
        });

        projectEditCancelButton?.addEventListener("click", () => {
            closeProjectEditor();
        });

        projectEditCloseButton?.addEventListener("click", () => {
            closeProjectEditor();
        });

        trackEditForm?.addEventListener("submit", (event) => {
            return handleTrackEditSubmit(event);
        });

        trackEditCancelButton?.addEventListener("click", () => {
            closeTrackEditor();
        });

        trackEditCloseButton?.addEventListener("click", () => {
            closeTrackEditor();
        });

        deleteProjectButton?.addEventListener("click", () => {
            return handleDeleteProjectClick();
        });

        await loadTracks({ revealPlayer: true });

        if (mixPersistence.hasRecoveredPendingMix()) {
            mixPersistence.schedulePendingPersistence();
        }
    }

    return {
        init,
        flushPendingMixSettings,
        openProjectEditor,
    };
}