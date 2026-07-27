import { createProjectDraftState } from "../src/project-draft/project-draft-state.js";
import { createPendingTrackSelectionController } from "../src/page-controllers/pending-track-selection-controller.js";
import { renderPendingTrackList } from "../src/templates/pending-track-list.js";
import {
    createFakeForm,
    createFakeInput,
    createFakeTextElement,
} from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

function createFakeFile(name = "guitar.wav"): File {
    return {
        name,
        type: "audio/wav",
        size: 123,
    } as unknown as File;
}

function createFakeFileInput(file: File | null) {
    const files = file
        ? ({
            0: file,
            length: 1,

            item(index: number) {
                return index === 0 ? file : null;
            },

            [Symbol.iterator]() {
                return [file][Symbol.iterator]();
            },
        } as FileList)
        : null;

    return {
        files,
    };
}

function createClickableListElement() {
    let clickHandler:
        | ((event: {
            target: {
                closest: (
                    selector: string,
                ) => { getAttribute: (name: string) => string | null } | null;
            };
        }) => void)
        | null = null;

    return {
        innerHTML: "",

        addEventListener(eventName: string, handler: typeof clickHandler) {
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
        const form = createFakeForm();
        const trackNameInput = createFakeInput("");
        const audioFileInput = createFakeFileInput(null);
        const statusElement = createFakeTextElement();
        const pendingTrackListElement = createClickableListElement();

        const projectDraftState = createProjectDraftState();

        const controller = createPendingTrackSelectionController({
            form,
            trackNameInput,
            audioFileInput,
            statusElement,
            pendingTrackListElement,
            projectDraftState,
            renderPendingTrackList,
        });

        controller.init();

        tester.expect(pendingTrackListElement.innerHTML.includes("No tracks selected yet.")).toBe(
            true,
        );
    });

    tester.it("adds a pending track from the form", async () => {
        const form = createFakeForm();
        const trackNameInput = createFakeInput("  Lead Guitar  ");
        const audioFile = createFakeFile();
        const audioFileInput = createFakeFileInput(audioFile);
        const statusElement = createFakeTextElement();
        const pendingTrackListElement = createClickableListElement();

        const projectDraftState = createProjectDraftState({
            createId: () => "pending-track-1",
        });

        const controller = createPendingTrackSelectionController({
            form,
            trackNameInput,
            audioFileInput,
            statusElement,
            pendingTrackListElement,
            projectDraftState,
            renderPendingTrackList,
        });

        controller.init();

        await form.submit();

        tester.expect(projectDraftState.getPendingTracks().length).toBe(1);
        tester.expect(projectDraftState.getPendingTracks()[0].trackName).toBe(
            "Lead Guitar",
        );
        tester.expect(form.getResetCallCount()).toBe(1);
        tester.expect(statusElement.textContent).toBe(
            "Track added to project draft.",
        );
        tester.expect(pendingTrackListElement.innerHTML.includes("Lead Guitar")).toBe(
            true,
        );
    });

    tester.it("does not add a pending track without an audio file", async () => {
        const form = createFakeForm();
        const trackNameInput = createFakeInput("Lead Guitar");
        const audioFileInput = createFakeFileInput(null);
        const statusElement = createFakeTextElement();
        const pendingTrackListElement = createClickableListElement();

        const projectDraftState = createProjectDraftState();

        const controller = createPendingTrackSelectionController({
            form,
            trackNameInput,
            audioFileInput,
            statusElement,
            pendingTrackListElement,
            projectDraftState,
            renderPendingTrackList,
        });

        controller.init();

        await form.submit();

        tester.expect(projectDraftState.getPendingTracks()).toEqual([]);
        tester.expect(form.getResetCallCount()).toBe(0);
        tester.expect(statusElement.textContent).toBe("Choose an audio file first.");
    });

    tester.it("removes a pending track", async () => {
        const form = createFakeForm();
        const trackNameInput = createFakeInput("Lead Guitar");
        const audioFileInput = createFakeFileInput(createFakeFile());
        const statusElement = createFakeTextElement();
        const pendingTrackListElement = createClickableListElement();

        const projectDraftState = createProjectDraftState({
            createId: () => "pending-track-1",
        });

        const controller = createPendingTrackSelectionController({
            form,
            trackNameInput,
            audioFileInput,
            statusElement,
            pendingTrackListElement,
            projectDraftState,
            renderPendingTrackList,
        });

        controller.init();

        await form.submit();

        pendingTrackListElement.clickRemoveButton("pending-track-1");

        tester.expect(projectDraftState.getPendingTracks()).toEqual([]);
        tester.expect(statusElement.textContent).toBe("Track removed.");
        tester.expect(pendingTrackListElement.innerHTML.includes("No tracks selected yet.")).toBe(
            true,
        );
    });
});