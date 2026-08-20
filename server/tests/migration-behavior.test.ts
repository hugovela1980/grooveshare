import { createProjectsPostgresStore } from "../src/stores/projects-postgres-store.js";
import { createTracksPostgresStore } from "../src/stores/tracks-postgres-store.js";
import { createUsersPostgresStore } from "../src/stores/users-postgres-store.js";
import {
  postgresTestPool,
  resetPostgresTestDatabase,
} from "./db/postgres-test-db.js";
import { tester } from "./test-runner/tester.js";

tester.describe("database migration behavior", () => {
  tester.beforeEach(async () => {
    await resetPostgresTestDatabase();
  });

  tester.it(
    "allows legacy-style tracks without an uploader",
    async () => {
      const projectsStore = createProjectsPostgresStore(
        postgresTestPool,
      );
      const tracksStore = createTracksPostgresStore(
        postgresTestPool,
      );

      const project = await projectsStore.createProject({
        title: "Legacy Track Project",
        description: "Migration compatibility test",
      });

      const track = await tracksStore.createTrack({
        projectId: project.id,
        name: "Legacy Track",
        originalFilename: "legacy.wav",
        filePath: "uploads/legacy.wav",
        mimeType: "audio/wav",
        fileSize: 100,
        uploadedByUserId: null,
      });

      const storedTrack = await tracksStore.getTrackById(
        project.id,
        track.id,
      );

      tester.expect(storedTrack?.uploadedByUserId).toBe(null);
    },
  );

  tester.it(
    "preserves a track and clears its uploader when the user is deleted",
    async () => {
      const projectsStore = createProjectsPostgresStore(
        postgresTestPool,
      );
      const tracksStore = createTracksPostgresStore(
        postgresTestPool,
      );
      const usersStore = createUsersPostgresStore(
        postgresTestPool,
      );

      const user = await usersStore.createUser({
        email: "migration-uploader@example.com",
        displayName: "Migration Uploader",
        passwordHash: "test-password-hash",
      });

      const project = await projectsStore.createProject({
        title: "Uploader Deletion Project",
        description: "ON DELETE SET NULL migration test",
      });

      const track = await tracksStore.createTrack({
        projectId: project.id,
        name: "Persistent Track",
        originalFilename: "persistent.wav",
        filePath: "uploads/persistent.wav",
        mimeType: "audio/wav",
        fileSize: 100,
        uploadedByUserId: user.id,
      });

      await postgresTestPool.query(
        "DELETE FROM users WHERE id = $1",
        [user.id],
      );

      const storedTrack = await tracksStore.getTrackById(
        project.id,
        track.id,
      );

      tester.expect(storedTrack !== null).toBe(true);
      tester.expect(storedTrack?.uploadedByUserId).toBe(null);
    },
  );

  tester.it(
    "gives pre-timeline project inserts the musical defaults",
    async () => {
      const projectId = crypto.randomUUID();

      await postgresTestPool.query(
        `
          INSERT INTO projects (
            id, title, description, created_at, updated_at
          )
          VALUES ($1, $2, $3, NOW(), NOW())
        `,
        [projectId, "Legacy Project", "Created without timing columns"],
      );

      const projectsStore = createProjectsPostgresStore(postgresTestPool);
      const project = await projectsStore.getProjectById(projectId);

      tester.expect(project?.musicalTimeline).toEqual({
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      });
    },
  );

  tester.it(
    "gives legacy tracks a bar-one start without inventing a musical length",
    async () => {
      const projectId = crypto.randomUUID();
      const trackId = crypto.randomUUID();

      await postgresTestPool.query(
        `INSERT INTO projects (id, title, description, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [projectId, "Legacy Track Timeline", "Migration default test"],
      );
      await postgresTestPool.query(
        `INSERT INTO tracks (id, project_id, name, original_filename, file_path, mime_type, file_size, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [trackId, projectId, "Legacy Stem", "stem.wav", "uploads/stem.wav", "audio/wav", 100],
      );

      const tracksStore = createTracksPostgresStore(postgresTestPool);
      const track = await tracksStore.getTrackById(projectId, trackId);

      tester.expect(track?.musicalPlacement).toEqual({
        start: { bar: 1, beat: 1 },
        spanBeats: null,
      });
    },
  );

});
