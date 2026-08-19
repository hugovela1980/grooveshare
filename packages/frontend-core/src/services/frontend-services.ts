import type { ApiTransport, MultipartBodyFactory } from "./api-transport.js";
import { createAuthService, type AuthService } from "./auth-service.js";
import {
  createInvitationsService,
  type InvitationsService,
} from "./invitations-service.js";
import {
  createProjectMembersService,
  type ProjectMembersService,
} from "./project-members-service.js";
import {
  createProjectsService,
  type ProjectsService,
} from "./projects-service.js";
import {
  createTracksService,
  type TracksService,
} from "./tracks-service.js";

export type FrontendServices<TAudioFile = unknown> = {
  auth: AuthService;
  projects: ProjectsService;
  tracks: TracksService<TAudioFile> & {
    getTrackAudioUrl(projectId: string, trackId: string): string;
    createInvitationAudioDataFetcher(
      invitationToken: string,
    ): (audioUrl: string) => Promise<ArrayBuffer>;
  };
  projectMembers: ProjectMembersService;
  invitations: InvitationsService;
};

export function createFrontendServices<TAudioFile>(input: {
  apiBaseUrl: string;
  transport: ApiTransport;
  multipartBodyFactory: MultipartBodyFactory<TAudioFile>;
}): FrontendServices<TAudioFile> {
  const { apiBaseUrl, transport, multipartBodyFactory } = input;

  return {
    auth: createAuthService({ apiBaseUrl, transport }),
    projects: createProjectsService({ apiBaseUrl, transport }),
    tracks: createTracksService({
      apiBaseUrl,
      transport,
      multipartBodyFactory,
    }),
    projectMembers: createProjectMembersService({ apiBaseUrl, transport }),
    invitations: createInvitationsService({ apiBaseUrl, transport }),
  };
}
