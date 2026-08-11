import { mkdir, rm } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import type { ProjectsStore } from "../stores/projects-store.js";

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
    projectsStore: ProjectsStore;
};

export async function handleDevResetRoute({
    res,
    sendJson,
    clientOrigin,
    uploadRoot,
    projectsStore,
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

    const projects = await projectsStore.getProjects();

    for (const project of projects) {
        const result =
            await projectsStore.deleteProjectById(project.id);

        if (!result.ok) {
            throw new Error(
                `Could not reset project ${project.id}.`,
            );
        }
    }

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