import { createProjectsPostgresStore } from "../src/stores/projects-postgres-store.js";
import { CURRENT_PLAYBACK_DERIVATIVE_VERSION } from "../src/playback-derivative.js";
import {
    postgresTestPool,
    resetPostgresTestDatabase,
} from "./db/postgres-test-db.js";
import { tester } from "./test-runner/tester.js";

async function createTestTrack(
    projectId: string,
): Promise<string> {
    const trackId = crypto.randomUUID();

    await postgresTestPool.query(
        `
            INSERT INTO tracks (
                id,
                project_id,
                name,
                original_filename,
                file_path,
                mime_type,
                file_size,
                created_at
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                NOW()
            )
        `,
        [
            trackId,
            projectId,
            "Guitar",
            "guitar.wav",
            "uploads/guitar.wav",
            "audio/wav",
            100,
        ],
    );

    return trackId;
}

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

            tester.expect(project.musicalTimeline).toEqual({
                bpm: 120,
                timeSignature: { numerator: 4, denominator: 4 },
            });

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
        "persists explicit project musical timing",
        async () => {
            const store =
                createProjectsPostgresStore(postgresTestPool);

            const project = await store.createProject({
                title: "DAW Session",
                description: "Imported stems",
                musicalTimeline: {
                    bpm: 98,
                    timeSignature: { numerator: 6, denominator: 8 },
                },
            });

            const loadedProject = await store.getProjectById(project.id);

            tester.expect(loadedProject?.musicalTimeline).toEqual({
                bpm: 98,
                timeSignature: { numerator: 6, denominator: 8 },
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

    tester.it(
        "updates project details",
        async () => {
            const store =
                createProjectsPostgresStore(postgresTestPool);

            const project = await store.createProject({
                title: "Old Title",
                description: "Old description",
            });

            const updatedProject =
                await store.updateProjectDetails(project.id, {
                    title: "New Title",
                });

            tester.expect(updatedProject?.title).toBe(
                "New Title",
            );

            tester.expect(updatedProject?.description).toBe(
                "Old description",
            );

            const timelineProject =
                await store.updateProjectDetails(project.id, {
                    musicalTimeline: {
                        bpm: 105,
                        timeSignature: { numerator: 3, denominator: 4 },
                    },
                });

            tester.expect(timelineProject?.musicalTimeline).toEqual({
                bpm: 105,
                timeSignature: { numerator: 3, denominator: 4 },
            });

            tester.expect(
                updatedProject?.updatedAt === project.updatedAt,
            ).toBe(false);
        },
    );

    tester.it("returns null when updating a missing project", async () => {
        const store = createProjectsPostgresStore(postgresTestPool);

        const updatedProject = await store.updateProjectDetails(
            "00000000-0000-0000-0000-000000000001",
            {
                title: "New Title",
            },
        );

        tester.expect(updatedProject).toBe(null);
    },
    );

    tester.it("saves and returns project mix settings", async () => {
        const store = createProjectsPostgresStore(postgresTestPool);

        const project = await store.createProject({
            title: "Mix Project",
            description: "Testing saved mix",
        });

        const trackId = await createTestTrack(project.id);

        const updatedProject = await store.updateProjectMixSettings(
            project.id,
            {
                channels: [
                    {
                        channelNumber: 1,
                        trackId,
                        enabled: true,
                        volume: 0.75,
                    },
                ],
            },
        );

        tester.expect(updatedProject?.mixSettings).toEqual({
            channels: [
                {
                    channelNumber: 1,
                    trackId,
                    enabled: true,
                    volume: 0.75,
                },
            ],
        });

        const loadedProject = await store.getProjectById(project.id);

        tester.expect(loadedProject?.mixSettings).toEqual({
            channels: [
                {
                    channelNumber: 1,
                    trackId,
                    enabled: true,
                    volume: 0.75,
                },
            ],
        });
    });

    tester.it(
        "drops stale mix channels for tracks that no longer exist",
        async () => {
            const store = createProjectsPostgresStore(postgresTestPool);

            const project = await store.createProject({
                title: "Stale Mix Project",
                description: "Testing a pending mix after track deletion",
            });

            const deletedTrackId = await createTestTrack(project.id);
            const currentTrackId = await createTestTrack(project.id);

            await postgresTestPool.query(
                `
          DELETE FROM tracks
          WHERE project_id = $1
            AND id = $2
        `,
                [project.id, deletedTrackId],
            );

            const updatedProject = await store.updateProjectMixSettings(
                project.id,
                {
                    channels: [
                        {
                            channelNumber: 1,
                            trackId: deletedTrackId,
                            enabled: true,
                            volume: 0.8,
                        },
                        {
                            channelNumber: 2,
                            trackId: currentTrackId,
                            enabled: true,
                            volume: 0.6,
                        },
                    ],
                },
            );

            tester.expect(updatedProject?.mixSettings).toEqual({
                channels: [
                    {
                        channelNumber: 2,
                        trackId: currentTrackId,
                        enabled: true,
                        volume: 0.6,
                    },
                ],
            });
        },
    );

    tester.it("replaces existing project mix settings", async () => {
        const store = createProjectsPostgresStore(postgresTestPool);

        const project = await store.createProject({
            title: "Replace Mix",
            description: "Testing mix replacement",
        });

        const trackId = await createTestTrack(project.id);

        await store.updateProjectMixSettings(
            project.id,
            {
                channels: [
                    {
                        channelNumber: 1,
                        trackId,
                        enabled: true,
                        volume: 0.5,
                    },
                ],
            },
        );

        const updatedProject = await store.updateProjectMixSettings(
            project.id,
            {
                channels: [
                    {
                        channelNumber: 2,
                        trackId,
                        enabled: false,
                        volume: 0.8,
                    },
                ],
            },
        );

        tester.expect(updatedProject?.mixSettings).toEqual({
            channels: [
                {
                    channelNumber: 2,
                    trackId,
                    enabled: false,
                    volume: 0.8,
                },
            ],
        });
    });

    tester.it(
        "deletes a project and its related track metadata",
        async () => {
            const store =
                createProjectsPostgresStore(postgresTestPool);

            const project = await store.createProject({
                title: "Delete Project",
                description: "Testing deletion",
            });

            const trackId =
                await createTestTrack(project.id);

            await postgresTestPool.query(
                `
          UPDATE tracks
          SET
            playback_derivative_status = 'ready',
            playback_derivative_version = $2,
            playback_derivative_file_path = 'uploads/guitar.opus',
            playback_derivative_mime_type = 'audio/ogg',
            playback_derivative_file_size = 4321
          WHERE id = $1
        `,
                [trackId, CURRENT_PLAYBACK_DERIVATIVE_VERSION],
            );

            const result =
                await store.deleteProjectById(project.id);

            tester.expect(result.ok).toBe(true);

            if (!result.ok) {
                throw new Error(
                    "Expected project deletion to succeed.",
                );
            }

            tester.expect(result.deletedProject.id).toBe(
                project.id,
            );

            tester.expect(result.deletedTracks.length).toBe(1);

            tester.expect(result.deletedTracks[0]?.id).toBe(
                trackId,
            );
            tester.expect(
                result.deletedTracks[0]?.playbackDerivative,
            ).toEqual({
                status: "ready",
                version: CURRENT_PLAYBACK_DERIVATIVE_VERSION,
                filePath: "uploads/guitar.opus",
                mimeType: "audio/ogg",
                fileSize: 4321,
            });

            const projectRows =
                await postgresTestPool.query(
                    `
          SELECT id
          FROM projects
          WHERE id = $1
        `,
                    [project.id],
                );

            const trackRows =
                await postgresTestPool.query(
                    `
          SELECT id
          FROM tracks
          WHERE project_id = $1
        `,
                    [project.id],
                );

            tester.expect(projectRows.rows).toEqual([]);
            tester.expect(trackRows.rows).toEqual([]);
        },
    );

    tester.it("returns project-not-found when deleting a missing project", async () => {
        const store = createProjectsPostgresStore(postgresTestPool);

        const result = await store.deleteProjectById(
            "00000000-0000-0000-0000-000000000001",
        );

        tester.expect(result).toEqual({
            ok: false,
            reason: "project-not-found",
        });
    });
});
