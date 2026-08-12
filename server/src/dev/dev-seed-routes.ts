import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectsStore } from "../stores/projects-store.js";
import type { TracksStore } from "../stores/tracks-store.js";
import type { Project, Track } from "../types.js";
import { ensureProjectUploadDir } from "../uploads/upload-paths.js";

type JsonResponse = Record<string, unknown>;

type SendJson = (
    res: ServerResponse,
    statusCode: number,
    body: JsonResponse,
    clientOrigin: string,
) => void;

type SeedAudioFile = {
    filename: string;
    displayName: string;
};

type DevSeedFilesRouteOptions = {
    res: ServerResponse;
    sendJson: SendJson;
    clientOrigin: string;
    seedProjectDir: string;
};

type DevSeedProjectRouteOptions = {
    req: IncomingMessage;
    res: ServerResponse;
    sendJson: SendJson;
    clientOrigin: string;
    projectsStore: ProjectsStore;
    tracksStore: TracksStore;
    uploadRoot: string;
    seedProjectDir: string;
};

type SeedProjectRequestBody = {
    filenames?: unknown;
};

type SeedProjectResponse = {
    project: Project;
    tracks: Track[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_SEED_PROJECT_DIR = path.join(
    __dirname,
    "../../data/seed-project",
);

const SUPPORTED_SEED_AUDIO_EXTENSIONS = new Set([
    ".wav",
    ".mp3",
    ".ogg",
    ".webm",
    ".flac",
    ".aac",
    ".m4a",
]);

function isProduction(): boolean {
    return process.env.NODE_ENV === "production";
}

function sendNotFound(
    res: ServerResponse,
    sendJson: SendJson,
    clientOrigin: string,
): void {
    sendJson(
        res,
        404,
        {
            ok: false,
            error: "Not found.",
        },
        clientOrigin,
    );
}

function getMimeTypeForFilename(filename: string): string {
    const extension = path.extname(filename).toLowerCase();

    if (extension === ".wav") {
        return "audio/wav";
    }

    if (extension === ".mp3") {
        return "audio/mpeg";
    }

    if (extension === ".ogg") {
        return "audio/ogg";
    }

    if (extension === ".webm") {
        return "audio/webm";
    }

    if (extension === ".flac") {
        return "audio/flac";
    }

    if (extension === ".aac") {
        return "audio/aac";
    }

    if (extension === ".m4a") {
        return "audio/mp4";
    }

    return "application/octet-stream";
}

function sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function readJsonRequestBody(req: IncomingMessage): Promise<unknown> {
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
                reject(new Error("Invalid JSON request body."));
            }
        });

        req.on("error", () => {
            reject(new Error("Could not read request body."));
        });
    });
}

export async function getSeedAudioFiles(
    seedProjectDir: string,
): Promise<SeedAudioFile[]> {
    await mkdir(seedProjectDir, {
        recursive: true,
    });

    const entries = await readdir(seedProjectDir, {
        withFileTypes: true,
    });

    return entries
        .filter((entry) => {
            return entry.isFile();
        })
        .filter((entry) => {
            return SUPPORTED_SEED_AUDIO_EXTENSIONS.has(
                path.extname(entry.name).toLowerCase(),
            );
        })
        .map((entry) => {
            return {
                filename: entry.name,
                displayName: entry.name,
            };
        })
        .sort((firstFile, secondFile) => {
            return firstFile.filename.localeCompare(secondFile.filename);
        });
}

export async function handleDevSeedFilesRoute({
    res,
    sendJson,
    clientOrigin,
    seedProjectDir,
}: DevSeedFilesRouteOptions): Promise<void> {
    if (isProduction()) {
        sendNotFound(res, sendJson, clientOrigin);
        return;
    }

    const seedFiles = await getSeedAudioFiles(seedProjectDir);

    sendJson(
        res,
        200,
        {
            ok: true,
            data: seedFiles,
        },
        clientOrigin,
    );
}

export async function handleDevSeedProjectRoute({
    req,
    res,
    sendJson,
    clientOrigin,
    projectsStore,
    tracksStore,
    uploadRoot,
    seedProjectDir,
}: DevSeedProjectRouteOptions): Promise<void> {
    if (isProduction()) {
        sendNotFound(res, sendJson, clientOrigin);
        return;
    }

    const body = (await readJsonRequestBody(req)) as SeedProjectRequestBody;
    const filenames = body.filenames;

    if (
        !Array.isArray(filenames) ||
        filenames.length === 0 ||
        !filenames.every((filename) => typeof filename === "string")
    ) {
        sendJson(
            res,
            400,
            {
                ok: false,
                error: "Choose at least one seed audio file.",
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

    const project = await projectsStore.createProject({
        title: "Dev Seed Project",
        description: "Temporary project created from real seed audio files.",
    });

    const uploadDir = await ensureProjectUploadDir({
        uploadRoot,
        projectId: project.id,
    });

    const tracks: Track[] = [];

    for (const filename of selectedFilenames) {
        const sourceFilePath = path.join(seedProjectDir, filename);
        const sourceFileStats = await stat(sourceFilePath);
        const storedFilename = `${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
        const destinationFilePath = path.join(uploadDir, storedFilename);

        await copyFile(sourceFilePath, destinationFilePath);

        const track = await tracksStore.createTrack({
            projectId: project.id,
            name: path.parse(filename).name,
            originalFilename: filename,
            filePath: path.relative(process.cwd(), destinationFilePath),
            mimeType: getMimeTypeForFilename(filename),
            fileSize: sourceFileStats.size,
            uploadedByUserId: null,
        });

        tracks.push(track);
    }

    const data: SeedProjectResponse = {
        project,
        tracks,
    };

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