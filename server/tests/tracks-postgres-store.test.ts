import { createTracksPostgresStore } from "../src/stores/tracks-postgres-store.js";
import {
    postgresTestPool,
    resetPostgresTestDatabase,
} from "./db/postgres-test-db.js";
import { tester } from "./test-runner/tester.js";

async function createTestProject(): Promise<string> {
    const projectId = crypto.randomUUID();

    await postgresTestPool.query(
        `
      INSERT INTO projects (
        id,
        title,
        description,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        NOW(),
        NOW()
      )
    `,
        [
            projectId,
            "Test Project",
            "Project for track-store tests",
        ],
    );

    return projectId;
}

tester.describe("tracks PostgreSQL store", () => {
    tester.beforeEach(async () => {
        await resetPostgresTestDatabase();
    });

    tester.it(
        "creates a track and returns the saved track",
        async () => {
            const store =
                createTracksPostgresStore(postgresTestPool);

            const projectId = await createTestProject();

            const track = await store.createTrack({
                projectId,
                name: "Guitar",
                originalFilename: "guitar-riff.wav",
                filePath:
                    "uploads/projects/guitar-riff.wav",
                mimeType: "audio/wav",
                fileSize: 123456,
                uploadedByUserId: null,
                musicalPlacement: {
                    start: { bar: 3, beat: 2.5 },
                    spanBeats: 8,
                },
            });

            tester.expect(typeof track.id).toBe("string");
            tester.expect(track.projectId).toBe(projectId);
            tester.expect(track.name).toBe("Guitar");

            tester.expect(track.originalFilename).toBe(
                "guitar-riff.wav",
            );

            tester.expect(track.filePath).toBe(
                "uploads/projects/guitar-riff.wav",
            );

            tester.expect(track.mimeType).toBe("audio/wav");
            tester.expect(track.fileSize).toBe(123456);
            tester.expect(track.musicalPlacement).toEqual({
                start: { bar: 3, beat: 2.5 },
                spanBeats: 8,
            });

            tester.expect(typeof track.createdAt).toBe(
                "string",
            );
        },
    );

    tester.it(
        "returns tracks by project ID",
        async () => {
            const store =
                createTracksPostgresStore(postgresTestPool);

            const projectOneId = await createTestProject();
            const projectTwoId = await createTestProject();

            const guitarTrack = await store.createTrack({
                projectId: projectOneId,
                name: "Guitar",
                originalFilename: "guitar.wav",
                filePath: "uploads/guitar.wav",
                mimeType: "audio/wav",
                fileSize: 100,
                uploadedByUserId: null,
            });

            const drumTrack = await store.createTrack({
                projectId: projectOneId,
                name: "Drums",
                originalFilename: "drums.wav",
                filePath: "uploads/drums.wav",
                mimeType: "audio/wav",
                fileSize: 200,
                uploadedByUserId: null,
            });

            await store.createTrack({
                projectId: projectTwoId,
                name: "Bass",
                originalFilename: "bass.wav",
                filePath: "uploads/bass.wav",
                mimeType: "audio/wav",
                fileSize: 300,
                uploadedByUserId: null,
            });

            const tracks =
                await store.getTracksByProjectId(
                    projectOneId,
                );

            tester.expect(tracks).toEqual([
                guitarTrack,
                drumTrack,
            ]);
        },
    );

    tester.it(
        "returns an empty track list when a project has no tracks",
        async () => {
            const store =
                createTracksPostgresStore(postgresTestPool);

            const projectId = await createTestProject();

            const tracks =
                await store.getTracksByProjectId(projectId);

            tester.expect(tracks).toEqual([]);
        },
    );

    tester.it(
        "returns a track by project ID and track ID",
        async () => {
            const store =
                createTracksPostgresStore(postgresTestPool);

            const projectId = await createTestProject();

            const track = await store.createTrack({
                projectId,
                name: "Guitar",
                originalFilename: "guitar.wav",
                filePath: "uploads/guitar.wav",
                mimeType: "audio/wav",
                fileSize: 100,
                uploadedByUserId: null,
            });

            const foundTrack = await store.getTrackById(
                projectId,
                track.id,
            );

            tester.expect(foundTrack).toEqual(track);
        },
    );

    tester.it(
        "returns null when a track cannot be found",
        async () => {
            const store =
                createTracksPostgresStore(postgresTestPool);

            const projectId = await createTestProject();

            const foundTrack = await store.getTrackById(
                projectId,
                "00000000-0000-0000-0000-000000000001",
            );

            tester.expect(foundTrack).toBe(null);
        },
    );

    tester.it(
        "updates a track name",
        async () => {
            const store =
                createTracksPostgresStore(postgresTestPool);

            const projectId = await createTestProject();

            const track = await store.createTrack({
                projectId,
                name: "Guitar",
                originalFilename: "guitar.wav",
                filePath: "uploads/guitar.wav",
                mimeType: "audio/wav",
                fileSize: 100,
                uploadedByUserId: null,
            });

            const result = await store.updateTrackName(
                projectId,
                track.id,
                {
                    name: "Lead Guitar",
                },
            );

            tester.expect(result.ok).toBe(true);

            if (!result.ok) {
                throw new Error(
                    "Expected track update to succeed.",
                );
            }

            tester.expect(result.updatedTrack.name).toBe(
                "Lead Guitar",
            );

            const savedTrack = await store.getTrackById(
                projectId,
                track.id,
            );

            tester.expect(savedTrack?.name).toBe(
                "Lead Guitar",
            );
        },
    );

    tester.it(
        "updates track musical placement independently from the audio file",
        async () => {
            const store = createTracksPostgresStore(postgresTestPool);
            const projectId = await createTestProject();
            const track = await store.createTrack({
                projectId,
                name: "Guitar",
                originalFilename: "guitar.wav",
                filePath: "uploads/guitar.wav",
                mimeType: "audio/wav",
                fileSize: 100,
                uploadedByUserId: null,
            });

            const result = await store.updateTrackDetails(projectId, track.id, {
                musicalPlacement: {
                    start: { bar: 9, beat: 1.5 },
                    spanBeats: 12,
                },
            });

            tester.expect(result.ok).toBe(true);
            if (!result.ok) throw new Error("Expected placement update to succeed.");
            tester.expect(result.updatedTrack.musicalPlacement).toEqual({
                start: { bar: 9, beat: 1.5 },
                spanBeats: 12,
            });
        },
    );

    tester.it(
        "returns project-not-found when updating a track for a missing project",
        async () => {
            const store =
                createTracksPostgresStore(postgresTestPool);

            const result = await store.updateTrackName(
                "00000000-0000-0000-0000-000000000001",
                "00000000-0000-0000-0000-000000000002",
                {
                    name: "Lead Guitar",
                },
            );

            tester.expect(result).toEqual({
                ok: false,
                reason: "project-not-found",
            });
        },
    );

    tester.it(
        "returns track-not-found when updating a missing track",
        async () => {
            const store =
                createTracksPostgresStore(postgresTestPool);

            const projectId = await createTestProject();

            const result = await store.updateTrackName(
                projectId,
                "00000000-0000-0000-0000-000000000001",
                {
                    name: "Lead Guitar",
                },
            );

            tester.expect(result).toEqual({
                ok: false,
                reason: "track-not-found",
            });
        },
    );

    tester.it(
        "deletes a track",
        async () => {
            const store =
                createTracksPostgresStore(postgresTestPool);

            const projectId = await createTestProject();

            const trackToDelete =
                await store.createTrack({
                    projectId,
                    name: "Guitar",
                    originalFilename: "guitar.wav",
                    filePath: "uploads/guitar.wav",
                    mimeType: "audio/wav",
                    fileSize: 100,
                    uploadedByUserId: null,
                });

            const trackToKeep =
                await store.createTrack({
                    projectId,
                    name: "Bass",
                    originalFilename: "bass.wav",
                    filePath: "uploads/bass.wav",
                    mimeType: "audio/wav",
                    fileSize: 200,
                    uploadedByUserId: null,
                });

            const result = await store.deleteTrackById(
                projectId,
                trackToDelete.id,
            );

            tester.expect(result.ok).toBe(true);

            if (!result.ok) {
                throw new Error(
                    "Expected track deletion to succeed.",
                );
            }

            tester.expect(result.deletedTrack).toEqual(
                trackToDelete,
            );

            const tracks =
                await store.getTracksByProjectId(projectId);

            tester.expect(tracks).toEqual([
                trackToKeep,
            ]);
        },
    );

    tester.it(
        "returns project-not-found when deleting from a missing project",
        async () => {
            const store =
                createTracksPostgresStore(postgresTestPool);

            const result = await store.deleteTrackById(
                "00000000-0000-0000-0000-000000000001",
                "00000000-0000-0000-0000-000000000002",
            );

            tester.expect(result).toEqual({
                ok: false,
                reason: "project-not-found",
            });
        },
    );

    tester.it(
        "returns track-not-found when deleting a missing track",
        async () => {
            const store =
                createTracksPostgresStore(postgresTestPool);

            const projectId = await createTestProject();

            const result = await store.deleteTrackById(
                projectId,
                "00000000-0000-0000-0000-000000000001",
            );

            tester.expect(result).toEqual({
                ok: false,
                reason: "track-not-found",
            });
        },
    );
    tester.it(
        "persists the user who uploaded a track",
        async () => {
            const store =
                createTracksPostgresStore(postgresTestPool);

            const projectId = await createTestProject();
            const userId = crypto.randomUUID();

            await postgresTestPool.query(
                `
          INSERT INTO users (
            id,
            email,
            display_name,
            password_hash,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            NOW(),
            NOW()
          )
        `,
                [
                    userId,
                    "track-uploader@example.com",
                    "Track Uploader",
                    "test-password-hash",
                ],
            );

            const track = await store.createTrack({
                projectId,
                name: "Owned Guitar",
                originalFilename: "owned-guitar.wav",
                filePath: "uploads/owned-guitar.wav",
                mimeType: "audio/wav",
                fileSize: 100,
                uploadedByUserId: userId,
            });

            tester.expect(track.uploadedByUserId).toBe(userId);

            const savedTrack = await store.getTrackById(
                projectId,
                track.id,
            );

            tester.expect(savedTrack?.uploadedByUserId).toBe(
                userId,
            );
        },
    );

});
