import {
    loadViewerMixSettings,
    saveViewerMixSettings,
} from "../storage/viewer-mix-storage.js";
import {
    clearPendingMixSettings,
    loadPendingMixSettings,
    savePendingMixSettings,
} from "../storage/pending-mix-storage.js";
import {
    canContribute,
    canManageProject,
    canManageTrack,
    canPersistMix,
} from "../permissions/project-permissions.js";
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
    key?: string;
    preventDefault?: () => void;
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
    setChannelVolume?: (channelNumber: number, volume: number) => boolean;
    stop?: () => void;
};

type ChooseAudioFile = () => Promise<File | null>;

type GetTrackNameFromFile = (audioFile: File) => string;

type SelectAllText = (element: unknown) => void;

type TimeoutId = ReturnType<typeof globalThis.setTimeout>;
type ScheduleTimeout = (handler: () => void, delayMs: number) => TimeoutId;
type ClearScheduledTimeout = (timeoutId: TimeoutId) => void;

type TrackListElementLike = {
    innerHTML: string;

    addEventListener: (
        eventName: "click" | "input" | "change" | "keydown" | "focusout",
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

type ButtonElementLike = {
    addEventListener: (
        eventName: "click",
        handler: () => void | Promise<void>,
    ) => void;
};

type TextElementLike = {
    textContent: string | null;
};

type EditableTextEventLike = {
    key?: string;
    preventDefault?: () => void;
};

type EditableTextElementLike = TextElementLike & {
    addEventListener: (
        eventName: "click" | "keydown" | "blur",
        handler: (
            event: EditableTextEventLike,
        ) => void | Promise<void>,
    ) => void;
    blur?: () => void | Promise<void>;
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

type ClassListLike = {
    add: (className: string) => void;
    remove: (className: string) => void;
};

type LoadMixButtonLike = {
    classList?: ClassListLike;
};

type TrackListTargetLike = {
    value?: string;
    textContent?: string | null;
    blur?: () => void | Promise<void>;

    dataset?: {
        channelVolume?: string;
        channelEnabled?: string;
        mixChannel?: string;
        trackNameEditor?: string;
        trackId?: string;
    };
};

type ProjectPlayerPageControllerOptions = {
    project: Project;
    trackListElement: TrackListElementLike;
    statusElement?: TextElementLike | null;
    deleteProjectButton?: ButtonElementLike | null;
    projectTitleElement?: EditableTextElementLike | null;
    projectDescriptionElement?: EditableTextElementLike | null;
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
    confirmDeleteProject?: (message: string) => boolean;
    onProjectDeleted?: () => void;
    audioPlayerController?: AudioPlayerController;
    getTrackAudioUrl?: (projectId: string, trackId: string) => string;
    chooseAudioFile?: ChooseAudioFile;
    getTrackNameFromFile?: GetTrackNameFromFile;
    selectAllText?: SelectAllText;
    mixPersistenceDelayMs?: number;
    scheduleTimeout?: ScheduleTimeout;
    clearScheduledTimeout?: ClearScheduledTimeout;
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

function selectAllEditableText(element: unknown): void {
    if (
        typeof document === "undefined" ||
        typeof window === "undefined"
    ) {
        return;
    }

    const selection = window.getSelection();

    if (!selection) {
        return;
    }

    const range = document.createRange();
    range.selectNodeContents(element as Node);
    selection.removeAllRanges();
    selection.addRange(range);
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
    projectTitleElement,
    projectDescriptionElement,
    tracksApi,
    projectsApi,
    renderTrackList,
    projectRole = project.role ?? "owner",
    currentUserId = null,
    confirmDeleteProject = globalThis.confirm,
    onProjectDeleted,
    audioPlayerController,
    getTrackAudioUrl,
    chooseAudioFile = async () => null,
    getTrackNameFromFile = getDefaultTrackNameFromFile,
    selectAllText = selectAllEditableText,
    mixPersistenceDelayMs = 2000,
    scheduleTimeout = globalThis.setTimeout.bind(globalThis),
    clearScheduledTimeout = globalThis.clearTimeout.bind(globalThis),
}: ProjectPlayerPageControllerOptions) {
    let currentTracks: Track[] = [];
    const pendingServerMixSettings =
        projectRole !== "viewer" && currentUserId && canPersistMix(projectRole)
            ? loadPendingMixSettings(currentUserId, project.id)
            : null;
    let currentMixSettings: MixSettings | undefined = projectRole === "viewer"
        ? loadViewerMixSettings(project.id) ?? project.mixSettings
        : pendingServerMixSettings ?? project.mixSettings;
    let lastLoadedMixSettings: MixSettings | null = null;
    let pendingMixRevision = pendingServerMixSettings ? 1 : 0;
    let persistedMixRevision = 0;
    let persistenceTimerId: TimeoutId | null = null;
    let persistenceInFlight: Promise<boolean> | null = null;
    let currentProjectTitle = project.title;
    let currentProjectDescription = project.description;
    const LOAD_MIX_CURRENT_CLASS = "mix-channel-panel__load-button--current";

    async function loadTracks(): Promise<void> {
        lastLoadedMixSettings = null;

        try {
            const tracks = await tracksApi.getTracksByProjectId(project.id);
            currentTracks = tracks;
            trackListElement.innerHTML = renderTrackList(
                currentTracks,
                currentMixSettings,
                {
                    role: projectRole,
                    currentUserId,
                },
            );
            setLoadMixButtonCurrent(false);
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

    function areMixSettingsEqual(
        left: MixSettings,
        right: MixSettings,
    ): boolean {
        if (left.channels.length !== right.channels.length) {
            return false;
        }

        return left.channels.every((leftChannel) => {
            const rightChannel = right.channels.find((channel) => {
                return (
                    channel.channelNumber === leftChannel.channelNumber &&
                    channel.trackId === leftChannel.trackId
                );
            });

            if (!rightChannel) {
                return false;
            }

            return (
                rightChannel.enabled === leftChannel.enabled &&
                rightChannel.volume === leftChannel.volume
            );
        });
    }

    function getLoadMixButton(): LoadMixButtonLike | null {
        return (
            trackListElement.querySelector?.(
                "[data-load-mix-button]",
            ) as LoadMixButtonLike | null
        ) ?? null;
    }

    function setLoadMixButtonCurrent(
        isCurrent: boolean,
    ): void {
        const loadMixButton = getLoadMixButton();

        if (!loadMixButton?.classList) {
            return;
        }

        if (isCurrent) {
            loadMixButton.classList.add(
                LOAD_MIX_CURRENT_CLASS,
            );

            return;
        }

        loadMixButton.classList.remove(
            LOAD_MIX_CURRENT_CLASS,
        );
    }

    function updateLoadMixButtonCurrentState(): void {
        if (!lastLoadedMixSettings) {
            setLoadMixButtonCurrent(false);
            return;
        }

        const currentSettings = getMixSettings();

        setLoadMixButtonCurrent(
            areMixSettingsEqual(
                currentSettings,
                lastLoadedMixSettings,
            ),
        );
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

    function normalizeInlineText(value: string): string {
        return value.trim().replace(/\s+/g, " ");
    }

    function getTrackNameEditorTarget(
        event: TrackListEventLike,
    ): TrackListTargetLike | null {
        const target = event.target as TrackListTargetLike | null;

        if (
            !target?.dataset ||
            target.dataset.trackNameEditor === undefined ||
            !target.dataset.trackId
        ) {
            return null;
        }

        return target;
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

    async function commitTrackName(
        target: TrackListTargetLike,
    ): Promise<void> {
        const trackId = target.dataset?.trackId;

        if (!trackId) {
            return;
        }

        const track = currentTracks.find((currentTrack) => {
            return currentTrack.id === trackId;
        });

        if (!track) {
            return;
        }

        if (
            !canManageTrack({
                role: projectRole,
                currentUserId,
                track,
            })
        ) {
            target.textContent = track.name;
            return;
        }

        const previousName = track.name;
        const editedName = normalizeInlineText(target.textContent ?? "");
        const nextName = editedName || previousName;

        target.textContent = nextName;

        if (nextName === previousName) {
            return;
        }

        replaceCurrentTrackName(trackId, nextName);

        if (!tracksApi.updateTrackName) {
            return;
        }

        try {
            const updatedTrack = await tracksApi.updateTrackName(
                project.id,
                trackId,
                nextName,
            );

            replaceCurrentTrackName(trackId, updatedTrack.name);
            target.textContent = updatedTrack.name;
        } catch {
            replaceCurrentTrackName(trackId, previousName);
            target.textContent = previousName;
            setStatus(statusElement, "Could not save track name.");
        }
    }

    async function handleTrackListKeydown(
        event: TrackListEventLike,
    ): Promise<void> {
        const trackNameEditor = getTrackNameEditorTarget(event);

        if (!trackNameEditor || event.key !== "Enter") {
            return;
        }

        event.preventDefault?.();
        await trackNameEditor.blur?.();
    }

    async function handleTrackListFocusOut(
        event: TrackListEventLike,
    ): Promise<void> {
        const trackNameEditor = getTrackNameEditorTarget(event);

        if (!trackNameEditor) {
            return;
        }

        await commitTrackName(trackNameEditor);
    }

    async function commitProjectTitle(): Promise<void> {
        if (!projectTitleElement || !canManageProject(projectRole)) {
            return;
        }

        const previousTitle = currentProjectTitle;
        const editedTitle = normalizeInlineText(
            projectTitleElement.textContent ?? "",
        );

        if (!editedTitle) {
            projectTitleElement.textContent = previousTitle;
            return;
        }

        projectTitleElement.textContent = editedTitle;

        if (editedTitle === previousTitle) {
            return;
        }

        currentProjectTitle = editedTitle;

        if (!projectsApi?.updateProjectDetails) {
            return;
        }

        try {
            const updatedProject = await projectsApi.updateProjectDetails(
                project.id,
                {
                    title: editedTitle,
                },
            );

            currentProjectTitle = updatedProject.title;
            project.title = updatedProject.title;
            projectTitleElement.textContent = updatedProject.title;
        } catch {
            currentProjectTitle = previousTitle;
            projectTitleElement.textContent = previousTitle;
            setStatus(statusElement, "Could not save project title.");
        }
    }

    async function commitProjectDescription(): Promise<void> {
        if (!projectDescriptionElement || !canManageProject(projectRole)) {
            return;
        }

        const previousDescription = currentProjectDescription;
        const editedDescription = normalizeInlineText(
            projectDescriptionElement.textContent ?? "",
        );

        projectDescriptionElement.textContent = editedDescription;

        if (editedDescription === previousDescription) {
            return;
        }

        currentProjectDescription = editedDescription;

        if (!projectsApi?.updateProjectDetails) {
            return;
        }

        try {
            const updatedProject = await projectsApi.updateProjectDetails(
                project.id,
                {
                    description: editedDescription,
                },
            );

            currentProjectDescription = updatedProject.description;
            project.description = updatedProject.description;
            projectDescriptionElement.textContent = updatedProject.description;
        } catch {
            currentProjectDescription = previousDescription;
            projectDescriptionElement.textContent = previousDescription;
            setStatus(statusElement, "Could not save project description.");
        }
    }

    function registerProjectDetailEditors(): void {
        if (!canManageProject(projectRole)) {
            return;
        }

        projectTitleElement?.addEventListener("click", () => {
            selectAllText(projectTitleElement);
        });

        projectTitleElement?.addEventListener("keydown", async (event) => {
            if (event.key !== "Enter") {
                return;
            }

            event.preventDefault?.();
            await projectTitleElement.blur?.();
        });

        projectTitleElement?.addEventListener("blur", () => {
            return commitProjectTitle();
        });

        projectDescriptionElement?.addEventListener("click", () => {
            selectAllText(projectDescriptionElement);
        });

        projectDescriptionElement?.addEventListener("keydown", async (event) => {
            if (event.key !== "Enter") {
                return;
            }

            event.preventDefault?.();
            await projectDescriptionElement.blur?.();
        });

        projectDescriptionElement?.addEventListener("blur", () => {
            return commitProjectDescription();
        });
    }

    function updateLoadedChannelVolume(
        channelNumber: number,
        volume: number,
    ): void {
        const didUpdateLoadedChannel =
            audioPlayerController?.setChannelVolume?.(channelNumber, volume) ??
            false;

        if (!didUpdateLoadedChannel || !lastLoadedMixSettings) {
            return;
        }

        lastLoadedMixSettings = {
            channels: lastLoadedMixSettings.channels.map((channel) => {
                if (channel.channelNumber !== channelNumber) {
                    return channel;
                }

                return {
                    ...channel,
                    volume,
                };
            }),
        };
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

        updateLoadMixButtonCurrentState();
    }

    function canUsePendingMixStorage(): boolean {
        return Boolean(
            projectRole !== "viewer" &&
            currentUserId &&
            canPersistMix(projectRole),
        );
    }

    function clearPersistenceTimer(): void {
        if (persistenceTimerId === null) {
            return;
        }

        clearScheduledTimeout(persistenceTimerId);
        persistenceTimerId = null;
    }

    function rememberPendingMixSettings(mixSettings: MixSettings): void {
        currentMixSettings = mixSettings;
        pendingMixRevision += 1;

        if (!canUsePendingMixStorage() || !currentUserId) {
            return;
        }

        savePendingMixSettings(
            currentUserId,
            project.id,
            mixSettings,
        );
    }

    async function savePendingMixToServer(): Promise<boolean> {
        const saveMixSettings = projectsApi?.saveMixSettings;

        if (
            projectRole === "viewer" ||
            !canPersistMix(projectRole) ||
            !saveMixSettings ||
            !currentMixSettings
        ) {
            return true;
        }

        if (persistenceInFlight) {
            const didSave = await persistenceInFlight;

            if (!didSave) {
                return false;
            }

            if (pendingMixRevision > persistedMixRevision) {
                return savePendingMixToServer();
            }

            return true;
        }

        if (pendingMixRevision <= persistedMixRevision) {
            return true;
        }

        const revisionToSave = pendingMixRevision;
        const mixSettingsToSave = currentMixSettings;

        persistenceInFlight = (async () => {
            try {
                const updatedProject = await saveMixSettings(
                    project.id,
                    mixSettingsToSave,
                );

                persistedMixRevision = Math.max(
                    persistedMixRevision,
                    revisionToSave,
                );

                if (pendingMixRevision === revisionToSave) {
                    currentMixSettings =
                        updatedProject.mixSettings ?? mixSettingsToSave;
                    project.mixSettings = currentMixSettings;

                    if (currentUserId) {
                        clearPendingMixSettings(
                            currentUserId,
                            project.id,
                        );
                    }
                }

                return true;
            } catch {
                setStatus(statusElement, "Could not save mix settings.");
                return false;
            } finally {
                persistenceInFlight = null;
            }
        })();

        return persistenceInFlight;
    }

    function schedulePendingMixPersistence(): void {
        if (
            projectRole === "viewer" ||
            !canPersistMix(projectRole) ||
            !projectsApi?.saveMixSettings
        ) {
            return;
        }

        clearPersistenceTimer();

        persistenceTimerId = scheduleTimeout(() => {
            persistenceTimerId = null;
            void savePendingMixToServer();
        }, mixPersistenceDelayMs);
    }

    async function persistCurrentMixSettings(): Promise<void> {
        const mixSettings = getMixSettings();

        if (projectRole === "viewer") {
            saveViewerMixSettings(project.id, mixSettings);
            currentMixSettings = mixSettings;
            return;
        }

        if (!canPersistMix(projectRole) || !projectsApi?.saveMixSettings) {
            return;
        }

        rememberPendingMixSettings(mixSettings);
        schedulePendingMixPersistence();
    }

    async function flushPendingMixSettings(): Promise<void> {
        clearPersistenceTimer();

        if (projectRole === "viewer") {
            return;
        }

        if (persistenceInFlight) {
            await persistenceInFlight;
        }

        if (pendingMixRevision <= persistedMixRevision) {
            return;
        }

        await savePendingMixToServer();
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

    async function handleLoadMix(): Promise<void> {
        if (!audioPlayerController?.loadMix) {
            setStatus(
                statusElement,
                "Mix playback is not ready yet.",
            );

            return;
        }

        const mixSettings = getMixSettings();

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

        lastLoadedMixSettings = mixSettings;
        setLoadMixButtonCurrent(true);

        const channelWord =
            enabledMixChannels.length === 1
                ? "channel"
                : "channels";

        const mixMessage = projectRole === "viewer"
            ? `Loaded ${enabledMixChannels.length} ${channelWord} into your local mix.`
            : `Loaded ${enabledMixChannels.length} ${channelWord} into the mix.`;

        setStatus(
            statusElement,
            mixMessage,
        );
    }

    async function handleAddTrack(): Promise<void> {
        if (!canContribute(projectRole)) {
            setStatus(statusElement, "Project access denied.");
            return;
        }

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

    async function handleTrackListClick(
        event: TrackListEventLike,
    ): Promise<void> {
        const trackNameEditor = getTrackNameEditorTarget(event);

        if (trackNameEditor) {
            selectAllText(trackNameEditor);
            return;
        }

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
        if (!projectsApi || !canManageProject(projectRole)) {
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

            if (currentUserId) {
                clearPendingMixSettings(currentUserId, project.id);
            }

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

        trackListElement.addEventListener("input", (event) => {
            handleTrackListInput(event);
        });

        trackListElement.addEventListener("change", (event) => {
            return handleTrackListChange(event);
        });

        trackListElement.addEventListener("keydown", (event) => {
            return handleTrackListKeydown(event);
        });

        trackListElement.addEventListener("focusout", (event) => {
            return handleTrackListFocusOut(event);
        });

        registerProjectDetailEditors();

        deleteProjectButton?.addEventListener("click", () => {
            return handleDeleteProjectClick();
        });

        await loadTracks();

        if (pendingServerMixSettings) {
            schedulePendingMixPersistence();
        }
    }

    return {
        init,
        flushPendingMixSettings,
    };
}