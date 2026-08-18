import { hashProjectInvitationToken } from "../src/auth/project-invitation.js";
import { createProjectInvitationsPostgresStore } from "../src/stores/project-invitations-postgres-store.js";
import { createProjectsPostgresStore } from "../src/stores/projects-postgres-store.js";
import { createUsersPostgresStore } from "../src/stores/users-postgres-store.js";
import {
  postgresTestPool,
  resetPostgresTestDatabase,
} from "./db/postgres-test-db.js";
import { tester } from "./test-runner/tester.js";

async function createOwnerAndProject() {
  const usersStore = createUsersPostgresStore(postgresTestPool);
  const projectsStore = createProjectsPostgresStore(postgresTestPool);

  const owner = await usersStore.createUser({
    email: "invitation-owner@example.com",
    displayName: "Invitation Owner",
    passwordHash: "test-password-hash",
  });

  const project = await projectsStore.createProject({
    title: "Invitation Store Project",
    description: "Project invitation persistence test.",
  });

  return { owner, project };
}

tester.describe("project invitations PostgreSQL store", () => {
  tester.beforeEach(async () => {
    await resetPostgresTestDatabase();
  });

  tester.it("creates one active invitation for a project using only the token hash", async () => {
    const { owner, project } = await createOwnerAndProject();
    const store = createProjectInvitationsPostgresStore(postgresTestPool);
    const rawToken = "raw-token-must-not-be-stored";
    const tokenHash = hashProjectInvitationToken(rawToken);

    const invitation = await store.createOrReplaceInvitation({
      projectId: project.id,
      tokenHash,
      createdByUserId: owner.id,
    });

    tester.expect(invitation.projectId).toBe(project.id);
    tester.expect(invitation.createdByUserId).toBe(owner.id);
    tester.expect(invitation.tokenHash).toBe(tokenHash);
    tester.expect(invitation.tokenHash === rawToken).toBe(false);
    tester.expect(invitation.active).toBe(true);
  });

  tester.it("regenerates a project invitation by replacing its token hash", async () => {
    const { owner, project } = await createOwnerAndProject();
    const store = createProjectInvitationsPostgresStore(postgresTestPool);
    const firstHash = hashProjectInvitationToken("first-token");
    const secondHash = hashProjectInvitationToken("second-token");

    const first = await store.createOrReplaceInvitation({
      projectId: project.id,
      tokenHash: firstHash,
      createdByUserId: owner.id,
    });

    const regenerated = await store.createOrReplaceInvitation({
      projectId: project.id,
      tokenHash: secondHash,
      createdByUserId: owner.id,
    });

    tester.expect(regenerated.id).toBe(first.id);
    tester.expect(regenerated.tokenHash).toBe(secondHash);
    tester.expect(regenerated.active).toBe(true);
    tester.expect(
      await store.getActiveInvitationByTokenHash(firstHash),
    ).toBe(null);
    tester.expect(
      (await store.getActiveInvitationByTokenHash(secondHash))?.projectId,
    ).toBe(project.id);
  });

  tester.it("disables an invitation without making its token valid", async () => {
    const { owner, project } = await createOwnerAndProject();
    const store = createProjectInvitationsPostgresStore(postgresTestPool);
    const tokenHash = hashProjectInvitationToken("disable-token");

    await store.createOrReplaceInvitation({
      projectId: project.id,
      tokenHash,
      createdByUserId: owner.id,
    });

    const disabled = await store.disableInvitation(project.id);

    tester.expect(disabled?.active).toBe(false);
    tester.expect(
      await store.getActiveInvitationByTokenHash(tokenHash),
    ).toBe(null);
  });

  tester.it("deletes the invitation automatically when its project is deleted", async () => {
    const { owner, project } = await createOwnerAndProject();
    const store = createProjectInvitationsPostgresStore(postgresTestPool);

    await store.createOrReplaceInvitation({
      projectId: project.id,
      tokenHash: hashProjectInvitationToken("cascade-token"),
      createdByUserId: owner.id,
    });

    await postgresTestPool.query(
      "DELETE FROM projects WHERE id = $1",
      [project.id],
    );

    tester.expect(
      await store.getInvitationByProjectId(project.id),
    ).toBe(null);
  });
});
