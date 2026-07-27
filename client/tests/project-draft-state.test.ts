import { createProjectDraftState } from "../src/project-draft/project-draft-state.js";
import { tester } from "./test-runner/tester.js";

function createFakeFile({
    name = "guitar.wav",
    type = "audio/wav",
    size = 123,
}: {
    name?: string;
    type?: string;
    size?: number;
} = {}): File {
    return {
        name,
        type,
        size,
    } as unknown as File;
}

tester.describe("project draft state", () => {
    tester.it("stores project draft details", () => {
        const draftState = createProjectDraftState();

        draftState.setProjectDraft({
            title: "  Bass Groove  ",
            description: "  Practice loop  ",
        });

        tester.expect(draftState.getProjectDraft()).toEqual({
            title: "Bass Groove",
            description: "Practice loop",
        });
    });

    tester.it("adds pending tracks before the project exists", () => {
        const draftState = createProjectDraftState({
            createId: () => "pending-track-1",
        });

        const audioFile = createFakeFile({
            name: "guitar.wav",
            type: "audio/wav",
            size: 456,
        });

        const pendingTrack = draftState.addPendingTrack({
            trackName: "  Lead Guitar  ",
            audioFile,
        });

        tester.expect(pendingTrack).toEqual({
            id: "pending-track-1",
            trackName: "Lead Guitar",
            audioFile,
            originalFilename: "guitar.wav",
            mimeType: "audio/wav",
            fileSize: 456,
        });

        tester.expect(draftState.getPendingTracks()).toEqual([pendingTrack]);
    });

    tester.it("uses the file name when track name is blank", () => {
        const draftState = createProjectDraftState({
            createId: () => "pending-track-1",
        });

        const audioFile = createFakeFile({
            name: "drums.wav",
        });

        const pendingTrack = draftState.addPendingTrack({
            trackName: "   ",
            audioFile,
        });

        tester.expect(pendingTrack.trackName).toBe("drums.wav");
    });

    tester.it("removes a pending track", () => {
        let nextId = 1;

        const draftState = createProjectDraftState({
            createId: () => `pending-track-${nextId++}`,
        });

        const firstTrack = draftState.addPendingTrack({
            trackName: "Guitar",
            audioFile: createFakeFile({ name: "guitar.wav" }),
        });

        const secondTrack = draftState.addPendingTrack({
            trackName: "Drums",
            audioFile: createFakeFile({ name: "drums.wav" }),
        });

        draftState.removePendingTrack(firstTrack.id);

        tester.expect(draftState.getPendingTracks()).toEqual([secondTrack]);
    });

    tester.it("returns a snapshot of the current draft", () => {
        const draftState = createProjectDraftState({
            createId: () => "pending-track-1",
        });

        draftState.setProjectDraft({
            title: "Band Idea",
            description: "Scratch recording",
        });

        const pendingTrack = draftState.addPendingTrack({
            trackName: "Scratch Guitar",
            audioFile: createFakeFile(),
        });

        tester.expect(draftState.getSnapshot()).toEqual({
            project: {
                title: "Band Idea",
                description: "Scratch recording",
            },
            pendingTracks: [pendingTrack],
        });
    });

    tester.it("clears the project draft and pending tracks", () => {
        const draftState = createProjectDraftState();

        draftState.setProjectDraft({
            title: "Band Idea",
            description: "Scratch recording",
        });

        draftState.addPendingTrack({
            trackName: "Scratch Guitar",
            audioFile: createFakeFile(),
        });

        draftState.clear();

        tester.expect(draftState.getProjectDraft()).toBe(null);
        tester.expect(draftState.getPendingTracks()).toEqual([]);
    });
});