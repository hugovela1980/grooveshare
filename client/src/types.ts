import type { UploadTrackInput as CoreUploadTrackInput } from "@hugovela/frontend-core";

export type {
  AddProjectMemberInput,
  CreateProjectInput,
  LoginInput,
  MixChannelSetting,
  MixSettings,
  Project,
  ProjectMember,
  ProjectRole,
  RegisterUserInput,
  Track,
  UpdateProjectDetailsInput,
  User,
} from "@hugovela/frontend-core";

export type UploadTrackInput = CoreUploadTrackInput<File>;
