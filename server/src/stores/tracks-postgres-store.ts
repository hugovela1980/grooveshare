import type { Pool } from "pg";
import type {
    CreateTrackInput,
    Track,
    UpdatePlaybackDerivativeInput,
    UpdateTrackDetailsInput,
    UpdateTrackNameInput,
} from "../types.js";
import { validatePlaybackDerivative } from "../playback-derivative.js";
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
    uploaded_by_user_id: string | null;
    musical_start_bar: number;
    musical_start_beat: number;
    musical_span_beats: number | null;
    alignment_offset_seconds: number;
    media_lead_in_seconds: number;
    playback_derivative_status: Track["playbackDerivative"]["status"];
    playback_derivative_version: string;
    playback_derivative_file_path: string | null;
    playback_derivative_mime_type: string | null;
    playback_derivative_file_size: number | null;
    created_at: Date;
};

function trackRowToTrack(
    row: TrackRow,
): Track {
    const playbackDerivative = row.playback_derivative_status === "ready"
        ? validatePlaybackDerivative({
            status: "ready",
            version: row.playback_derivative_version,
            filePath: row.playback_derivative_file_path ?? "",
            mimeType: row.playback_derivative_mime_type ?? "",
            fileSize: row.playback_derivative_file_size ?? -1,
        })
        : validatePlaybackDerivative({
            status: row.playback_derivative_status,
            version: row.playback_derivative_version,
            filePath: null,
            mimeType: null,
            fileSize: null,
        });

    return {
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        originalFilename: row.original_filename,
        filePath: row.file_path,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        playbackDerivative,
        uploadedByUserId: row.uploaded_by_user_id,
        musicalPlacement: {
            start: {
                bar: row.musical_start_bar,
                beat: row.musical_start_beat,
            },
            spanBeats: row.musical_span_beats,
        },
        alignmentOffsetSeconds: row.alignment_offset_seconds,
        mediaLeadInSeconds: row.media_lead_in_seconds,
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
            uploaded_by_user_id,
            musical_start_bar,
            musical_start_beat,
            musical_span_beats,
            alignment_offset_seconds,
            media_lead_in_seconds,
            playback_derivative_status,
            playback_derivative_version,
            playback_derivative_file_path,
            playback_derivative_mime_type,
            playback_derivative_file_size,
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
            uploaded_by_user_id,
            musical_start_bar,
            musical_start_beat,
            musical_span_beats,
            alignment_offset_seconds,
            media_lead_in_seconds,
            playback_derivative_status,
            playback_derivative_version,
            playback_derivative_file_path,
            playback_derivative_mime_type,
            playback_derivative_file_size,
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
            uploaded_by_user_id,
            musical_start_bar,
            musical_start_beat,
            musical_span_beats,
            alignment_offset_seconds,
            media_lead_in_seconds,
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
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
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
            uploaded_by_user_id,
            musical_start_bar,
            musical_start_beat,
            musical_span_beats,
            alignment_offset_seconds,
            media_lead_in_seconds,
            playback_derivative_status,
            playback_derivative_version,
            playback_derivative_file_path,
            playback_derivative_mime_type,
            playback_derivative_file_size,
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
                    trackInput.uploadedByUserId,
                    trackInput.musicalPlacement?.start.bar ?? 1,
                    trackInput.musicalPlacement?.start.beat ?? 1,
                    trackInput.musicalPlacement?.spanBeats ?? null,
                    trackInput.alignmentOffsetSeconds ?? 0,
                    trackInput.mediaLeadInSeconds ?? 0,
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

    async function updateTrackDetails(
        projectId: string,
        trackId: string,
        trackInput: UpdateTrackDetailsInput,
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

        const placement = trackInput.musicalPlacement;
        const result =
            await pool.query<TrackRow>(
                `
          UPDATE tracks
          SET
            name = COALESCE($3, name),
            musical_start_bar = COALESCE($4, musical_start_bar),
            musical_start_beat = COALESCE($5, musical_start_beat),
            musical_span_beats = CASE
              WHEN $6::boolean THEN $7
              ELSE musical_span_beats
            END,
            alignment_offset_seconds = COALESCE($8, alignment_offset_seconds)
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
            uploaded_by_user_id,
            musical_start_bar,
            musical_start_beat,
            musical_span_beats,
            alignment_offset_seconds,
            media_lead_in_seconds,
            playback_derivative_status,
            playback_derivative_version,
            playback_derivative_file_path,
            playback_derivative_mime_type,
            playback_derivative_file_size,
            created_at
        `,
                [
                    projectId,
                    trackId,
                    trackInput.name ?? null,
                    placement?.start.bar ?? null,
                    placement?.start.beat ?? null,
                    placement !== undefined,
                    placement?.spanBeats ?? null,
                    trackInput.alignmentOffsetSeconds ?? null,
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

    async function updateTrackName(
        projectId: string,
        trackId: string,
        trackInput: UpdateTrackNameInput,
    ): Promise<UpdateTrackResult> {
        return updateTrackDetails(projectId, trackId, {
            name: trackInput.name,
        });
    }

    async function updatePlaybackDerivative(
        projectId: string,
        trackId: string,
        derivativeInput: UpdatePlaybackDerivativeInput,
    ): Promise<UpdateTrackResult> {
        const derivative = validatePlaybackDerivative(derivativeInput);
        const projectResult = await pool.query(
            `SELECT id FROM projects WHERE id = $1`,
            [projectId],
        );

        if (!projectResult.rows[0]) {
            return { ok: false, reason: "project-not-found" };
        }

        const result = await pool.query<TrackRow>(
            `
          UPDATE tracks
          SET
            playback_derivative_status = $3,
            playback_derivative_version = $4,
            playback_derivative_file_path = $5,
            playback_derivative_mime_type = $6,
            playback_derivative_file_size = $7
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
            uploaded_by_user_id,
            musical_start_bar,
            musical_start_beat,
            musical_span_beats,
            alignment_offset_seconds,
            media_lead_in_seconds,
            playback_derivative_status,
            playback_derivative_version,
            playback_derivative_file_path,
            playback_derivative_mime_type,
            playback_derivative_file_size,
            created_at
        `,
            [
                projectId,
                trackId,
                derivative.status,
                derivative.version,
                derivative.filePath,
                derivative.mimeType,
                derivative.fileSize,
            ],
        );

        const row = result.rows[0];

        return row
            ? { ok: true, updatedTrack: trackRowToTrack(row) }
            : { ok: false, reason: "track-not-found" };
    }

    async function deleteTrackById(
        projectId: string,
        trackId: string,
    ): Promise<DeleteTrackResult> {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Serialize project-scoped writes through the same project row lock
            // used by mix-settings persistence. This prevents track deletion
            // from taking track/mix-channel locks in the opposite order and
            // deadlocking with a concurrent mix save.
            const projectResult =
                await client.query(
                    `
          SELECT id
          FROM projects
          WHERE id = $1
          FOR UPDATE
        `,
                    [projectId],
                );

            if (!projectResult.rows[0]) {
                await client.query("ROLLBACK");

                return {
                    ok: false,
                    reason: "project-not-found",
                };
            }

            const result =
                await client.query<TrackRow>(
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
            uploaded_by_user_id,
            musical_start_bar,
            musical_start_beat,
            musical_span_beats,
            alignment_offset_seconds,
            media_lead_in_seconds,
            playback_derivative_status,
            playback_derivative_version,
            playback_derivative_file_path,
            playback_derivative_mime_type,
            playback_derivative_file_size,
            created_at
        `,
                    [
                        projectId,
                        trackId,
                    ],
                );

            const row = result.rows[0];

            if (!row) {
                await client.query("ROLLBACK");

                return {
                    ok: false,
                    reason: "track-not-found",
                };
            }

            await client.query("COMMIT");

            return {
                ok: true,
                deletedTrack: trackRowToTrack(row),
            };
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    return {
        getTracksByProjectId,
        getTrackById,
        createTrack,
        updateTrackDetails,
        updateTrackName,
        updatePlaybackDerivative,
        deleteTrackById,
    };
}
