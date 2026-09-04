import type {
    Pool,
    PoolClient,
} from "pg";
import type {
    CreateProjectInput,
    MixChannelSetting,
    MixSettings,
    Project,
    Track,
    UpdateProjectDetailsInput,
} from "../types.js";
import { normalizeMusicalTimeline } from "../musical-timeline.js";
import { validatePlaybackDerivative } from "../playback-derivative.js";
import type {
    DeleteProjectResult,
    ProjectsStore,
} from "./projects-store.js";

type ProjectRow = {
    id: string;
    title: string;
    description: string;
    bpm: number;
    time_signature_numerator: number;
    time_signature_denominator: number;
    created_at: Date;
    updated_at: Date;
};

type MixChannelRow = {
    channel_number: number;
    track_id: string;
    enabled: boolean;
    volume: number;
};

type TrackRow = {
    id: string;
    project_id: string;
    name: string;
    original_filename: string;
    file_path: string;
    mime_type: string;
    file_size: number;
    uploaded_by_user_id: string | null;
    playback_derivative_status: Track["playbackDerivative"]["status"];
    playback_derivative_version: string;
    playback_derivative_file_path: string | null;
    playback_derivative_mime_type: string | null;
    playback_derivative_file_size: number | null;
    created_at: Date;
};

function mixChannelRowToMixChannelSetting(
    row: MixChannelRow,
): MixChannelSetting {
    return {
        channelNumber: row.channel_number,
        trackId: row.track_id,
        enabled: row.enabled,
        volume: row.volume,
    };
}

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
        createdAt: row.created_at.toISOString(),
    };
}

async function getMixSettings(
    client: Pool | PoolClient,
    projectId: string,
): Promise<MixSettings> {
    const result =
        await client.query<MixChannelRow>(
            `
        SELECT
          channel_number,
          track_id,
          enabled,
          volume
        FROM project_mix_channels
        WHERE project_id = $1
        ORDER BY channel_number ASC
      `,
            [projectId],
        );

    return {
        channels: result.rows.map(
            mixChannelRowToMixChannelSetting,
        ),
    };
}

async function projectRowToProject(
    client: Pool | PoolClient,
    row: ProjectRow,
): Promise<Project> {
    const mixSettings =
        await getMixSettings(client, row.id);

    return {
        id: row.id,
        title: row.title,
        description: row.description,
        musicalTimeline: {
            bpm: row.bpm,
            timeSignature: {
                numerator: row.time_signature_numerator,
                denominator: row.time_signature_denominator,
            },
        },
        mixSettings,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}

export function createProjectsPostgresStore(
    pool: Pool,
): ProjectsStore {
    async function getProjects(): Promise<Project[]> {
        const result =
            await pool.query<ProjectRow>(`
        SELECT
          id,
          title,
          description,
          bpm,
          time_signature_numerator,
          time_signature_denominator,
          created_at,
          updated_at
        FROM projects
        ORDER BY created_at ASC
      `);

        return Promise.all(
            result.rows.map((row) => {
                return projectRowToProject(pool, row);
            }),
        );
    }

    async function getProjectById(
        projectId: string,
    ): Promise<Project | null> {
        const result =
            await pool.query<ProjectRow>(
                `
          SELECT
            id,
            title,
            description,
            bpm,
            time_signature_numerator,
            time_signature_denominator,
            created_at,
            updated_at
          FROM projects
          WHERE id = $1
        `,
                [projectId],
            );

        const row = result.rows[0];

        if (!row) {
            return null;
        }

        return projectRowToProject(pool, row);
    }

    async function createProject(
        projectInput: CreateProjectInput,
    ): Promise<Project> {
        const id = crypto.randomUUID();
        const now = new Date();

        const musicalTimeline = normalizeMusicalTimeline(
            projectInput.musicalTimeline,
        );

        const result =
            await pool.query<ProjectRow>(
                `
          INSERT INTO projects (
            id,
            title,
            description,
            bpm,
            time_signature_numerator,
            time_signature_denominator,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
          RETURNING
            id,
            title,
            description,
            bpm,
            time_signature_numerator,
            time_signature_denominator,
            created_at,
            updated_at
        `,
                [
                    id,
                    projectInput.title,
                    projectInput.description,
                    musicalTimeline.bpm,
                    musicalTimeline.timeSignature.numerator,
                    musicalTimeline.timeSignature.denominator,
                    now,
                ],
            );

        const row = result.rows[0];

        if (!row) {
            throw new Error(
                "PostgreSQL did not return the created project.",
            );
        }

        return projectRowToProject(pool, row);
    }

    async function updateProjectDetails(
        projectId: string,
        projectInput: UpdateProjectDetailsInput,
    ): Promise<Project | null> {
        const musicalTimeline =
            projectInput.musicalTimeline !== undefined
                ? normalizeMusicalTimeline(projectInput.musicalTimeline)
                : undefined;

        const result =
            await pool.query<ProjectRow>(
                `
          UPDATE projects
          SET
            title = CASE
              WHEN $2::boolean
              THEN $3::text
              ELSE title
            END,
            description = CASE
              WHEN $4::boolean
              THEN $5::text
              ELSE description
            END,
            bpm = CASE
              WHEN $6::boolean
              THEN $7::double precision
              ELSE bpm
            END,
            time_signature_numerator = CASE
              WHEN $6::boolean
              THEN $8::smallint
              ELSE time_signature_numerator
            END,
            time_signature_denominator = CASE
              WHEN $6::boolean
              THEN $9::smallint
              ELSE time_signature_denominator
            END,
            updated_at = NOW()
          WHERE id = $1
          RETURNING
            id,
            title,
            description,
            bpm,
            time_signature_numerator,
            time_signature_denominator,
            created_at,
            updated_at
        `,
                [
                    projectId,
                    projectInput.title !== undefined,
                    projectInput.title ?? null,
                    projectInput.description !== undefined,
                    projectInput.description ?? null,
                    musicalTimeline !== undefined,
                    musicalTimeline?.bpm ?? null,
                    musicalTimeline?.timeSignature.numerator ?? null,
                    musicalTimeline?.timeSignature.denominator ?? null,
                ],
            );

        const row = result.rows[0];

        if (!row) {
            return null;
        }

        return projectRowToProject(pool, row);
    }

    async function updateProjectMixSettings(
        projectId: string,
        mixSettings: MixSettings,
    ): Promise<Project | null> {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const projectResult =
                await client.query<ProjectRow>(
                    `
            SELECT
              id,
              title,
              description,
              bpm,
              time_signature_numerator,
              time_signature_denominator,
              created_at,
              updated_at
            FROM projects
            WHERE id = $1
            FOR UPDATE
          `,
                    [projectId],
                );

            if (!projectResult.rows[0]) {
                await client.query("ROLLBACK");
                return null;
            }

            // The project lock above serializes this write with track deletion.
            // A client may still have a pending mix snapshot that references a
            // track deleted immediately before this transaction acquired the
            // lock. Normalize the submitted channels against the tracks that
            // currently exist so that stale client state cannot violate the
            // project_mix_channels -> tracks foreign key.
            const currentTrackResult = await client.query<{ id: string }>(
                `
          SELECT id
          FROM tracks
          WHERE project_id = $1
        `,
                [projectId],
            );

            const currentTrackIds = new Set(
                currentTrackResult.rows.map((row) => row.id),
            );
            const currentChannels = mixSettings.channels.filter((channel) =>
                currentTrackIds.has(channel.trackId),
            );

            await client.query(
                `
          DELETE FROM project_mix_channels
          WHERE project_id = $1
        `,
                [projectId],
            );

            for (const channel of currentChannels) {
                await client.query(
                    `
            INSERT INTO project_mix_channels (
              project_id,
              channel_number,
              track_id,
              enabled,
              volume
            )
            VALUES ($1, $2, $3, $4, $5)
          `,
                    [
                        projectId,
                        channel.channelNumber,
                        channel.trackId,
                        channel.enabled,
                        channel.volume,
                    ],
                );
            }

            await client.query(
                `
          UPDATE projects
          SET updated_at = NOW()
          WHERE id = $1
        `,
                [projectId],
            );

            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }

        return getProjectById(projectId);
    }

    async function deleteProjectById(
        projectId: string,
    ): Promise<DeleteProjectResult> {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const projectResult =
                await client.query<ProjectRow>(
                    `
            SELECT
              id,
              title,
              description,
              bpm,
              time_signature_numerator,
              time_signature_denominator,
              created_at,
              updated_at
            FROM projects
            WHERE id = $1
            FOR UPDATE
          `,
                    [projectId],
                );

            const projectRow = projectResult.rows[0];

            if (!projectRow) {
                await client.query("ROLLBACK");

                return {
                    ok: false,
                    reason: "project-not-found",
                };
            }

            const deletedProject =
                await projectRowToProject(
                    client,
                    projectRow,
                );

            const tracksResult =
                await client.query<TrackRow>(
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

            const deletedTracks =
                tracksResult.rows.map(trackRowToTrack);

            await client.query(
                `
          DELETE FROM projects
          WHERE id = $1
        `,
                [projectId],
            );

            await client.query("COMMIT");

            return {
                ok: true,
                deletedProject,
                deletedTracks,
            };
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    return {
        getProjects,
        getProjectById,
        createProject,
        updateProjectDetails,
        updateProjectMixSettings,
        deleteProjectById,
    };
}
