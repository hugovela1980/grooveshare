import {
    createProjectMembershipsPostgresStore,
} from "../src/stores/project-memberships-postgres-store.js";
import {
    createProjectsPostgresStore,
} from "../src/stores/projects-postgres-store.js";
import {
    createUsersPostgresStore,
} from "../src/stores/users-postgres-store.js";
import {
    postgresTestPool,
    resetPostgresTestDatabase,
} from "./db/postgres-test-db.js";
import { tester } from "./test-runner/tester.js";

async function createTestUser(
    email = "member@example.com",
) {
    const usersStore =
        createUsersPostgresStore(
            postgresTestPool,
        );

    return usersStore.createUser({
        email,
        displayName: "Test Member",
        passwordHash: "test-password-hash",
    });
}

async function createTestProject() {
    const projectsStore =
        createProjectsPostgresStore(
            postgresTestPool,
        );

    return projectsStore.createProject({
        title: "Membership Test",
        description:
            "Project used for membership tests.",
    });
}

tester.describe(
    "project memberships PostgreSQL store",
    () => {
        tester.beforeEach(async () => {
            await resetPostgresTestDatabase();
        });

        tester.it(
            "creates a project membership",
            async () => {
                const user =
                    await createTestUser();

                const project =
                    await createTestProject();

                const store =
                    createProjectMembershipsPostgresStore(
                        postgresTestPool,
                    );

                const membership =
                    await store.createMembership({
                        projectId: project.id,
                        userId: user.id,
                        role: "owner",
                    });

                tester.expect(
                    membership.projectId,
                ).toBe(project.id);

                tester.expect(
                    membership.userId,
                ).toBe(user.id);

                tester.expect(
                    membership.role,
                ).toBe("owner");

                tester.expect(
                    typeof membership.createdAt,
                ).toBe("string");

                tester.expect(
                    typeof membership.updatedAt,
                ).toBe("string");
            },
        );

        tester.it(
            "gets a membership for a project and user",
            async () => {
                const user =
                    await createTestUser();

                const project =
                    await createTestProject();

                const store =
                    createProjectMembershipsPostgresStore(
                        postgresTestPool,
                    );

                const created =
                    await store.createMembership({
                        projectId: project.id,
                        userId: user.id,
                        role: "viewer",
                    });

                const found =
                    await store.getMembership(
                        project.id,
                        user.id,
                    );

                tester.expect(found).toEqual(
                    created,
                );
            },
        );

        tester.it(
            "returns null when membership does not exist",
            async () => {
                const user =
                    await createTestUser();

                const project =
                    await createTestProject();

                const store =
                    createProjectMembershipsPostgresStore(
                        postgresTestPool,
                    );

                const membership =
                    await store.getMembership(
                        project.id,
                        user.id,
                    );

                tester.expect(
                    membership,
                ).toBe(null);
            },
        );

        tester.it(
            "gets memberships by user",
            async () => {
                const user =
                    await createTestUser();

                const firstProject =
                    await createTestProject();

                const projectsStore =
                    createProjectsPostgresStore(
                        postgresTestPool,
                    );

                const secondProject =
                    await projectsStore.createProject({
                        title: "Second Project",
                        description:
                            "Second membership test.",
                    });

                const store =
                    createProjectMembershipsPostgresStore(
                        postgresTestPool,
                    );

                await store.createMembership({
                    projectId: firstProject.id,
                    userId: user.id,
                    role: "owner",
                });

                await store.createMembership({
                    projectId: secondProject.id,
                    userId: user.id,
                    role: "viewer",
                });

                const memberships =
                    await store.getMembershipsByUserId(
                        user.id,
                    );

                tester.expect(
                    memberships.length,
                ).toBe(2);
            },
        );

        tester.it(
            "updates a membership role",
            async () => {
                const user =
                    await createTestUser();

                const project =
                    await createTestProject();

                const store =
                    createProjectMembershipsPostgresStore(
                        postgresTestPool,
                    );

                await store.createMembership({
                    projectId: project.id,
                    userId: user.id,
                    role: "viewer",
                });

                const updated =
                    await store.updateMembershipRole(
                        project.id,
                        user.id,
                        "contributor",
                    );

                tester.expect(
                    updated?.role,
                ).toBe("contributor");
            },
        );

        tester.it(
            "deletes a membership",
            async () => {
                const user =
                    await createTestUser();

                const project =
                    await createTestProject();

                const store =
                    createProjectMembershipsPostgresStore(
                        postgresTestPool,
                    );

                await store.createMembership({
                    projectId: project.id,
                    userId: user.id,
                    role: "viewer",
                });

                const deleted =
                    await store.deleteMembership(
                        project.id,
                        user.id,
                    );

                tester.expect(deleted).toBe(
                    true,
                );

                const membership =
                    await store.getMembership(
                        project.id,
                        user.id,
                    );

                tester.expect(
                    membership,
                ).toBe(null);
            },
        );
    },
);