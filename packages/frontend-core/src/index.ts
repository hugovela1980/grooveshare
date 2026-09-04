export type {
  ApplicationAction,
  ApplicationActionPort,
  ApplicationNavigationOptions,
  ApplicationNavigationPort,
  ApplicationRoute,
  ApplicationScreen,
} from "./application/application-navigation.js";
export {
  createInitialApplicationState,
  type ApplicationErrorContext,
  type ApplicationErrorState,
  type ApplicationLoadingState,
  type AuthenticationState,
  type GrooveShareApplicationState,
  type InvitationSessionState,
} from "./application/application-state.js";
export {
  CONTRIBUTOR_ACCEPTED_MESSAGE,
  GUEST_SESSION_EXPIRED_MESSAGE,
  INVALID_INVITATION_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  SIGNED_OUT_MESSAGE,
  createInvitationGuestWorkflow,
  type InvitationGuestWorkflow,
  type InvitationPresentationState,
  type InvitationWorkflowTransition,
} from "./application/invitation-guest-workflow.js";
export {
  MAX_PENDING_TRACKS,
  createProjectDraftState,
  type AddPendingTrackInput,
  type PendingAudioFileLike,
  type PendingTrackDraft,
  type ProjectDraft,
  type ProjectDraftSnapshot,
  type ProjectDraftState,
} from "./application/project-draft-state.js";
export {
  createGrooveShareApplicationController,
  type ApplicationActionResult,
  type ApplicationLogoutResult,
  type ApplicationProjectDraftPort,
  type GrooveShareApplicationController,
} from "./application/grooveshare-application-controller.js";
export type {
  ApplicationPresentationPort,
  AuthenticationPresentationState,
  CreateProjectPresentationState,
  ErrorPresentationState,
  LoadingPresentationState,
  ProjectPlayerPresentationState,
  ProjectsPresentationState,
} from "./application/application-presentation.js";
export type {
  AddProjectMemberInput,
  CreateProjectInput,
  LoginInput,
  MixChannelSetting,
  MixSettings,
  MusicalPosition,
  MusicalTimeline,
  PlaybackDerivative,
  PlaybackDerivativeStatus,
  Project,
  ProjectMember,
  ProjectRole,
  RegisterUserInput,
  TimeSignature,
  Track,
  TrackMusicalPlacement,
  UpdateProjectDetailsInput,
  UpdateTrackDetailsInput,
  UploadTrackInput,
  User,
} from "./domain/types.js";
export {
  DEFAULT_PROJECT_BPM,
  DEFAULT_PROJECT_MUSICAL_TIMELINE,
  DEFAULT_TIME_SIGNATURE,
  PROJECT_MUSICAL_ORIGIN,
  PROJECT_MUSICAL_ORIGIN_TRANSPORT_SECONDS,
  getProjectMusicalTimeline,
  getSecondsPerBar,
  getSecondsPerMusicalBeat,
  isValidMusicalTimeline,
  musicalPositionToTransportSeconds,
  normalizeMusicalTimeline,
  transportSecondsToMusicalPosition,
} from "./timeline/musical-timeline.js";
export {
  DEFAULT_TRACK_MUSICAL_PLACEMENT,
  DEFAULT_TRACK_MUSICAL_START_POSITION,
  getTrackMusicalEndPosition,
  getTrackMusicalPlacement,
  getTrackMusicalSpanSeconds,
  getTrackMusicalStartSeconds,
  isValidTrackMusicalPlacement,
  musicalSpanBarsToBeats,
  musicalSpanBeatsToBars,
  normalizeTrackMusicalPlacement,
} from "./timeline/track-musical-placement.js";
export {
  canContribute,
  canManageProject,
  canManageTrack,
  canPersistMix,
  canRecord,
} from "./permissions/project-permissions.js";
export {
  MicrophoneRecordingError,
  toMicrophoneRecordingFailure,
  type MicrophoneRecordingErrorCode,
  type MicrophoneRecordingFailure,
  type MicrophoneRecordingFailureHandler,
  type MicrophoneRecordingPort,
  type RecordedAudioCapture,
} from "./platform/microphone-recording-port.js";
export type {
  RecordedTakeUploadFailure,
  RecordedTakeUploadInput,
  RecordedTakeUploadPort,
} from "./platform/recorded-take-upload-port.js";
export type {
  RecordedTakePlaybackEndHandler,
  RecordedTakePlaybackFailure,
  RecordedTakePlaybackFailureHandler,
  RecordedTakePlaybackPort,
} from "./platform/recorded-take-playback-port.js";
export {
  analyzeRecordingAlignmentTrace,
  cloneRecordingAlignmentTrace,
  type RecordingAlignmentAnalysis,
  type RecordingAlignmentAttemptContext,
  type RecordingAlignmentAttemptOutcome,
  type RecordingAlignmentDiagnosticEvent,
  type RecordingAlignmentDiagnosticObservation,
  type RecordingAlignmentDiagnosticSource,
  type RecordingAlignmentDiagnosticStage,
  type RecordingAlignmentDiagnosticsPort,
  type RecordingAlignmentDiagnosticTrace,
} from "./recording/recording-alignment-diagnostics.js";
export {
  MAX_RECORDING_ALIGNMENT_COMPENSATION_MILLISECONDS,
  MIN_RECORDING_ALIGNMENT_COMPENSATION_MILLISECONDS,
  RECORDING_ALIGNMENT_COMPENSATION_STORAGE_KEY,
  loadRecordingAlignmentCompensationMilliseconds,
  normalizeRecordingAlignmentCompensationMilliseconds,
  recordingAlignmentCompensationMillisecondsToSeconds,
  saveRecordingAlignmentCompensationMilliseconds,
} from "./recording/recording-alignment-compensation.js";
export {
  createRecordingWorkspaceState,
  getRecordingWorkspaceAnchorStorageKey,
  type RecordingWorkspaceState,
} from "./recording/recording-workspace-state.js";
export {
  createMicrophoneRecordingSession,
  type MicrophoneRecordedTake,
  type MicrophoneRecordingCountIn,
  type MicrophoneRecordingSession,
  type MicrophoneRecordingSnapshot,
  type MicrophoneRecordingStartPosition,
  type MicrophoneRecordingStateListener,
  type MicrophoneRecordingStatus,
  type MicrophoneTakeRecoveryStatus,
  type MicrophoneTakeReviewStatus,
  type MicrophoneTakeSaveStatus,
} from "./recording/microphone-recording-session.js";
export type { SessionProvider } from "./platform/session-provider.js";
export type { StorageProvider } from "./platform/storage-provider.js";
export type {
  RecordedTakeDraft,
  RecordedTakeDraftPort,
} from "./platform/recorded-take-draft-port.js";
export type {
  PlaybackChannel,
  PlaybackChannelPreparationSnapshot,
  PlaybackChannelPreparationStatus,
  PlaybackEngine,
  PlaybackPreparationFailure,
  PlaybackPreparationSnapshot,
  PlaybackPreparationStatus,
  PlaybackSnapshot,
  PlaybackStateListener,
  RecordedTakeAuditionOptions,
  SynchronizedRecordingPlaybackStart,
  SynchronizedRecordingPlaybackSnapshot,
} from "./playback/playback-engine.js";
export {
  createTransport,
  type ClearTransportInterval,
  type ScheduleTransportInterval,
  type PlaybackScheduleInstruction,
  type Transport,
  type TransportOptions,
  type TransportPlaybackState,
  type TransportPlayOptions,
  type TransportSnapshot,
  type TransportStateListener,
  type TransportTimelineMarker,
} from "./playback/transport.js";
export {
  getAlignedSourceOffsetSeconds,
  getTrackSourceAlignmentWindow,
  normalizeTrackAlignmentOffsetSeconds,
  normalizeTrackMediaLeadInSeconds,
  type TrackSourceAlignmentWindow,
} from "./playback/track-source-alignment.js";
export {
  DEFAULT_TRACK_TIMELINE_OFFSET_SECONDS,
  createRecordingTimeline,
  getTrackTimelineOffsetSeconds,
  type RecordingPositionMetadata,
  type RecordingStartMarker,
  type RecordingStopMarker,
  type RecordingTimeline,
  type RecordingTimelineResult,
} from "./playback/recording-timeline.js";
export {
  DEFAULT_PLAYBACK_MEDIA_PREPARATION_POLICY,
  type PlaybackChannelMediaSources,
  type PlaybackMediaPreparationPolicy,
  type PlaybackMediaRepresentation,
} from "./playback/playback-media.js";
export {
  createHtmlAudioPlaybackEngine,
  type HtmlAudioElementLike,
} from "./playback/html-audio-playback-engine.js";
export {
  createWebAudioPlaybackEngine,
} from "./playback/web-audio-playback-engine.js";
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
export {
  ApiError,
  parseApiResponse,
  parseApiSuccess,
  type ApiHeaders,
  type ApiRequestOptions,
  type ApiTransport,
  type ApiTransportResponse,
  type MultipartBodyFactory,
} from "./services/api-transport.js";
export {
  createAuthService,
  type AuthService,
} from "./services/auth-service.js";
export {
  createProjectsService,
  type ProjectsService,
} from "./services/projects-service.js";
export {
  createTracksService,
  type TracksService,
} from "./services/tracks-service.js";
export {
  createProjectMembersService,
  type ProjectMembersService,
} from "./services/project-members-service.js";
export {
  PROJECT_INVITATION_HEADER,
  createInvitationsService,
  type AcceptedProjectInvitation,
  type GeneratedProjectInvitation,
  type InvitationsService,
  type ProjectInvitationStatus,
  type ResolvedGuestInvitation,
} from "./services/invitations-service.js";
export {
  createFrontendServices,
  type FrontendServices,
} from "./services/frontend-services.js";
export {
  createGuestMixStorageProvider,
  getGuestMixStorageKey,
} from "./mix/guest-mix-storage.js";
export {
  isInvitationSessionState,
  type InvitationSessionStore,
} from "./platform/invitation-session-store.js";
