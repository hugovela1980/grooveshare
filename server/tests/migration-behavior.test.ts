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
});
