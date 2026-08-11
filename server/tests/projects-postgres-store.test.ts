import { createProjectsPostgresStore } from "../src/stores/projects-postgres-store.js";
import {
    postgresTestPool,
    resetPostgresTestDatabase,
} from "./db/postgres-test-db.js";
import { tester } from "./test-runner/tester.js";

tester.describe("projects PostgreSQL store", () => {
    tester.beforeEach(async () => {
        await resetPostgresTestDatabase();
    });

    tester.it(
        "returns an empty project list when no projects exist",
        async () => {
            const store =
                createProjectsPostgresStore(postgresTestPool);

            const projects = await store.getProjects();

            tester.expect(projects).toEqual([]);
        },
    );

    tester.it(
        "creates a project and returns the saved project",
        async () => {
            const store =
                createProjectsPostgresStore(postgresTestPool);

            const project = await store.createProject({
                title: "Chorus Riff Idea",
                description: "Guitar riff with scratch drums",
            });

            tester.expect(typeof project.id).toBe("string");

            tester.expect(project.title).toBe(
                "Chorus Riff Idea",
            );

            tester.expect(project.description).toBe(
                "Guitar riff with scratch drums",
            );

            tester.expect(typeof project.createdAt).toBe(
                "string",
            );

            tester.expect(typeof project.updatedAt).toBe(
                "string",
            );

            tester.expect(project.mixSettings).toEqual({
                channels: [],
            });
        },
    );

    tester.it(
        "returns a project by ID",
        async () => {
            const store =
                createProjectsPostgresStore(postgresTestPool);

            const project = await store.createProject({
                title: "Verse Groove",
                description: "Clean guitar groove for verse",
            });

            const foundProject =
                await store.getProjectById(project.id);

            tester.expect(foundProject).toEqual(project);
        },
    );

    tester.it(
        "returns null when a project ID does not exist",
        async () => {
            const store =
                createProjectsPostgresStore(postgresTestPool);

            const foundProject =
                await store.getProjectById(
                    "00000000-0000-0000-0000-000000000001",
                );

            tester.expect(foundProject).toBe(null);
        },
    );
});