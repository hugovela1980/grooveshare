import type {
  CreateOrReplaceProjectInvitationInput,
  ProjectInvitation,
  ProjectInvitationsStore,
} from "../../src/stores/project-invitations-store.js";

export function createTestProjectInvitationsStore(): ProjectInvitationsStore {
  const invitations: ProjectInvitation[] = [];

  async function createOrReplaceInvitation(
    input: CreateOrReplaceProjectInvitationInput,
  ): Promise<ProjectInvitation> {
    const existing = invitations.find(
      (invitation) => invitation.projectId === input.projectId,
    );
    const now = new Date().toISOString();

    if (existing) {
      existing.tokenHash = input.tokenHash;
      existing.createdByUserId = input.createdByUserId;
      existing.active = true;
      existing.updatedAt = now;
      return existing;
    }

    const invitation: ProjectInvitation = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      tokenHash: input.tokenHash,
      createdByUserId: input.createdByUserId,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    invitations.push(invitation);
    return invitation;
  }

  async function getInvitationByProjectId(
    projectId: string,
  ): Promise<ProjectInvitation | null> {
    return invitations.find(
      (invitation) => invitation.projectId === projectId,
    ) ?? null;
  }

  async function getActiveInvitationByTokenHash(
    tokenHash: string,
  ): Promise<ProjectInvitation | null> {
    return invitations.find(
      (invitation) =>
        invitation.tokenHash === tokenHash && invitation.active,
    ) ?? null;
  }

  async function disableInvitation(
    projectId: string,
  ): Promise<ProjectInvitation | null> {
    const invitation = invitations.find(
      (candidate) => candidate.projectId === projectId,
    );

    if (!invitation) {
      return null;
    }

    invitation.active = false;
    invitation.updatedAt = new Date().toISOString();
    return invitation;
  }

  return {
    createOrReplaceInvitation,
    getInvitationByProjectId,
    getActiveInvitationByTokenHash,
    disableInvitation,
  };
}
