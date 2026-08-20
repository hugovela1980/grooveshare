export type MixChannelSetting = {
  channelNumber: number;
  trackId: string;
  enabled: boolean;
  volume: number;
};

export type MixSettings = {
  channels: MixChannelSetting[];
};

export type ProjectRole = "owner" | "contributor" | "viewer";

export type TimeSignature = {
  numerator: number;
  denominator: number;
};

/**
 * Project-level musical timing. BPM is expressed in quarter notes per minute,
 * matching common DAW tempo conventions. Bar 1, beat 1 maps to project time 0.
 */
export type MusicalTimeline = {
  bpm: number;
  timeSignature: TimeSignature;
};

export type MusicalPosition = {
  /** One-based bar number. */
  bar: number;
  /** One-based beat within the bar. Fractional values represent sub-beat time. */
  beat: number;
};

export type Project = {
  id: string;
  title: string;
  description: string;
  /** Legacy project objects may omit this; use getProjectMusicalTimeline(). */
  musicalTimeline?: MusicalTimeline;
  mixSettings?: MixSettings;
  role?: ProjectRole | null;
  access?: "guest";
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  title: string;
  description: string;
  /** Omitted legacy callers receive the default 120 BPM, 4/4 timeline. */
  musicalTimeline?: MusicalTimeline;
};

export type UpdateProjectDetailsInput = {
  title?: string;
  description?: string;
  musicalTimeline?: MusicalTimeline;
};

export type Track = {
  id: string;
  projectId: string;
  name: string;
  originalFilename: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedByUserId?: string | null;
  /**
   * Project-timeline position where this track begins. Existing uploaded stems
   * omit the value and therefore begin at project time zero. Recording will
   * persist non-zero offsets in a later milestone.
   */
  timelineOffsetSeconds?: number;
  createdAt: string;
};

/**
 * Generic because the presentation/platform decides what an audio-file value is.
 * Browser clients specialize this to File without making frontend-core depend on
 * DOM file types.
 */
export type UploadTrackInput<TAudioFile = unknown> = {
  projectId: string;
  trackName: string;
  audioFile: TAudioFile;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type RegisterUserInput = {
  email: string;
  displayName: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type ProjectMember = {
  user: User;
  role: ProjectRole;
  createdAt: string;
  updatedAt: string;
};

export type AddProjectMemberInput = {
  email: string;
  role: Exclude<ProjectRole, "owner">;
};
