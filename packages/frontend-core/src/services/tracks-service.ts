import type {
  Track,
  UploadTrackInput,
} from "../domain/types.js";
import {
  parseApiResponse,
  type ApiTransport,
  type MultipartBodyFactory,
} from "./api-transport.js";
import { PROJECT_INVITATION_HEADER } from "./invitations-service.js";

export interface TracksService<TAudioFile = unknown> {
  getTracksByProjectId(
    projectId: string,
    invitationToken?: string,
  ): Promise<Track[]>;
  uploadTrack(input: UploadTrackInput<TAudioFile>): Promise<Track>;
  updateTrackName(
    projectId: string,
    trackId: string,
    name: string,
  ): Promise<Track>;
  deleteTrack(projectId: string, trackId: string): Promise<Track>;
}

function invitationHeaders(
  invitationToken?: string,
): Record<string, string> | undefined {
  return invitationToken
    ? { [PROJECT_INVITATION_HEADER]: invitationToken }
    : undefined;
}

export function createTracksService<TAudioFile>(input: {
  apiBaseUrl: string;
  transport: ApiTransport;
  multipartBodyFactory: MultipartBodyFactory<TAudioFile>;
}): TracksService<TAudioFile> & {
  getTrackAudioUrl(projectId: string, trackId: string): string;
  createInvitationAudioDataFetcher(
    invitationToken: string,
  ): (audioUrl: string) => Promise<ArrayBuffer>;
} {
  const { apiBaseUrl, transport, multipartBodyFactory } = input;

  return {
    async getTracksByProjectId(projectId, invitationToken) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${projectId}/tracks`,
        invitationToken
          ? {
              headers: invitationHeaders(invitationToken),
              notifyOnUnauthorized: false,
            }
          : undefined,
      );
      return parseApiResponse<Track[]>(response);
    },

    async uploadTrack({ projectId, trackName, audioFile }) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${projectId}/tracks`,
        {
          method: "POST",
          body: multipartBodyFactory.createTrackUploadBody({
            trackName,
            audioFile,
          }),
        },
      );
      return parseApiResponse<Track>(response);
    },

    getTrackAudioUrl(projectId, trackId) {
      return `${apiBaseUrl}/api/projects/${encodeURIComponent(
        projectId,
      )}/tracks/${encodeURIComponent(trackId)}/audio`;
    },

    createInvitationAudioDataFetcher(invitationToken) {
      return async (audioUrl) => {
        const response = await transport.request(audioUrl, {
          headers: invitationHeaders(invitationToken),
          notifyOnUnauthorized: false,
        });

        if (!response.ok) {
          throw new Error(
            `Could not load audio (${response.status} ${response.statusText}).`,
          );
        }

        return response.arrayBuffer();
      };
    },

    async updateTrackName(projectId, trackId, name) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${projectId}/tracks/${trackId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
      return parseApiResponse<Track>(response);
    },

    async deleteTrack(projectId, trackId) {
      const response = await transport.request(
        `${apiBaseUrl}/api/projects/${projectId}/tracks/${trackId}`,
        { method: "DELETE" },
      );
      return parseApiResponse<Track>(response);
    },
  };
}
