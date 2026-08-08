import { createProjectTrackSelectionController } from "../src/page-controllers/create-project-track-selection-controller.js";
import { createProjectDraftState } from "../src/project-draft/project-draft-state.js";
import { renderPendingTrackList } from "../src/templates/pending-track-list.js";
import { createFakeTextElement } from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

type ClickTargetLike = {
    closest?: (
        selector: string,
    ) => { getAttribute: (name: string) => string | null } | null;
    getAttribute?: (name: string) => string | null;
    value?: string;
};

type ClickEventLike = {
    preventDefault?: () => void;
    target?: ClickTargetLike | null;
};

function createFakeFile(name = "guitar.wav"): File {
    return {
        name,
        type: "audio/wav",
        size: 123,
    } as unknown as File;
}

function createFakeButton() {
    let clickHandler: ((event: ClickEventLike) => void | Promise<void>) | null =
        null;
    let preventDefaultCallCount = 0;

    return {
        addEventListener(
            eventName: string,
            handler: (event: ClickEventLike) => void | Promise<void>,
        ) {
            if (eventName === "click") {
                clickHandler = handler;
            }
        },

        async click() {
            if (!clickHandler) {
                throw new Error("No click handler registered.");
            }

            await clickHandler({
                preventDefault() {
                    preventDefaultCallCount += 1;
                },
            });
        },

        getPreventDefaultCallCount() {
            return preventDefaultCallCount;
        },
    };
}

function createFakeHiddenElement() {
    return {
        hidden: true as boolean | "until-found",
    };
}

function createFakeFileInput(files: File[] = []) {
    let currentFiles = files;
    let changeHandler: ((event: Record<string, never>) => void) | null = null;
    let clickCallCount = 0;

    return {
        get files() {
            return currentFiles;
        },

        value: "",

        setFiles(files: File[]) {
            currentFiles = files;
        },

        addEventListener(
            eventName: string,
            handler: (event: Record<string, never>) => void,
        ) {
            if (eventName === "change") {
                changeHandler = handler;
            }
        },

        click() {
            clickCallCount += 1;
        },

        triggerChange() {
            changeHandler?.({});
        },

        getClickCallCount() {
            return clickCallCount;
        },
    };
}

function createClickableListElement() {
    let clickHandler: ((event: ClickEventLike) => void) | null = null;
    let inputHandler: ((event: ClickEventLike) => void) | null = null;

    return {
        innerHTML: "",

        addEventListener(eventName: "click" | "input", handler: (event: ClickEventLike) => void) {
            if (eventName === "click") {
                clickHandler = handler;
            }

            if (eventName === "input") {
                inputHandler = handler;
            }
        },

        clickRemoveButton(pendingTrackId: string) {
            if (!clickHandler) {
                throw new Error("No click handler registered.");
            }

            clickHandler({
                target: {
                    closest(selector: string) {
                        if (selector !== "[data-pending-track-id]") {
                            return null;
                        }

                        return {
                            getAttribute(name: string) {
                                if (name !== "data-pending-track-id") {
                                    return null;
                                }

                                return pendingTrackId;
                            },
                        };
                    },
                },
            });
        },

        inputTrackName(pendingTrackId: string, trackName: string) {
            if (!inputHandler) {
                throw new Error("No input handler registered.");
            }

            inputHandler({
                target: {
                    value: trackName,

                    getAttribute(name: string) {
                        if (name !== "data-pending-track-name") {
                            return null;
                        }

                        return pendingTrackId;
                    },
                },
            });
        },
    };
}

tester.describe("create project track selection controller", () => {
    tester.it("renders the initial pending track list", () => {
        const addTracksButton = createFakeButton();
        const audioFileInput = createFakeFileInput();
        const statusElement = createFakeTextElement();
        const tracksToIncludeSection = createFakeHiddenElement();
        const pendingTrackListElement = createClickableListElement();

        const projectDraftState = createProjectDraftState();

        const controller = createProjectTrackSelectionController({
            addTracksButton,
            audioFileInput,
            statusElement,
            tracksToIncludeSection,
            pendingTrackListElement,
            projectDraftState,
            renderPendingTrackList,
        });

        controller.init();

        tester.expect(
            pendingTrackListElement.innerHTML.includes("No tracks selected yet."),
        ).toBe(true);

        tester.expect(tracksToIncludeSection.hidden).toBe(true);
    });

    tester.it("opens the native file picker from the add tracks button", async () => {
        const addTracksButton = createFakeButton();
        const audioFileInput = createFakeFileInput();
        const statusElement = createFakeTextElement();
        const tracksToIncludeSection = createFakeHiddenElement();
        const pendingTrackListElement = createClickableListElement();

        const projectDraftState = createProjectDraftState();

        const controller = createProjectTrackSelectionController({
            addTracksButton,
            audioFileInput,
            statusElement,
            tracksToIncludeSection,
            pendingTrackListElement,
            projectDraftState,
            renderPendingTrackList,
        });

        controller.init();

        await addTracksButton.click();

        tester.expect(audioFileInput.getClickCallCount()).toBe(1);
        tester.expect(addTracksButton.getPreventDefaultCallCount()).toBe(1);
    });

    tester.it("adds pending tracks immediately after files are selected", () => {
        const addTracksButton = createFakeButton();

        const guitarFile = createFakeFile("guitar.wav");
        const bassFile = createFakeFile("bass.wav");

        const audioFileInput = createFakeFileInput([guitarFile, bassFile]);
        const statusElement = createFakeTextElement();
        const tracksToIncludeSection = createFakeHiddenElement();
        const pendingTrackListElement = createClickableListElement();

        let nextId = 1;

        const projectDraftState = createProjectDraftState({
            createId: () => `pending-track-${nextId++}`,
        });

        const controller = createProjectTrackSelectionController({
            addTracksButton,
            audioFileInput,
            statusElement,
            tracksToIncludeSection,
            pendingTrackListElement,
            projectDraftState,
            renderPendingTrackList,
        });

        controller.init();

        audioFileInput.triggerChange();

        tester.expect(projectDraftState.getPendingTracks().length).toBe(2);

        tester.expect(projectDraftState.getPendingTracks()[0].trackName).toBe(
            "guitar",
        );

        tester.expect(projectDraftState.getPendingTracks()[1].trackName).toBe("bass");

        tester.expect(statusElement.textContent).toBe(
            "Tracks added to project draft.",
        );

        tester.expect(pendingTrackListElement.innerHTML.includes("guitar.wav")).toBe(
            true,
        );

        tester.expect(pendingTrackListElement.innerHTML.includes("bass.wav")).toBe(
            true,
        );

        tester.expect(tracksToIncludeSection.hidden).toBe(false);
    });

    tester.it("updates a pending track name from the inline input", () => {
        const addTracksButton = createFakeButton();
        const audioFileInput = createFakeFileInput();
        const statusElement = createFakeTextElement();
        const tracksToIncludeSection = createFakeHiddenElement();
        const pendingTrackListElement = createClickableListElement();

        const projectDraftState = createProjectDraftState({
            createId: () => "pending-track-1",
        });

        projectDraftState.addPendingTrack({
            trackName: "Guitar",
            audioFile: createFakeFile("guitar.wav"),
        });

        const controller = createProjectTrackSelectionController({
            addTracksButton,
            audioFileInput,
            statusElement,
            tracksToIncludeSection,
            pendingTrackListElement,
            projectDraftState,
            renderPendingTrackList,
        });

        controller.init();

        pendingTrackListElement.inputTrackName("pending-track-1", "Lead Guitar");

        tester.expect(projectDraftState.getPendingTracks()[0].trackName).toBe(
            "Lead Guitar",
        );
    });

    tester.it("removes a pending track", () => {
        const addTracksButton = createFakeButton();
        const audioFileInput = createFakeFileInput();
        const statusElement = createFakeTextElement();
        const tracksToIncludeSection = createFakeHiddenElement();
        const pendingTrackListElement = createClickableListElement();

        const projectDraftState = createProjectDraftState({
            createId: () => "pending-track-1",
        });

        projectDraftState.addPendingTrack({
            trackName: "Lead Guitar",
            audioFile: createFakeFile("guitar.wav"),
        });

        const controller = createProjectTrackSelectionController({
            addTracksButton,
            audioFileInput,
            statusElement,
            tracksToIncludeSection,
            pendingTrackListElement,
            projectDraftState,
            renderPendingTrackList,
        });

        controller.init();

        pendingTrackListElement.clickRemoveButton("pending-track-1");

        tester.expect(projectDraftState.getPendingTracks()).toEqual([]);
        tester.expect(statusElement.textContent).toBe("Track removed.");

        tester.expect(
            pendingTrackListElement.innerHTML.includes("No tracks selected yet."),
        ).toBe(true);

        tester.expect(tracksToIncludeSection.hidden).toBe(true);
    });

    tester.it("keeps previously selected files when more files are selected", () => {
        const addTracksButton = createFakeButton();

        const guitarFile = createFakeFile("guitar.wav");
        const bassFile = createFakeFile("bass.wav");
        const drumsFile = createFakeFile("drums.wav");
        const vocalFile = createFakeFile("vocal.wav");

        const audioFileInput = createFakeFileInput([guitarFile, bassFile, drumsFile]);
        const statusElement = createFakeTextElement();
        const tracksToIncludeSection = createFakeHiddenElement();
        const pendingTrackListElement = createClickableListElement();

        let nextId = 1;

        const projectDraftState = createProjectDraftState({
            createId: () => `pending-track-${nextId++}`,
        });

        const controller = createProjectTrackSelectionController({
            addTracksButton,
            audioFileInput,
            statusElement,
            tracksToIncludeSection,
            pendingTrackListElement,
            projectDraftState,
            renderPendingTrackList,
        });

        controller.init();

        audioFileInput.triggerChange();

        audioFileInput.setFiles([vocalFile]);
        audioFileInput.triggerChange();

        tester.expect(projectDraftState.getPendingTracks().length).toBe(4);

        tester.expect(
            projectDraftState.getPendingTracks().map((track) => track.trackName),
        ).toEqual(["guitar", "bass", "drums", "vocal"]);
    });
});