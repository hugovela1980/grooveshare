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

export type Project = {
  id: string;
  title: string;
  description: string;
  mixSettings?: MixSettings;
  role?: ProjectRole | null;
  access?: "guest";
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  title: string;
  description: string;
};

export type UpdateProjectDetailsInput = {
  title?: string;
  description?: string;
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
