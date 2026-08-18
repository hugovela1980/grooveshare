export type ProjectInvitation = {
  id: string;
  projectId: string;
  tokenHash: string;
  createdByUserId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateOrReplaceProjectInvitationInput = {
  projectId: string;
  tokenHash: string;
  createdByUserId: string;
};

export type ProjectInvitationsStore = {
  createOrReplaceInvitation: (
    input: CreateOrReplaceProjectInvitationInput,
  ) => Promise<ProjectInvitation>;

  getInvitationByProjectId: (
    projectId: string,
  ) => Promise<ProjectInvitation | null>;

  getActiveInvitationByTokenHash: (
    tokenHash: string,
  ) => Promise<ProjectInvitation | null>;

  disableInvitation: (
    projectId: string,
  ) => Promise<ProjectInvitation | null>;
};
