import type {
  ProjectRole as CoreProjectRole,
  UploadTrackInput as CoreUploadTrackInput,
} from "@hugovela/frontend-core";

export type {
  AddProjectMemberInput,
  CreateProjectInput,
  LoginInput,
  MixChannelSetting,
  MixSettings,
  Project,
  ProjectMember,
  RegisterUserInput,
  Track,
  UpdateProjectDetailsInput,
  User,
} from "@hugovela/frontend-core";

export type ProjectRole = CoreProjectRole;

export type UploadTrackInput = CoreUploadTrackInput<File>;
