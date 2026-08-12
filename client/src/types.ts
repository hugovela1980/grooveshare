export type MixChannelSetting = {
  channelNumber: number;
  trackId: string;
  enabled: boolean;
  volume: number;
};

export type MixSettings = {
  channels: MixChannelSetting[];
};

export type Project = {
  id: string;
  title: string;
  description: string;
  mixSettings?: MixSettings;
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
  createdAt: string;
};

export type UploadTrackInput = {
  projectId: string;
  trackName: string;
  audioFile: File;
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
