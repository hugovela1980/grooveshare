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
  UploadTrackInput,
  User,
} from "./domain/types.js";
export {
  canContribute,
  canManageProject,
  canManageTrack,
  canPersistMix,
} from "./permissions/project-permissions.js";
export type { SessionProvider } from "./platform/session-provider.js";
export type { StorageProvider } from "./platform/storage-provider.js";
export type {
  PlaybackChannel,
  PlaybackEngine,
  PlaybackSnapshot,
  PlaybackStateListener,
} from "./playback/playback-engine.js";
export {
  createHtmlAudioPlaybackEngine,
  type HtmlAudioElementLike,
} from "./playback/html-audio-playback-engine.js";
export {
  clearPendingMixSettings,
  getPendingMixStorageKey,
  getViewerMixStorageKey,
  loadPendingMixSettings,
  loadViewerMixSettings,
  savePendingMixSettings,
  saveViewerMixSettings,
} from "./mix/mix-storage.js";
export {
  createMixPersistenceCoordinator,
  type MixPersistenceCoordinator,
  type SaveServerMixSettings,
} from "./mix/mix-persistence.js";
