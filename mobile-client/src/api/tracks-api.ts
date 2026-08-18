import type { Track, UploadTrackInput } from "../types.js";
import {
  API_BASE_URL,
  apiFetch,
  parseApiResponse,
} from "./api-client.js";
import { PROJECT_INVITATION_HEADER } from "./invitations-api.js";

function getInvitationHeaders(invitationToken?: string): HeadersInit | undefined {
  return invitationToken
    ? { [PROJECT_INVITATION_HEADER]: invitationToken }
    : undefined;
}

export async function getTracksByProjectId(
  projectId: string,
  invitationToken?: string,
): Promise<Track[]> {
  const response = await apiFetch(
    `${API_BASE_URL}/api/projects/${projectId}/tracks`,
    invitationToken
      ? {
          headers: getInvitationHeaders(invitationToken),
          notifyOnUnauthorized: false,
        }
      : undefined,
  );

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

  const response = await apiFetch(
    `${API_BASE_URL}/api/projects/${projectId}/tracks`,
    {
      method: "POST",
      body: formData,
    },
  );

  return parseApiResponse<Track>(response);
}

export function getTrackAudioUrl(projectId: string, trackId: string): string {
  return `${API_BASE_URL}/api/projects/${encodeURIComponent(
    projectId,
  )}/tracks/${encodeURIComponent(trackId)}/audio`;
}

export function createInvitationAudioDataFetcher(
  invitationToken: string,
): (audioUrl: string) => Promise<ArrayBuffer> {
  return async (audioUrl: string) => {
    const response = await apiFetch(audioUrl, {
      headers: getInvitationHeaders(invitationToken),
      notifyOnUnauthorized: false,
    });

    if (!response.ok) {
      throw new Error(
        `Could not load audio (${response.status} ${response.statusText}).`,
      );
    }

    return response.arrayBuffer();
  };
}

export async function updateTrackName(
  projectId: string,
  trackId: string,
  name: string,
): Promise<Track> {
  const response = await apiFetch(
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
  const response = await apiFetch(
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
