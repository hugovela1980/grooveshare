import type { Pool } from "pg";
import type {
  CreateOrReplaceProjectInvitationInput,
  ProjectInvitation,
  ProjectInvitationsStore,
} from "./project-invitations-store.js";

type ProjectInvitationRow = {
  id: string;
  project_id: string;
  token_hash: string;
  created_by_user_id: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

function rowToProjectInvitation(
  row: ProjectInvitationRow,
): ProjectInvitation {
  return {
    id: row.id,
    projectId: row.project_id,
    tokenHash: row.token_hash,
    createdByUserId: row.created_by_user_id,
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function createProjectInvitationsPostgresStore(
  pool: Pool,
): ProjectInvitationsStore {
  async function createOrReplaceInvitation(
    input: CreateOrReplaceProjectInvitationInput,
  ): Promise<ProjectInvitation> {
    const invitationId = crypto.randomUUID();

    const result = await pool.query<ProjectInvitationRow>(
      `
        INSERT INTO project_invitations (
          id,
          project_id,
          token_hash,
          created_by_user_id,
          active
        )
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (project_id)
        DO UPDATE SET
          token_hash = EXCLUDED.token_hash,
          created_by_user_id = EXCLUDED.created_by_user_id,
          active = TRUE,
          updated_at = NOW()
        RETURNING
          id,
          project_id,
          token_hash,
          created_by_user_id,
          active,
          created_at,
          updated_at
      `,
      [
        invitationId,
        input.projectId,
        input.tokenHash,
        input.createdByUserId,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error(
        "PostgreSQL did not return the project invitation.",
      );
    }

    return rowToProjectInvitation(row);
  }

  async function getInvitationByProjectId(
    projectId: string,
  ): Promise<ProjectInvitation | null> {
    const result = await pool.query<ProjectInvitationRow>(
      `
        SELECT
          id,
          project_id,
          token_hash,
          created_by_user_id,
          active,
          created_at,
          updated_at
        FROM project_invitations
        WHERE project_id = $1
      `,
      [projectId],
    );

    const row = result.rows[0];

    return row ? rowToProjectInvitation(row) : null;
  }

  async function getActiveInvitationByTokenHash(
    tokenHash: string,
  ): Promise<ProjectInvitation | null> {
    const result = await pool.query<ProjectInvitationRow>(
      `
        SELECT
          id,
          project_id,
          token_hash,
          created_by_user_id,
          active,
          created_at,
          updated_at
        FROM project_invitations
        WHERE token_hash = $1
          AND active = TRUE
      `,
      [tokenHash],
    );

    const row = result.rows[0];

    return row ? rowToProjectInvitation(row) : null;
  }

  async function disableInvitation(
    projectId: string,
  ): Promise<ProjectInvitation | null> {
    const result = await pool.query<ProjectInvitationRow>(
      `
        UPDATE project_invitations
        SET
          active = FALSE,
          updated_at = NOW()
        WHERE project_id = $1
        RETURNING
          id,
          project_id,
          token_hash,
          created_by_user_id,
          active,
          created_at,
          updated_at
      `,
      [projectId],
    );

    const row = result.rows[0];

    return row ? rowToProjectInvitation(row) : null;
  }

  return {
    createOrReplaceInvitation,
    getInvitationByProjectId,
    getActiveInvitationByTokenHash,
    disableInvitation,
  };
}
