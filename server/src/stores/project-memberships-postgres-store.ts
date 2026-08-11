import type { Pool } from "pg";
import type {
    CreateProjectMembershipInput,
    ProjectMembership,
    ProjectMembershipsStore,
    ProjectRole,
} from "./project-memberships-store.js";

type ProjectMembershipRow = {
    project_id: string;
    user_id: string;
    role: ProjectRole;
    created_at: Date;
    updated_at: Date;
};

function rowToProjectMembership(
    row: ProjectMembershipRow,
): ProjectMembership {
    return {
        projectId: row.project_id,
        userId: row.user_id,
        role: row.role,
        createdAt:
            row.created_at.toISOString(),
        updatedAt:
            row.updated_at.toISOString(),
    };
}

export function createProjectMembershipsPostgresStore(
    pool: Pool,
): ProjectMembershipsStore {
    async function createMembership(
        membershipInput:
            CreateProjectMembershipInput,
    ): Promise<ProjectMembership> {
        const result =
            await pool.query<ProjectMembershipRow>(
                `
          INSERT INTO project_memberships (
            project_id,
            user_id,
            role
          )
          VALUES ($1, $2, $3)
          RETURNING
            project_id,
            user_id,
            role,
            created_at,
            updated_at
        `,
                [
                    membershipInput.projectId,
                    membershipInput.userId,
                    membershipInput.role,
                ],
            );

        const row = result.rows[0];

        if (!row) {
            throw new Error(
                "PostgreSQL did not return the created project membership.",
            );
        }

        return rowToProjectMembership(row);
    }

    async function getMembership(
        projectId: string,
        userId: string,
    ): Promise<ProjectMembership | null> {
        const result =
            await pool.query<ProjectMembershipRow>(
                `
          SELECT
            project_id,
            user_id,
            role,
            created_at,
            updated_at
          FROM project_memberships
          WHERE project_id = $1
            AND user_id = $2
        `,
                [projectId, userId],
            );

        const row = result.rows[0];

        return row
            ? rowToProjectMembership(row)
            : null;
    }

    async function getMembershipsByProjectId(
        projectId: string,
    ): Promise<ProjectMembership[]> {
        const result =
            await pool.query<ProjectMembershipRow>(
                `
          SELECT
            project_id,
            user_id,
            role,
            created_at,
            updated_at
          FROM project_memberships
          WHERE project_id = $1
          ORDER BY created_at, user_id
        `,
                [projectId],
            );

        return result.rows.map(
            rowToProjectMembership,
        );
    }

    async function getMembershipsByUserId(
        userId: string,
    ): Promise<ProjectMembership[]> {
        const result =
            await pool.query<ProjectMembershipRow>(
                `
          SELECT
            project_id,
            user_id,
            role,
            created_at,
            updated_at
          FROM project_memberships
          WHERE user_id = $1
          ORDER BY created_at, project_id
        `,
                [userId],
            );

        return result.rows.map(
            rowToProjectMembership,
        );
    }

    async function updateMembershipRole(
        projectId: string,
        userId: string,
        role: ProjectRole,
    ): Promise<ProjectMembership | null> {
        const result =
            await pool.query<ProjectMembershipRow>(
                `
          UPDATE project_memberships
          SET
            role = $3,
            updated_at = NOW()
          WHERE project_id = $1
            AND user_id = $2
          RETURNING
            project_id,
            user_id,
            role,
            created_at,
            updated_at
        `,
                [
                    projectId,
                    userId,
                    role,
                ],
            );

        const row = result.rows[0];

        return row
            ? rowToProjectMembership(row)
            : null;
    }

    async function deleteMembership(
        projectId: string,
        userId: string,
    ): Promise<boolean> {
        const result =
            await pool.query(
                `
          DELETE FROM project_memberships
          WHERE project_id = $1
            AND user_id = $2
        `,
                [projectId, userId],
            );

        return (
            result.rowCount !== null &&
            result.rowCount > 0
        );
    }

    return {
        createMembership,
        getMembership,
        getMembershipsByProjectId,
        getMembershipsByUserId,
        updateMembershipRole,
        deleteMembership,
    };
}