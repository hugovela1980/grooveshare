import type { Pool } from "pg";
import type {
    CreateProjectInput,
    Project,
} from "../types.js";
import type { ProjectsStore } from "./projects-store.js";

type ProjectRow = {
    id: string;
    title: string;
    description: string;
    created_at: Date;
    updated_at: Date;
};

function projectRowToProject(
    row: ProjectRow,
): Project {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        mixSettings: {
            channels: [],
        },
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}

export function createProjectsPostgresStore(
    pool: Pool,
): ProjectsStore {
    async function getProjects(): Promise<Project[]> {
        const result = await pool.query<ProjectRow>(`
            SELECT
                id,
                title,
                description,
                created_at,
                updated_at
            FROM projects
            ORDER BY created_at ASC
        `);

        return result.rows.map(projectRowToProject);
    }

    async function getProjectById(
        projectId: string,
    ): Promise<Project | null> {
        const result = await pool.query<ProjectRow>(
            `
                SELECT
                id,
                title,
                description,
                created_at,
                updated_at
                FROM projects
                WHERE id = $1
            `,
            [projectId],
        );

        const row = result.rows[0];

        return row
            ? projectRowToProject(row)
            : null;
    }

    async function createProject(
        projectInput: CreateProjectInput,
    ): Promise<Project> {
        const id = crypto.randomUUID();
        const now = new Date();

        const result = await pool.query<ProjectRow>(
            `
        INSERT INTO projects (
          id,
          title,
          description,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $4)
        RETURNING
          id,
          title,
          description,
          created_at,
          updated_at
      `,
            [
                id,
                projectInput.title,
                projectInput.description,
                now,
            ],
        );

        const row = result.rows[0];

        if (!row) {
            throw new Error(
                "PostgreSQL did not return the created project.",
            );
        }

        return projectRowToProject(row);
    }

    async function updateProjectDetails(): Promise<never> {
        throw new Error("Not implemented yet.");
    }

    async function updateProjectMixSettings(): Promise<never> {
        throw new Error("Not implemented yet.");
    }

    async function deleteProjectById(): Promise<never> {
        throw new Error("Not implemented yet.");
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