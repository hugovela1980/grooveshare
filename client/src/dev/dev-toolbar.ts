import { projectsApi } from "../api/projects-api.js";
import { tracksApi } from "../api/tracks-api.js";

const API_BASE_URL = "http://localhost:3000";

function createPlaceholderAudioFile(): File {
    const fakeAudioBytes = new Blob(["fake dev audio file"], {
        type: "audio/wav",
    });

    return new File([fakeAudioBytes], "dev-placeholder.wav", {
        type: "audio/wav",
    });
}

function createButton(label: string): HTMLButtonElement {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.style.padding = "0.35rem 0.6rem";
    button.style.cursor = "pointer";

    return button;
}

function setStatus(statusElement: HTMLSpanElement, message: string): void {
    statusElement.textContent = message;
}

async function resetDevData(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/dev/reset`, {
        method: "DELETE",
    });

    const body = (await response.json()) as {
        ok: boolean;
        error?: string;
    };

    if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Unable to reset dev data.");
    }
}

async function seedProjectWithTrack(): Promise<void> {
    const project = await projectsApi.createProject({
        title: "Dev Test Project",
        description: "Temporary project created from the dev toolbar.",
    });

    await tracksApi.uploadTrack({
        projectId: project.id,
        trackName: "Dev Placeholder Track",
        audioFile: createPlaceholderAudioFile(),
    });
}

export function mountDevToolbar(): void {
    const existingToolbar = document.querySelector("[data-dev-toolbar]");

    if (existingToolbar) {
        return;
    }

    const toolbar = document.createElement("div");
    toolbar.dataset.devToolbar = "true";

    Object.assign(toolbar.style, {
        position: "fixed",
        top: "0.75rem",
        left: "0.75rem",
        zIndex: "9999",
        display: "none",
        gap: "0.5rem",
        alignItems: "center",
        padding: "0.5rem",
        background: "white",
        color: "black",
        border: "2px solid black",
        fontFamily: "system-ui, sans-serif",
        fontSize: "0.85rem",
    });

    const seedButton = createButton("Seed project + track");
    const resetButton = createButton("Reset dev data");
    const statusElement = document.createElement("span");

    statusElement.textContent = "Dev tools";

    seedButton.addEventListener("click", async () => {
        try {
            setStatus(statusElement, "Seeding...");

            await seedProjectWithTrack();

            setStatus(statusElement, "Seeded. Reloading...");
            window.location.reload();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            setStatus(statusElement, message);
        }
    });

    resetButton.addEventListener("click", async () => {
        try {
            const confirmed = window.confirm(
                "Reset dev data? This will clear db.json and remove uploaded files.",
            );

            if (!confirmed) {
                return;
            }

            setStatus(statusElement, "Resetting...");

            await resetDevData();

            setStatus(statusElement, "Reset. Reloading...");
            window.location.reload();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            setStatus(statusElement, message);
        }
    });

    window.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight") {
            return;
        }

        toolbar.style.display = toolbar.style.display === "none" ? "flex" : "none";
    });

    toolbar.append(seedButton, resetButton, statusElement);
    document.body.append(toolbar);
}