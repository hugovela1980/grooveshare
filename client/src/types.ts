export type Project = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  title: string;
  description: string;
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