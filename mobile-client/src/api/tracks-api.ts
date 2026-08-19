import type { TracksService } from "@hugovela/frontend-core";
import { frontendServices } from "./api-client.js";

export type TracksApi = TracksService<File>;
export const tracksApi = frontendServices.tracks;

export const getTracksByProjectId = tracksApi.getTracksByProjectId;
export const uploadTrack = tracksApi.uploadTrack;
export const updateTrackName = tracksApi.updateTrackName;
export const deleteTrack = tracksApi.deleteTrack;
export const getTrackAudioUrl = tracksApi.getTrackAudioUrl;
export const createInvitationAudioDataFetcher =
  tracksApi.createInvitationAudioDataFetcher;
