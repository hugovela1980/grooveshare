const API_BASE_URL = "http://localhost:3000";

type ApiResponse<T> = {
    ok: boolean;
    data?: T;
    error?: string;
};

type SeedAudioFile = {
    filename: string;
    displayName: string;
};

type SeedProjectResponse = {
    project: {
        id: string;
        title: string;
    };
    tracks: Array<{
        id: string;
        name: string;
    }>;
};

function createButton(label: string): HTMLButtonElement {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;

    Object.assign(button.style, {
        padding: "0.35rem 0.6rem",
        cursor: "pointer",
    });

    return button;
}

function setStatus(statusElement: HTMLSpanElement, message: string): void {
    statusElement.textContent = message;
}

async function fetchSeedAudioFiles(): Promise<SeedAudioFile[]> {
    const response = await fetch(`${API_BASE_URL}/api/dev/seed-files`);
    const body = (await response.json()) as ApiResponse<SeedAudioFile[]>;

    if (!response.ok || !body.ok || !body.data) {
        throw new Error(body.error ?? "Unable to load seed audio files.");
    }

    return body.data;
}

async function seedProjectWithSelectedFiles(
    filenames: string[],
): Promise<SeedProjectResponse> {
    const response = await fetch(`${API_BASE_URL}/api/dev/seed-project`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            filenames,
        }),
    });

    const body = (await response.json()) as ApiResponse<SeedProjectResponse>;

    if (!response.ok || !body.ok || !body.data) {
        throw new Error(body.error ?? "Unable to seed project.");
    }

    return body.data;
}

async function resetDevData(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/dev/reset`, {
        method: "DELETE",
    });

    const body = (await response.json()) as ApiResponse<unknown>;

    if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Unable to reset dev data.");
    }
}

function getSelectedSeedFilenames(seedFileList: HTMLElement): string[] {
    const selectedInputs = seedFileList.querySelectorAll<HTMLInputElement>(
        'input[name="seed-audio-file"]:checked',
    );

    return Array.from(selectedInputs).map((input) => input.value);
}

function renderSeedFileOptions(
    seedFileList: HTMLElement,
    seedFiles: SeedAudioFile[],
): void {
    seedFileList.innerHTML = "";

    if (seedFiles.length === 0) {
        const emptyMessage = document.createElement("p");

        emptyMessage.textContent = "No seed audio files found.";
        emptyMessage.style.margin = "0";

        seedFileList.append(emptyMessage);
        return;
    }

    for (const seedFile of seedFiles) {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.name = "seed-audio-file";
        checkbox.value = seedFile.filename;
        checkbox.checked = true;

        Object.assign(label.style, {
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "0.35rem",
            alignItems: "center",
        });

        label.append(checkbox, seedFile.displayName);
        seedFileList.append(label);
    }
}

function createSeedFileList(): HTMLDivElement {
    const seedFileList = document.createElement("div");

    Object.assign(seedFileList.style, {
        display: "grid",
        gap: "0.35rem",
        padding: "0.5rem",
        border: "1px solid black",
        background: "#f6f6f6",
    });

    return seedFileList;
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
        display: "grid",
        gap: "0.5rem",
        width: "min(26rem, calc(100vw - 1.5rem))",
        padding: "0.65rem",
        background: "white",
        color: "black",
        border: "2px solid black",
        boxShadow: "0 0.5rem 1.5rem rgba(0, 0, 0, 0.25)",
        fontFamily: "system-ui, sans-serif",
        fontSize: "0.85rem",
    });

    const titleElement = document.createElement("strong");
    titleElement.textContent = "Dev tools";

    const helpElement = document.createElement("span");
    helpElement.textContent = "Right Arrow toggles this toolbar.";
    helpElement.style.fontSize = "0.75rem";

    const seedFileHeading = document.createElement("span");
    seedFileHeading.textContent = "Seed audio files";
    seedFileHeading.style.fontWeight = "700";

    const seedFileList = createSeedFileList();

    const buttonRow = document.createElement("div");

    Object.assign(buttonRow.style, {
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
        alignItems: "center",
    });

    const seedButton = createButton("Seed project + selected tracks");
    const resetButton = createButton("Reset dev data");
    const statusElement = document.createElement("span");

    statusElement.textContent = "Loading seed files...";

    buttonRow.append(seedButton, resetButton);

    seedButton.addEventListener("click", async () => {
        try {
            const selectedFilenames = getSelectedSeedFilenames(seedFileList);

            if (selectedFilenames.length === 0) {
                setStatus(statusElement, "Choose at least one seed audio file.");
                return;
            }

            setStatus(statusElement, "Seeding real audio files...");

            const seededData = await seedProjectWithSelectedFiles(selectedFilenames);

            setStatus(
                statusElement,
                `Seeded ${seededData.tracks.length} track(s). Reloading...`,
            );

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

        toolbar.style.display = toolbar.style.display === "none" ? "grid" : "none";
    });

    toolbar.append(
        titleElement,
        helpElement,
        seedFileHeading,
        seedFileList,
        buttonRow,
        statusElement,
    );

    document.body.append(toolbar);

    void fetchSeedAudioFiles()
        .then((seedFiles) => {
            renderSeedFileOptions(seedFileList, seedFiles);
            setStatus(statusElement, `Loaded ${seedFiles.length} seed audio file(s).`);
        })
        .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);

            setStatus(statusElement, message);
        });
}