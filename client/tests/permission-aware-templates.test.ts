import { renderProjectPlayerPage } from "../src/pages/project-player-page.js";
import { renderMixChannelSlots } from "../src/templates/mix-channel-slots.js";
import type { Project, Track } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

function createProject(role: Project["role"]): Project {
  return {
    id: "project-1",
    title: "Role Demo",
    description: "Permission test",
    role,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function createTrack(
  id: string,
  uploadedByUserId: string | null,
): Track {
  return {
    id,
    projectId: "project-1",
    name: id,
    originalFilename: `${id}.wav`,
    filePath: `uploads/${id}.wav`,
    mimeType: "audio/wav",
    fileSize: 123,
    uploadedByUserId,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function count(html: string, text: string): number {
  return html.split(text).length - 1;
}

tester.describe("permission-aware templates", () => {
  tester.it("renders Viewer project controls as read-only while keeping playback UI", () => {
    const html = renderProjectPlayerPage(createProject("viewer"));

    tester.expect(html.includes("Viewer")).toBe(true);
    tester.expect(html.includes("Delete Project")).toBe(false);
    tester.expect(html.includes('id="project-actions-button"')).toBe(false);
    tester.expect(html.includes('contenteditable="true"')).toBe(false);
    tester.expect(html.includes("Project Members")).toBe(false);
    tester.expect(html.includes("Project Player")).toBe(true);
  });

  tester.it("renders Contributor project details as read-only without member management", () => {
    const html = renderProjectPlayerPage(createProject("contributor"));

    tester.expect(html.includes("Contributor")).toBe(true);
    tester.expect(html.includes("Delete Project")).toBe(false);
    tester.expect(html.includes('id="project-actions-button"')).toBe(false);
    tester.expect(html.includes('contenteditable="true"')).toBe(false);
    tester.expect(html.includes("Project Members")).toBe(false);
  });

  tester.it("renders Owner project editing and member-management controls", () => {
    const html = renderProjectPlayerPage(createProject("owner"));

    tester.expect(html.includes("Owner")).toBe(true);
    tester.expect(html.includes("Delete Project")).toBe(true);
    tester.expect(html.includes("Edit Project")).toBe(false);
    tester.expect(html.includes("Owner Controls")).toBe(false);
    tester.expect(html.includes("Manage Members")).toBe(true);
    tester.expect(html.includes("Collaboration Link")).toBe(true);
    tester.expect(html.includes('id="project-actions-button"')).toBe(true);
    tester.expect(html.includes('id="edit-project-menu-item"')).toBe(false);
    tester.expect(html.includes('id="manage-members-menu-item"')).toBe(true);
    tester.expect(html.includes('id="collaboration-link-menu-item"')).toBe(true);
    tester.expect(html.includes('id="owner-controls-menu-item"')).toBe(false);
    tester.expect(html.includes('id="project-edit-modal"')).toBe(false);
    tester.expect(html.includes('id="project-edit-form"')).toBe(false);
    tester.expect(html.includes('contenteditable="true"')).toBe(true);
    tester.expect(html.includes('id="project-member-form"')).toBe(true);
    tester.expect(html.includes('id="project-members-panel"')).toBe(true);

    const membersPanelStart = html.indexOf('id="project-members-panel"');
    const membersPanelOpeningTag = html.slice(
      membersPanelStart,
      membersPanelStart + 240,
    );

    tester.expect(membersPanelOpeningTag.includes("hidden")).toBe(true);
  });

  tester.it("keeps Viewer mixer controls but removes track mutation controls", () => {
    const html = renderMixChannelSlots(
      [createTrack("track-1", "owner-1")],
      undefined,
      {
        role: "viewer",
        currentUserId: "viewer-1",
      },
    );

    tester.expect(html.includes("Load Mix")).toBe(false);
    tester.expect(html.includes("data-channel-enabled")).toBe(true);
    tester.expect(html.includes("data-channel-volume")).toBe(true);
    tester.expect(html.includes("data-track-delete-button")).toBe(false);
    tester.expect(html.includes("data-track-name-editor")).toBe(false);
    tester.expect(html.includes("data-track-add-button")).toBe(false);
  });

  tester.it("lets Contributors edit/delete only their own track and still add tracks", () => {
    const html = renderMixChannelSlots(
      [
        createTrack("own-track", "contributor-1"),
        createTrack("owner-track", "owner-1"),
      ],
      undefined,
      {
        role: "contributor",
        currentUserId: "contributor-1",
      },
    );

    tester.expect(count(html, "data-track-delete-button")).toBe(1);
    tester.expect(count(html, "data-track-name-editor")).toBe(1);
    tester.expect(html.includes("data-track-add-button")).toBe(true);
  });

  tester.it("lets Owners edit/delete every track", () => {
    const html = renderMixChannelSlots(
      [
        createTrack("track-1", "contributor-1"),
        createTrack("track-2", null),
      ],
      undefined,
      {
        role: "owner",
        currentUserId: "owner-1",
      },
    );

    tester.expect(count(html, "data-track-delete-button")).toBe(2);
    tester.expect(count(html, "data-track-name-editor")).toBe(2);
  });
});
