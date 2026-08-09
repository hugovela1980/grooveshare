import type { Track, UploadTrackInput } from "../types.js";

type ApiResponse<T> = {
    ok: boolean;
    data?: T;
    error?: string;
};

const API_BASE_URL = "http://localhost:3000";

async function parseApiResponse<T>(response: Response): Promise<T> {
    const body = (await response.json()) as ApiResponse<T>;

    if (!response.ok || !body.ok || body.data === undefined) {
        throw new Error(body.error ?? "API request failed.");
    }

    return body.data;
}

export async function getTracksByProjectId(projectId: string): Promise<Track[]> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/tracks`);
    return parseApiResponse<Track[]>(response);
}

export async function uploadTrack({
    projectId,
    trackName,
    audioFile,
}: UploadTrackInput): Promise<Track> {
    const formData = new FormData();

    formData.append("trackName", trackName);
    formData.append("audioFile", audioFile);

    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/tracks`, {
        method: "POST",
        body: formData,
    });

    return parseApiResponse<Track>(response);
}

export function getTrackAudioUrl(projectId: string, trackId: string): string {
    return `${API_BASE_URL}/api/projects/${encodeURIComponent(
        projectId,
    )}/tracks/${encodeURIComponent(trackId)}/audio`;
}

export async function updateTrackName(
    projectId: string,
    trackId: string,
    name: string,
): Promise<Track> {
    const response = await fetch(
        `${API_BASE_URL}/api/projects/${projectId}/tracks/${trackId}`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ name }),
        },
    );

    return parseApiResponse<Track>(response);
}

export async function deleteTrack(
    projectId: string,
    trackId: string,
): Promise<Track> {
    const response = await fetch(
        `${API_BASE_URL}/api/projects/${projectId}/tracks/${trackId}`,
        {
            method: "DELETE",
        },
    );

    return parseApiResponse<Track>(response);
}

export const tracksApi = {
    getTracksByProjectId,
    uploadTrack,
    updateTrackName,
    deleteTrack,
};