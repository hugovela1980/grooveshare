import { mkdir, rm } from "node:fs/promises";

type Queryable = {
  query: (sql: string) => Promise<unknown>;
};

type ResetDevelopmentDataOptions = {
  database: Queryable;
  uploadRoot: string;
  nodeEnv?: string;
};

export const RESET_DEVELOPMENT_DATA_SQL = `
  TRUNCATE TABLE
    project_mix_channels,
    project_invitations,
    project_memberships,
    tracks,
    projects,
    sessions,
    users
  CASCADE
`;

export async function resetDevelopmentData({
  database,
  uploadRoot,
  nodeEnv = process.env.NODE_ENV,
}: ResetDevelopmentDataOptions): Promise<void> {
  if (nodeEnv !== "development") {
    throw new Error(
      "Development database reset requires NODE_ENV=development.",
    );
  }

  await database.query(RESET_DEVELOPMENT_DATA_SQL);

  await rm(uploadRoot, {
    recursive: true,
    force: true,
  });

  await mkdir(uploadRoot, {
    recursive: true,
  });
}
