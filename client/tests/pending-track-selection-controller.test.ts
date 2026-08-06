import { createProjectDraftState } from "../src/project-draft/project-draft-state.js";
import { createPendingTrackSelectionController } from "../src/page-controllers/pending-track-selection-controller.js";
import { renderPendingTrackList } from "../src/templates/pending-track-list.js";
import {
    createFakeForm,
    createFakeTextElement,
} from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

type ClickTargetLike = {
    closest: (
        selector: string,
    ) => { getAttribute: (name: string) => string | null } | null;
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

            await clickHandler({});
        },
    };
}

function createFakeModalElement() {
    return {
        hidden: true as boolean | "until-found",
    };
}

function createFakeFileInput(files: File[] = []) {
    let currentFiles = files;
    let changeHandler: ((event: Record<string, never>) => void) | null = null;

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

        triggerChange() {
            changeHandler?.({});
        },
    };
}

function createFakeSelectedTrackRowsElement(trackNameValues: string[] = []) {
    let currentTrackNameValues = trackNameValues;

    return {
        innerHTML: "",

        setTrackNameValues(trackNameValues: string[]) {
            currentTrackNameValues = trackNameValues;
        },

        querySelectorAll(selector: string) {
            if (selector !== "[data-selected-track-name]") {
                return [];
            }

            return currentTrackNameValues.map((value) => {
                return { value };
            });
        },
    };
}

function createClickableListElement() {
    let clickHandler: ((event: ClickEventLike) => void) | null = null;

    return {
        innerHTML: "",

        addEventListener(eventName: string, handler: (event: ClickEventLike) => void) {
            if (eventName === "click") {
                clickHandler = handler;
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
    };
}

tester.describe("pending track selection controller", () => {
    tester.it("renders the initial pending track list", () => {
        const openModalButton = createFakeButton();
        const closeModalButton = createFakeButton();
        const cancelButton = createFakeButton();
        const modalElement = createFakeModalElement();
        const form = createFakeForm();
        const audioFileInput = createFakeFileInput();
        const selectedTrackRowsElement = createFakeSelectedTrackRowsElement();
        const statusElement = createFakeTextElement();
        const tracksToIncludeSection = createFakeModalElement();
        const pendingTrackListElement = createClickableListElement();

        const projectDraftState = createProjectDraftState();

        const controller = createPendingTrackSelectionController({
            openModalButton,
            closeModalButton,
            cancelButton,
            modalElement,
            form,
            audioFileInput,
            selectedTrackRowsElement,
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
        tester.expect(modalElement.hidden).toBe(true);
    });

    tester.it("adds pending tracks from selected files", async () => {
        const openModalButton = createFakeButton();
        const closeModalButton = createFakeButton();
        const cancelButton = createFakeButton();
        const modalElement = createFakeModalElement();
        const form = createFakeForm();

        const guitarFile = createFakeFile("guitar.wav");
        const bassFile = createFakeFile("bass.wav");

        const audioFileInput = createFakeFileInput([guitarFile, bassFile]);
        const selectedTrackRowsElement = createFakeSelectedTrackRowsElement([
            "  Lead Guitar  ",
            "Bass",
        ]);
        const statusElement = createFakeTextElement();
        const tracksToIncludeSection = createFakeModalElement();
        const pendingTrackListElement = createClickableListElement();

        let nextId = 1;

        const projectDraftState = createProjectDraftState({
            createId: () => `pending-track-${nextId++}`,
        });

        const controller = createPendingTrackSelectionController({
            openModalButton,
            closeModalButton,
            cancelButton,
            modalElement,
            form,
            audioFileInput,
            selectedTrackRowsElement,
            statusElement,
            tracksToIncludeSection,
            pendingTrackListElement,
            projectDraftState,
            renderPendingTrackList,
        });

        controller.init();

        audioFileInput.triggerChange();

        selectedTrackRowsElement.setTrackNameValues(["  Lead Guitar  ", "Bass"]);

        await form.submit();

        tester.expect(projectDraftState.getPendingTracks().length).toBe(2);

        tester.expect(projectDraftState.getPendingTracks()[0].trackName).toBe(
            "Lead Guitar",
        );

        tester.expect(projectDraftState.getPendingTracks()[1].trackName).toBe("Bass");

        tester.expect(form.getResetCallCount()).toBe(1);

        tester.expect(statusElement.textContent).toBe(
            "Tracks added to project draft.",
        );

        tester.expect(pendingTrackListElement.innerHTML.includes("Lead Guitar")).toBe(
            true,
        );

        tester.expect(pendingTrackListElement.innerHTML.includes("Bass")).toBe(true);
        tester.expect(tracksToIncludeSection.hidden).toBe(false);
        tester.expect(modalElement.hidden).toBe(true);
    });

    tester.it("does not add pending tracks without an audio file", async () => {
        const openModalButton = createFakeButton();
        const closeModalButton = createFakeButton();
        const cancelButton = createFakeButton();
        const modalElement = createFakeModalElement();
        const form = createFakeForm();
        const audioFileInput = createFakeFileInput();
        const selectedTrackRowsElement = createFakeSelectedTrackRowsElement();
        const statusElement = createFakeTextElement();
        const tracksToIncludeSection = createFakeModalElement();
        const pendingTrackListElement = createClickableListElement();

        const projectDraftState = createProjectDraftState();

        const controller = createPendingTrackSelectionController({
            openModalButton,
            closeModalButton,
            cancelButton,
            modalElement,
            form,
            audioFileInput,
            selectedTrackRowsElement,
            statusElement,
            tracksToIncludeSection,
            pendingTrackListElement,
            projectDraftState,
            renderPendingTrackList,
        });

        controller.init();

        await form.submit();

        tester.expect(projectDraftState.getPendingTracks()).toEqual([]);
        tester.expect(form.getResetCallCount()).toBe(0);
        tester.expect(statusElement.textContent).toBe(
            "Choose at least one audio file first.",
        );
    });

    tester.it("removes a pending track", () => {
        const openModalButton = createFakeButton();
        const closeModalButton = createFakeButton();
        const cancelButton = createFakeButton();
        const modalElement = createFakeModalElement();
        const form = createFakeForm();
        const audioFileInput = createFakeFileInput();
        const selectedTrackRowsElement = createFakeSelectedTrackRowsElement();
        const statusElement = createFakeTextElement();
        const tracksToIncludeSection = createFakeModalElement();
        const pendingTrackListElement = createClickableListElement();

        const projectDraftState = createProjectDraftState({
            createId: () => "pending-track-1",
        });

        projectDraftState.addPendingTrack({
            trackName: "Lead Guitar",
            audioFile: createFakeFile("guitar.wav"),
        });

        const controller = createPendingTrackSelectionController({
            openModalButton,
            closeModalButton,
            cancelButton,
            modalElement,
            form,
            audioFileInput,
            selectedTrackRowsElement,
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

    tester.it("keeps previously selected modal files when more files are selected", async () => {
        const openModalButton = createFakeButton();
        const closeModalButton = createFakeButton();
        const cancelButton = createFakeButton();
        const modalElement = createFakeModalElement();
        const form = createFakeForm();

        const guitarFile = createFakeFile("guitar.wav");
        const bassFile = createFakeFile("bass.wav");
        const drumsFile = createFakeFile("drums.wav");
        const vocalFile = createFakeFile("vocal.wav");

        const audioFileInput = createFakeFileInput([guitarFile, bassFile, drumsFile]);
        const selectedTrackRowsElement = createFakeSelectedTrackRowsElement();
        const statusElement = createFakeTextElement();
        const tracksToIncludeSection = createFakeModalElement();
        const pendingTrackListElement = createClickableListElement();

        let nextId = 1;

        const projectDraftState = createProjectDraftState({
            createId: () => `pending-track-${nextId++}`,
        });

        const controller = createPendingTrackSelectionController({
            openModalButton,
            closeModalButton,
            cancelButton,
            modalElement,
            form,
            audioFileInput,
            selectedTrackRowsElement,
            statusElement,
            tracksToIncludeSection,
            pendingTrackListElement,
            projectDraftState,
            renderPendingTrackList,
        });

        controller.init();

        audioFileInput.triggerChange();

        tester.expect(selectedTrackRowsElement.innerHTML.includes("guitar.wav")).toBe(
            true,
        );
        tester.expect(selectedTrackRowsElement.innerHTML.includes("bass.wav")).toBe(
            true,
        );
        tester.expect(selectedTrackRowsElement.innerHTML.includes("drums.wav")).toBe(
            true,
        );

        selectedTrackRowsElement.setTrackNameValues(["Guitar", "Bass", "Drums"]);

        audioFileInput.setFiles([vocalFile]);
        audioFileInput.triggerChange();

        tester.expect(selectedTrackRowsElement.innerHTML.includes("guitar.wav")).toBe(
            true,
        );
        tester.expect(selectedTrackRowsElement.innerHTML.includes("bass.wav")).toBe(
            true,
        );
        tester.expect(selectedTrackRowsElement.innerHTML.includes("drums.wav")).toBe(
            true,
        );
        tester.expect(selectedTrackRowsElement.innerHTML.includes("vocal.wav")).toBe(
            true,
        );

        selectedTrackRowsElement.setTrackNameValues([
            "Guitar",
            "Bass",
            "Drums",
            "Vocal",
        ]);

        await form.submit();

        tester.expect(projectDraftState.getPendingTracks().length).toBe(4);

        tester.expect(
            projectDraftState.getPendingTracks().map((track) => track.trackName),
        ).toEqual(["Guitar", "Bass", "Drums", "Vocal"]);
    });
});