import { mkdir, rm } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import type { Database } from "../types.js";
import { DEFAULT_DB_FILE_PATH, writeDatabase } from "../stores/json-db.js";

type JsonResponse = Record<string, unknown>;

type SendJson = (
  res: ServerResponse,
  statusCode: number,
  body: JsonResponse,
  clientOrigin: string,
) => void;

type DevResetRouteOptions = {
    res: ServerResponse;
    sendJson: SendJson;
    clientOrigin: string;
    uploadRoot: string;
};

const emptyDatabase: Database = {
    projects: [],
    tracks: [],
};

export async function handleDevResetRoute({
    res,
    sendJson,
    clientOrigin,
    uploadRoot,
}: DevResetRouteOptions): Promise<void> {
    if (process.env.NODE_ENV === "production") {
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

    await writeDatabase(DEFAULT_DB_FILE_PATH, emptyDatabase);

    await rm(uploadRoot, {
        recursive: true,
        force: true,
    });

    await mkdir(uploadRoot, {
        recursive: true,
    });

    sendJson(
        res,
        200,
        {
            ok: true,
            data: {
                projects: 0,
                tracks: 0,
            },
        },
        clientOrigin,
    );
}