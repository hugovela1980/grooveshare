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
  MusicalPosition,
  MusicalTimeline,
  Project,
  ProjectMember,
  RegisterUserInput,
  TimeSignature,
  Track,
  UpdateProjectDetailsInput,
  User,
} from "@hugovela/frontend-core";

export type ProjectRole = CoreProjectRole;

export type UploadTrackInput = CoreUploadTrackInput<File>;
