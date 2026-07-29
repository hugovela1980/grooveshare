import type { Project, Track } from "../types.js";

type TracksApi = {
    getTracksByProjectId: (projectId: string) => Promise<Track[]>;
    deleteTrack: (projectId: string, trackId: string) => Promise<Track>;
};

type ClickEventLike = {
    target: EventTarget | null;
};

type TrackListElementLike = {
    innerHTML: string;
    addEventListener: (
        eventName: "click",
        handler: (event: ClickEventLike) => void | Promise<void>,
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

type ProjectPlayerPageControllerOptions = {
    project: Project;
    trackListElement: TrackListElementLike;
    statusElement?: TextElementLike | null;
    tracksApi: TracksApi;
    renderTrackList: (tracks: Track[]) => string;
};

function getDeleteTrackIdFromTarget(target: EventTarget | null): string | null {
    const element = target as ClosestElementLike | null;
    const deleteButton = element?.closest?.("[data-track-delete-button]");

    return deleteButton?.dataset?.trackId ?? null;
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
    tracksApi,
    renderTrackList,
}: ProjectPlayerPageControllerOptions) {
    async function loadTracks(): Promise<void> {
        try {
            const tracks = await tracksApi.getTracksByProjectId(project.id);

            trackListElement.innerHTML = renderTrackList(tracks);
        } catch {
            trackListElement.innerHTML =
                '<p class="empty-state">Could not load tracks.</p>';
        }
    }

    async function handleTrackListClick(event: ClickEventLike): Promise<void> {
        const trackId = getDeleteTrackIdFromTarget(event.target);

        if (!trackId) {
            return;
        }

        try {
            setStatus(statusElement, "Deleting track...");

            await tracksApi.deleteTrack(project.id, trackId);
            await loadTracks();

            setStatus(statusElement, "Track deleted.");
        } catch {
            setStatus(statusElement, "Could not delete track.");
        }
    }

    async function init(): Promise<void> {
        trackListElement.addEventListener("click", (event) => {
            return handleTrackListClick(event);
        });

        await loadTracks();
    }

    return {
        init,
    };
}