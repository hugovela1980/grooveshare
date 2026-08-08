import {
    MAX_PENDING_TRACKS,
    createProjectDraftState,
} from "../src/project-draft/project-draft-state.js";
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

    tester.it("updates a pending track name", () => {
        const projectDraftState = createProjectDraftState({
            createId: () => "pending-track-1",
        });

        projectDraftState.addPendingTrack({
            trackName: "Guitar",
            audioFile: createFakeFile({
                name: "guitar.wav",
            }),
        });

        projectDraftState.updatePendingTrackName("pending-track-1", "Lead Guitar");

        tester.expect(projectDraftState.getPendingTracks()[0].trackName).toBe(
            "Lead Guitar",
        );
    });

    tester.it("adds multiple pending tracks at once", () => {
        let nextId = 1;

        const draftState = createProjectDraftState({
            createId: () => `pending-track-${nextId++}`,
        });

        const guitarFile = createFakeFile({
            name: "guitar.wav",
            type: "audio/wav",
            size: 111,
        });

        const bassFile = createFakeFile({
            name: "bass.wav",
            type: "audio/wav",
            size: 222,
        });

        const pendingTracks = draftState.addPendingTracks([
            {
                trackName: "Guitar",
                audioFile: guitarFile,
            },
            {
                trackName: "Bass",
                audioFile: bassFile,
            },
        ]);

        tester.expect(pendingTracks.length).toBe(2);

        tester.expect(draftState.getPendingTracks()).toEqual([
            {
                id: "pending-track-1",
                trackName: "Guitar",
                audioFile: guitarFile,
                originalFilename: "guitar.wav",
                mimeType: "audio/wav",
                fileSize: 111,
            },
            {
                id: "pending-track-2",
                trackName: "Bass",
                audioFile: bassFile,
                originalFilename: "bass.wav",
                mimeType: "audio/wav",
                fileSize: 222,
            },
        ]);
    });

    tester.it("tracks how many pending track slots remain", () => {
        const draftState = createProjectDraftState();

        tester.expect(draftState.getPendingTrackSlotsRemaining()).toBe(
            MAX_PENDING_TRACKS,
        );

        draftState.addPendingTracks([
            {
                trackName: "Guitar",
                audioFile: createFakeFile({ name: "guitar.wav" }),
            },
            {
                trackName: "Bass",
                audioFile: createFakeFile({ name: "bass.wav" }),
            },
        ]);

        tester.expect(draftState.getPendingTrackSlotsRemaining()).toBe(2);
        tester.expect(draftState.canAddPendingTracks(2)).toBe(true);
        tester.expect(draftState.canAddPendingTracks(3)).toBe(false);
    });

    tester.it("does not allow more than four pending tracks", () => {
        const draftState = createProjectDraftState();

        draftState.addPendingTracks([
            {
                trackName: "Track One",
                audioFile: createFakeFile({ name: "track-one.wav" }),
            },
            {
                trackName: "Track Two",
                audioFile: createFakeFile({ name: "track-two.wav" }),
            },
            {
                trackName: "Track Three",
                audioFile: createFakeFile({ name: "track-three.wav" }),
            },
        ]);

        let errorMessage = "";

        try {
            draftState.addPendingTracks([
                {
                    trackName: "Track Four",
                    audioFile: createFakeFile({ name: "track-four.wav" }),
                },
                {
                    trackName: "Track Five",
                    audioFile: createFakeFile({ name: "track-five.wav" }),
                },
            ]);
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : "";
        }

        tester.expect(errorMessage).toBe(
            "A project can include up to 4 audio tracks.",
        );

        tester.expect(draftState.getPendingTracks().length).toBe(3);
    });
});