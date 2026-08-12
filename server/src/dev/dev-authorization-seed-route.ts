import type {
  IncomingMessage,
  ServerResponse,
} from "node:http";
import type { ProjectMembershipsStore } from "../stores/project-memberships-store.js";
import type { ProjectsStore } from "../stores/projects-store.js";
import type { TracksStore } from "../stores/tracks-store.js";
import type { UsersStore } from "../stores/users-store.js";
import {
  getSeedAudioFiles,
} from "./dev-seed-routes.js";
import {
  seedAuthorizationScenario,
} from "./authorization-seed.js";

type JsonResponse = Record<string, unknown>;

type SendJson = (
  res: ServerResponse,
  statusCode: number,
  body: JsonResponse,
  clientOrigin: string,
) => void;

type DevAuthorizationSeedRouteOptions = {
  req: IncomingMessage;
  res: ServerResponse;
  sendJson: SendJson;
  clientOrigin: string;
  projectsStore: ProjectsStore;
  tracksStore: TracksStore;
  usersStore: UsersStore;
  projectMembershipsStore: ProjectMembershipsStore;
  uploadRoot: string;
  seedProjectDir: string;
};

type SeedAuthorizationRequestBody = {
  filenames?: unknown;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

async function readJsonRequestBody(
  req: IncomingMessage,
): Promise<unknown | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf-8");

      try {
        resolve(JSON.parse(rawBody));
      } catch {
        resolve(null);
      }
    });

    req.on("error", () => {
      reject(new Error("Could not read request body."));
    });
  });
}

export async function handleDevAuthorizationSeedRoute({
  req,
  res,
  sendJson,
  clientOrigin,
  projectsStore,
  tracksStore,
  usersStore,
  projectMembershipsStore,
  uploadRoot,
  seedProjectDir,
}: DevAuthorizationSeedRouteOptions): Promise<void> {
  if (isProduction()) {
    sendJson(
      res,
      404,
      {
        ok: false,
        error: "Not found.",
      },
      clientOrigin,
    );

    return;
  }

  const body = (await readJsonRequestBody(req)) as SeedAuthorizationRequestBody;
  const filenames = body.filenames;

  if (
    !Array.isArray(filenames) ||
    filenames.length < 2 ||
    !filenames.every((filename) => typeof filename === "string")
  ) {
    sendJson(
      res,
      400,
      {
        ok: false,
        error: "Choose at least two seed audio files.",
      },
      clientOrigin,
    );

    return;
  }

  const availableSeedFiles = await getSeedAudioFiles(seedProjectDir);
  const availableSeedFilenames = new Set(
    availableSeedFiles.map((seedFile) => seedFile.filename),
  );

  const selectedFilenames = filenames as string[];
  const unavailableFilename = selectedFilenames.find((filename) => {
    return !availableSeedFilenames.has(filename);
  });

  if (unavailableFilename) {
    sendJson(
      res,
      400,
      {
        ok: false,
        error: "One or more selected seed files are unavailable.",
      },
      clientOrigin,
    );

    return;
  }

  const data = await seedAuthorizationScenario({
    filenames: selectedFilenames,
    seedProjectDir,
    uploadRoot,
    projectsStore,
    tracksStore,
    usersStore,
    projectMembershipsStore,
  });

  sendJson(
    res,
    201,
    {
      ok: true,
      data,
    },
    clientOrigin,
  );
}
