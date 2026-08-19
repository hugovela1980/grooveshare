import type { CreateProjectInput } from "../domain/types.js";

export const MAX_PENDING_TRACKS = 4;

export type ProjectDraft = CreateProjectInput;

export type PendingAudioFileLike = {
  name: string;
  type: string;
  size: number;
};

export type PendingTrackDraft<
  TAudioFile extends PendingAudioFileLike = PendingAudioFileLike,
> = {
  id: string;
  trackName: string;
  audioFile: TAudioFile;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
};

export type AddPendingTrackInput<
  TAudioFile extends PendingAudioFileLike = PendingAudioFileLike,
> = {
  trackName: string;
  audioFile: TAudioFile;
};

export type ProjectDraftSnapshot<
  TAudioFile extends PendingAudioFileLike = PendingAudioFileLike,
> = {
  project: ProjectDraft | null;
  pendingTracks: PendingTrackDraft<TAudioFile>[];
};

export type ProjectDraftState<
  TAudioFile extends PendingAudioFileLike = PendingAudioFileLike,
> = ReturnType<typeof createProjectDraftState<TAudioFile>>;

function createDefaultId(): string {
  const cryptoLike = (globalThis as {
    crypto?: { randomUUID?: () => string };
  }).crypto;

  return cryptoLike?.randomUUID?.() ??
    `pending-track-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Shared create-project draft behavior. The audio-file type is generic so the
 * core owns track-draft rules without depending on the browser File type.
 */
export function createProjectDraftState<
  TAudioFile extends PendingAudioFileLike = PendingAudioFileLike,
>({
  createId = createDefaultId,
}: {
  createId?: () => string;
} = {}) {
  let project: ProjectDraft | null = null;
  let pendingTracks: PendingTrackDraft<TAudioFile>[] = [];

  function setProjectDraft(input: CreateProjectInput): void {
    project = {
      title: input.title.trim(),
      description: input.description.trim(),
    };
  }

  function getProjectDraft(): ProjectDraft | null {
    return project;
  }

  function getPendingTrackSlotsRemaining(): number {
    return Math.max(MAX_PENDING_TRACKS - pendingTracks.length, 0);
  }

  function canAddPendingTracks(trackCount: number): boolean {
    return trackCount <= getPendingTrackSlotsRemaining();
  }

  function createPendingTrack({
    trackName,
    audioFile,
  }: AddPendingTrackInput<TAudioFile>): PendingTrackDraft<TAudioFile> {
    return {
      id: createId(),
      trackName: trackName.trim() || audioFile.name,
      audioFile,
      originalFilename: audioFile.name,
      mimeType: audioFile.type,
      fileSize: audioFile.size,
    };
  }

  function addPendingTracks(
    inputs: AddPendingTrackInput<TAudioFile>[],
  ): PendingTrackDraft<TAudioFile>[] {
    if (!canAddPendingTracks(inputs.length)) {
      throw new Error(
        `A project can include up to ${MAX_PENDING_TRACKS} audio tracks.`,
      );
    }

    const newPendingTracks = inputs.map(createPendingTrack);
    pendingTracks = [...pendingTracks, ...newPendingTracks];

    return newPendingTracks;
  }

  function addPendingTrack(
    input: AddPendingTrackInput<TAudioFile>,
  ): PendingTrackDraft<TAudioFile> {
    return addPendingTracks([input])[0];
  }

  function updatePendingTrackName(trackDraftId: string, trackName: string): void {
    pendingTracks = pendingTracks.map((track) => {
      if (track.id !== trackDraftId) {
        return track;
      }

      return {
        ...track,
        trackName: trackName.trim() || track.originalFilename,
      };
    });
  }

  function removePendingTrack(trackDraftId: string): void {
    pendingTracks = pendingTracks.filter((track) => track.id !== trackDraftId);
  }

  function getPendingTracks(): PendingTrackDraft<TAudioFile>[] {
    return pendingTracks;
  }

  function getSnapshot(): ProjectDraftSnapshot<TAudioFile> {
    return {
      project,
      pendingTracks,
    };
  }

  function clear(): void {
    project = null;
    pendingTracks = [];
  }

  return {
    setProjectDraft,
    getProjectDraft,
    addPendingTrack,
    addPendingTracks,
    updatePendingTrackName,
    removePendingTrack,
    getPendingTracks,
    getPendingTrackSlotsRemaining,
    canAddPendingTracks,
    getSnapshot,
    clear,
  };
}
