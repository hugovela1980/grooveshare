import type { ProjectRole, Track } from "../domain/types.js";

export function canContribute(role: ProjectRole): boolean {
  return role === "contributor" || role === "owner";
}

export function canManageProject(role: ProjectRole): boolean {
  return role === "owner";
}

export function canPersistMix(role: ProjectRole): boolean {
  return canContribute(role);
}

export function canRecord(role: ProjectRole): boolean {
  return canContribute(role);
}

export function canManageTrack({
  role,
  currentUserId,
  track,
}: {
  role: ProjectRole;
  currentUserId: string | null;
  track: Track;
}): boolean {
  if (role === "owner") {
    return true;
  }

  if (role !== "contributor" || !currentUserId) {
    return false;
  }

  return track.uploadedByUserId === currentUserId;
}
