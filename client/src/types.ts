import type { User } from "@hugovela/frontend-core";

export type {
  LoginInput,
  RegisterUserInput,
  User,
} from "@hugovela/frontend-core";

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
  role?: ProjectRole;
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
  createdAt: string;
};

export type UploadTrackInput = {
  projectId: string;
  trackName: string;
  audioFile: File;
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
