import type { Pool } from "pg";
import type {
    CreateTrackInput,
    Track,
    UpdateTrackNameInput,
} from "../types.js";
import type {
    DeleteTrackResult,
    TracksStore,
    UpdateTrackResult,
} from "./tracks-store.js";

type TrackRow = {
    id: string;
    project_id: string;
    name: string;
    original_filename: string;
    file_path: string;
    mime_type: string;
    file_size: number;
    created_at: Date;
};

function trackRowToTrack(
    row: TrackRow,
): Track {
    return {
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        originalFilename: row.original_filename,
        filePath: row.file_path,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        createdAt: row.created_at.toISOString(),
    };
}

export function createTracksPostgresStore(
    pool: Pool,
): TracksStore {
    async function getTracksByProjectId(
        projectId: string,
    ): Promise<Track[]> {
        const result =
            await pool.query<TrackRow>(
                `
          SELECT
            id,
            project_id,
            name,
            original_filename,
            file_path,
            mime_type,
            file_size,
            created_at
          FROM tracks
          WHERE project_id = $1
          ORDER BY created_at ASC
        `,
                [projectId],
            );

        return result.rows.map(trackRowToTrack);
    }

    async function getTrackById(
        projectId: string,
        trackId: string,
    ): Promise<Track | null> {
        const result =
            await pool.query<TrackRow>(
                `
          SELECT
            id,
            project_id,
            name,
            original_filename,
            file_path,
            mime_type,
            file_size,
            created_at
          FROM tracks
          WHERE project_id = $1
            AND id = $2
        `,
                [
                    projectId,
                    trackId,
                ],
            );

        const row = result.rows[0];

        return row
            ? trackRowToTrack(row)
            : null;
    }

    async function createTrack(
        trackInput: CreateTrackInput,
    ): Promise<Track> {
        const trackId = crypto.randomUUID();

        const result =
            await pool.query<TrackRow>(
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
          RETURNING
            id,
            project_id,
            name,
            original_filename,
            file_path,
            mime_type,
            file_size,
            created_at
        `,
                [
                    trackId,
                    trackInput.projectId,
                    trackInput.name,
                    trackInput.originalFilename,
                    trackInput.filePath,
                    trackInput.mimeType,
                    trackInput.fileSize,
                ],
            );

        const row = result.rows[0];

        if (!row) {
            throw new Error(
                "PostgreSQL did not return the created track.",
            );
        }

        return trackRowToTrack(row);
    }

    async function updateTrackName(
        projectId: string,
        trackId: string,
        trackInput: UpdateTrackNameInput,
    ): Promise<UpdateTrackResult> {
        const projectResult =
            await pool.query(
                `
          SELECT id
          FROM projects
          WHERE id = $1
        `,
                [projectId],
            );

        if (!projectResult.rows[0]) {
            return {
                ok: false,
                reason: "project-not-found",
            };
        }

        const result =
            await pool.query<TrackRow>(
                `
          UPDATE tracks
          SET name = $3
          WHERE project_id = $1
            AND id = $2
          RETURNING
            id,
            project_id,
            name,
            original_filename,
            file_path,
            mime_type,
            file_size,
            created_at
        `,
                [
                    projectId,
                    trackId,
                    trackInput.name,
                ],
            );

        const row = result.rows[0];

        if (!row) {
            return {
                ok: false,
                reason: "track-not-found",
            };
        }

        return {
            ok: true,
            updatedTrack: trackRowToTrack(row),
        };
    }

    async function deleteTrackById(
        projectId: string,
        trackId: string,
    ): Promise<DeleteTrackResult> {
        const projectResult =
            await pool.query(
                `
          SELECT id
          FROM projects
          WHERE id = $1
        `,
                [projectId],
            );

        if (!projectResult.rows[0]) {
            return {
                ok: false,
                reason: "project-not-found",
            };
        }

        const result =
            await pool.query<TrackRow>(
                `
          DELETE FROM tracks
          WHERE project_id = $1
            AND id = $2
          RETURNING
            id,
            project_id,
            name,
            original_filename,
            file_path,
            mime_type,
            file_size,
            created_at
        `,
                [
                    projectId,
                    trackId,
                ],
            );

        const row = result.rows[0];

        if (!row) {
            return {
                ok: false,
                reason: "track-not-found",
            };
        }

        return {
            ok: true,
            deletedTrack: trackRowToTrack(row),
        };
    }

    return {
        getTracksByProjectId,
        getTrackById,
        createTrack,
        updateTrackName,
        deleteTrackById,
    };
}