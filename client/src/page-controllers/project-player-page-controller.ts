import type { Project, Track } from "../types.js";

type ElementLike = {
    innerHTML: string;
};

type TracksApi = {
    getTracksByProjectId: (projectId: string) => Promise<Track[]>;
};

type RenderTrackList = (tracks: Track[]) => string;

type ProjectPlayerPageControllerOptions = {
    project: Project;
    trackListElement: ElementLike;
    tracksApi: TracksApi;
    renderTrackList: RenderTrackList;
};

export function createProjectPlayerPageController({
    project,
    trackListElement,
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

    async function init(): Promise<void> {
        await loadTracks();
    }

    return {
        init,
    };
}