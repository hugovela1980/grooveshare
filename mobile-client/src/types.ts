import type {
  Project as CoreProject,
  ProjectRole as CoreProjectRole,
  UploadTrackInput as CoreUploadTrackInput,
} from "@hugovela/frontend-core";

export type {
  AddProjectMemberInput,
  CreateProjectInput,
  LoginInput,
  MixChannelSetting,
  MixSettings,
  ProjectMember,
  RegisterUserInput,
  Track,
  UpdateProjectDetailsInput,
  User,
} from "@hugovela/frontend-core";

export type ProjectRole = CoreProjectRole;

export type Project = Omit<CoreProject, "role"> & {
  role?: ProjectRole | null;
  access?: "guest";
};

export type UploadTrackInput = CoreUploadTrackInput<File>;
