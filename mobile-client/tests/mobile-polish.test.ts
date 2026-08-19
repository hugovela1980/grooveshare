import type { Project, ProjectMember, User } from "../src/types.js";
import { createAuthPageController } from "../src/page-controllers/auth-page-controller.js";
import { createCreateProjectConfirmationController } from "../src/page-controllers/create-project-confirmation-controller.js";
import { createProjectTrackSelectionController } from "../src/page-controllers/create-project-track-selection-controller.js";
import { createProjectMembersController } from "../src/page-controllers/project-members-controller.js";
import { createProjectDraftState, type PendingTrackDraft as CorePendingTrackDraft } from "@hugovela/frontend-core";

type PendingTrackDraft = CorePendingTrackDraft<File>;
import { renderAuthPage } from "../src/pages/auth-page.js";
import { renderCreateProjectPage } from "../src/pages/create-project-page.js";
import { renderProjectList } from "../src/templates/project-list.js";
import { renderProjectMemberList, renderProjectMembersPanel } from "../src/templates/project-members.js";
import { renderProjectInvitationPanel } from "../src/templates/project-invitation-controls.js";
import { renderProjectActionsMenu } from "../src/templates/project-actions-menu.js";
import {
  renderProjectEditDialog,
  renderTrackEditDialog,
} from "../src/templates/project-player-edit-dialogs.js";
import {
  MAX_MOBILE_AUDIO_FILE_SIZE_BYTES,
  validateMobileAudioFile,
} from "../src/uploads/mobile-audio-files.js";
import { tester } from "./test-runner/tester.js";

const user: User = {
  id: "user-1",
  email: "musician@example.com",
  displayName: "Musician",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createButton() {
  let clickHandler: (() => void | Promise<void>) | null = null;
  const attributes = new Map<string, string>();

  return {
    disabled: false,
    textContent: null as string | null,
    addEventListener(eventName: string, handler: () => void | Promise<void>) {
      if (eventName === "click") {
        clickHandler = handler;
      }
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    removeAttribute(name: string) {
      attributes.delete(name);
    },
    async click() {
      await clickHandler?.();
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
  };
}

function createForm() {
  let submitHandler:
    | ((event: { preventDefault: () => void }) => void | Promise<void>)
    | null = null;

  return {
    addEventListener(
      eventName: string,
      handler: (event: { preventDefault: () => void }) => void | Promise<void>,
    ) {
      if (eventName === "submit") {
        submitHandler = handler;
      }
    },
    async submit() {
      await submitHandler?.({ preventDefault() {} });
    },
  };
}

tester.describe("mobile authentication polish", () => {
  tester.it("renders a single-screen login/register switch with mobile keyboard hints", () => {
    const html = renderAuthPage();

    tester.expect(html.includes('id="show-login-button"')).toBe(true);
    tester.expect(html.includes('id="show-register-button"')).toBe(true);
    tester.expect(html.includes('id="register-card"')).toBe(true);
    tester.expect(html.includes('id="register-card"\n          class="panel auth-card"\n          aria-labelledby="register-heading"\n          hidden')).toBe(true);
    tester.expect(html.includes('inputmode="email"')).toBe(true);
    tester.expect(html.includes('enterkeyhint="go"')).toBe(true);
  });

  tester.it("switches between login and registration without submitting", () => {
    const loginForm = createForm();
    const registerForm = createForm();
    const loginModeButton = createButton();
    const registerModeButton = createButton();
    const loginCard = { hidden: false as boolean | string };
    const registerCard = { hidden: true as boolean | string };
    const statusElement = { textContent: "old message" as string | null };

    const controller = createAuthPageController({
      loginForm,
      loginEmailInput: { value: "" },
      loginPasswordInput: { value: "" },
      loginSubmitButton: createButton(),
      registerForm,
      registerDisplayNameInput: { value: "" },
      registerEmailInput: { value: "" },
      registerPasswordInput: { value: "" },
      registerSubmitButton: createButton(),
      statusElement,
      sessionProvider: {
        async login() {
          return user;
        },
        async registerUser() {
          return user;
        },
      },
      onAuthenticated() {},
      loginModeButton,
      registerModeButton,
      loginCard,
      registerCard,
    });

    controller.init();
    registerModeButton.click();

    tester.expect(loginCard.hidden).toBe(true);
    tester.expect(registerCard.hidden).toBe(false);
    tester.expect(registerModeButton.getAttribute("aria-selected")).toBe("true");

    loginModeButton.click();

    tester.expect(loginCard.hidden).toBe(false);
    tester.expect(registerCard.hidden).toBe(true);
    tester.expect(loginModeButton.getAttribute("aria-selected")).toBe("true");
  });
});

tester.describe("mobile project/menu templates", () => {
  tester.it("renders projects as touch-friendly cards with role and description", () => {
    const project: Project = {
      id: "project-1",
      title: "Phone Song",
      description: "Verse demo",
      role: "contributor",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const html = renderProjectList([project]);

    tester.expect(html.includes("Phone Song")).toBe(true);
    tester.expect(html.includes("Verse demo")).toBe(true);
    tester.expect(html.includes("Contributor")).toBe(true);
  });

  tester.it("renders create-project audio guidance and m4a-compatible file selection", () => {
    const html = renderCreateProjectPage();

    tester.expect(html.includes("Choose Audio Files")).toBe(true);
    tester.expect(html.includes("M4A")).toBe(true);
    tester.expect(html.includes("100 MB")).toBe(true);
    tester.expect(html.includes(".m4a")).toBe(true);
    tester.expect(html.includes("Review Project")).toBe(true);
  });
});

tester.describe("mobile audio-file validation", () => {
  tester.it("accepts common m4a MIME identities used by phone file pickers", () => {
    for (const type of ["audio/mp4", "audio/m4a", "audio/x-m4a", "video/mp4", "application/octet-stream"]) {
      const result = validateMobileAudioFile({
        name: "voice-memo.m4a",
        type,
        size: 1024,
      });

      tester.expect(result.ok).toBe(true);
    }
  });

  tester.it("rejects oversized files before they are added to the draft", () => {
    const result = validateMobileAudioFile({
      name: "huge.m4a",
      type: "audio/mp4",
      size: MAX_MOBILE_AUDIO_FILE_SIZE_BYTES + 1,
    });

    tester.expect(result.ok).toBe(false);

    if (!result.ok) {
      tester.expect(result.error.includes("100 MB")).toBe(true);
    }
  });

  tester.it("rejects non-audio generic files", () => {
    const result = validateMobileAudioFile({
      name: "notes.txt",
      type: "application/octet-stream",
      size: 12,
    });

    tester.expect(result.ok).toBe(false);
  });
});

tester.describe("mobile create-project track selection", () => {
  tester.it("adds valid phone audio and reports invalid selections without losing valid files", () => {
    const projectDraftState = createProjectDraftState<File>({ createId: () => "track-draft-1" });
    const addTracksButton = {
      addEventListener(
        _eventName: string,
        _handler: (event: { preventDefault?: () => void }) => void | Promise<void>,
      ) {},
    };
    const validFile = new File(["audio"], "memo.m4a", { type: "audio/x-m4a" });
    const invalidFile = new File(["text"], "notes.txt", { type: "text/plain" });
    let changeHandler: ((event: { target?: unknown }) => void) | null = null;
    const audioFileInput = {
      files: [validFile, invalidFile],
      value: "",
      click() {},
      addEventListener(
        eventName: string,
        handler: (event: { target?: unknown }) => void,
      ) {
        if (eventName === "change") {
          changeHandler = handler;
        }
      },
    };
    const statusElement = { textContent: "" as string | null };
    const tracksToIncludeSection = { hidden: true as boolean | "until-found" };
    const pendingTrackListElement = {
      innerHTML: "",
      addEventListener() {},
    };

    const controller = createProjectTrackSelectionController({
      addTracksButton,
      audioFileInput: audioFileInput as any,
      statusElement,
      tracksToIncludeSection,
      pendingTrackListElement,
      projectDraftState,
      renderPendingTrackList(tracks: PendingTrackDraft[]) {
        return tracks.map((track: PendingTrackDraft) => track.trackName).join(",");
      },
    });

    controller.init();
    (changeHandler as ((event: { target?: unknown }) => void) | null)?.({});

    tester.expect(projectDraftState.getPendingTracks().length).toBe(1);
    tester.expect(projectDraftState.getPendingTracks()[0]?.trackName).toBe("memo");
    tester.expect(statusElement.textContent?.includes("notes.txt")).toBe(true);
    tester.expect(tracksToIncludeSection.hidden).toBe(false);
  });
});

tester.describe("mobile create-project upload feedback", () => {
  tester.it("does not create a duplicate project after a track upload failure", async () => {
    const submitButton = createButton();
    const statusElement = { textContent: "" as string | null };
    const audioFile = new File(["audio"], "memo.m4a", { type: "audio/mp4" });
    const draftState = createProjectDraftState<File>({ createId: () => "draft-1" });
    draftState.setProjectDraft({ title: "Song", description: "" });
    draftState.addPendingTrack({ trackName: "Memo", audioFile });

    const project: Project = {
      id: "project-1",
      title: "Song",
      description: "",
      role: "owner",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    let createCallCount = 0;
    let openCallCount = 0;

    const controller = createCreateProjectConfirmationController({
      submitButton,
      statusElement,
      projectDraftState: draftState,
      projectsApi: {
        async createProject() {
          createCallCount += 1;
          return project;
        },
      },
      tracksApi: {
        async uploadTrack() {
          throw new Error("upload failed");
        },
      },
      onProjectSubmitted() {
        openCallCount += 1;
      },
    });

    controller.init();
    await submitButton.click();

    tester.expect(createCallCount).toBe(1);
    tester.expect(openCallCount).toBe(0);
    tester.expect(submitButton.textContent).toBe("Open Project");
    tester.expect(statusElement.textContent?.includes("could not upload")).toBe(true);

    await submitButton.click();

    tester.expect(createCallCount).toBe(1);
    tester.expect(openCallCount).toBe(1);
  });
});

tester.describe("mobile edit-dialog polish", () => {
  tester.it("uses readable light-surface Cancel buttons for project and track editors", () => {
    const projectHtml = renderProjectEditDialog();
    const trackHtml = renderTrackEditDialog();

    tester.expect(projectHtml.includes('id="cancel-project-edit-button"\n              class="button button--secondary-light"')).toBe(true);
    tester.expect(trackHtml.includes('id="cancel-track-edit-button"\n              class="button button--secondary-light"')).toBe(true);
  });
});

tester.describe("mobile Owner controls", () => {
  tester.it("separates Manage Members and Collaboration Link in the project menu", () => {
    const menuHtml = renderProjectActionsMenu();
    const membersHtml = renderProjectMembersPanel({ hidden: true });
    const invitationHtml = renderProjectInvitationPanel({ hidden: true });

    tester.expect(menuHtml.includes("Manage Members")).toBe(true);
    tester.expect(menuHtml.includes("Collaboration Link")).toBe(true);
    tester.expect(membersHtml.includes('class="modal owner-controls-modal"')).toBe(true);
    tester.expect(membersHtml.includes('id="close-project-members-button"')).toBe(true);
    tester.expect(membersHtml.includes("Manage Members")).toBe(true);
    tester.expect(membersHtml.includes("Viewer — listen only")).toBe(true);
    tester.expect(membersHtml.includes("Generate Link")).toBe(false);
    tester.expect(invitationHtml.includes('id="project-invitation-panel"')).toBe(true);
    tester.expect(invitationHtml.includes("Generate Link")).toBe(true);
    tester.expect(invitationHtml.includes("project-invitation-controls__secondary-action")).toBe(true);
  });

  tester.it("can reload the member list after the modal has already been initialized", async () => {
    const form = createForm();
    const submitButton = createButton();
    const roleSelect = {
      ...createButton(),
      value: "viewer",
    };
    const memberListElement = {
      innerHTML: "",
      addEventListener() {},
      setAttribute() {},
      removeAttribute() {},
    };
    let loadCount = 0;
    let members: ProjectMember[] = [
      {
        user,
        role: "owner",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const controller = createProjectMembersController({
      projectId: "project-1",
      form,
      emailInput: { value: "" },
      roleSelect,
      submitButton,
      memberListElement,
      projectMembersApi: {
        async getProjectMembers() {
          loadCount += 1;
          return members;
        },
        async addProjectMember() {
          throw new Error("not used");
        },
        async updateProjectMemberRole() {
          throw new Error("not used");
        },
        async removeProjectMember() {
          throw new Error("not used");
        },
      },
      renderMembers: renderProjectMemberList,
    });

    await controller.init();
    members = [
      ...members,
      {
        user: {
          ...user,
          id: "user-2",
          displayName: "New Collaborator",
          email: "new@example.com",
        },
        role: "contributor",
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ];

    await controller.loadMembers();

    tester.expect(loadCount).toBe(2);
    tester.expect(memberListElement.innerHTML.includes("New Collaborator")).toBe(true);
  });

  tester.it("dismisses member-email focus after a member is added", async () => {
    const form = createForm();
    const submitButton = createButton();
    const roleSelect = {
      ...createButton(),
      value: "viewer",
    };
    let blurCallCount = 0;
    const emailInput = {
      value: "bass@example.com",
      blur() {
        blurCallCount += 1;
      },
    };
    const memberListElement = {
      innerHTML: "",
      addEventListener() {},
      setAttribute() {},
      removeAttribute() {},
    };

    const controller = createProjectMembersController({
      projectId: "project-1",
      form,
      emailInput,
      roleSelect,
      submitButton,
      memberListElement,
      projectMembersApi: {
        async getProjectMembers() {
          return [];
        },
        async addProjectMember() {
          return {
            user: {
              ...user,
              id: "user-2",
              email: "bass@example.com",
            },
            role: "viewer" as const,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          };
        },
        async updateProjectMemberRole() {
          throw new Error("not used");
        },
        async removeProjectMember() {
          throw new Error("not used");
        },
      },
      renderMembers: renderProjectMemberList,
    });

    await controller.init();
    await form.submit();

    tester.expect(emailInput.value).toBe("");
    tester.expect(blurCallCount).toBe(1);
  });

  tester.it("names the member in destructive removal confirmation", async () => {
    const owner: ProjectMember = {
      user,
      role: "owner",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const collaborator: ProjectMember = {
      user: {
        ...user,
        id: "user-2",
        email: "bass@example.com",
        displayName: "Bass Player",
      },
      role: "viewer",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    let clickHandler:
      | ((event: { target: EventTarget | null }) => void | Promise<void>)
      | null = null;
    let changeHandler:
      | ((event: { target: EventTarget | null }) => void | Promise<void>)
      | null = null;
    const memberListElement = {
      innerHTML: "",
      addEventListener(eventName: "click" | "change", handler: (event: { target: EventTarget | null }) => void | Promise<void>) {
        if (eventName === "click") clickHandler = handler;
        if (eventName === "change") changeHandler = handler;
      },
      setAttribute() {},
      removeAttribute() {},
    };
    const form = createForm();
    const submitButton = createButton();
    const roleSelect = {
      ...createButton(),
      value: "viewer",
    };
    let confirmationMessage = "";
    let removeCallCount = 0;

    const controller = createProjectMembersController({
      projectId: "project-1",
      form,
      emailInput: { value: "" },
      roleSelect,
      submitButton,
      memberListElement,
      projectMembersApi: {
        async getProjectMembers() {
          return [owner, collaborator];
        },
        async addProjectMember() {
          return collaborator;
        },
        async updateProjectMemberRole() {
          return collaborator;
        },
        async removeProjectMember() {
          removeCallCount += 1;
          return collaborator;
        },
      },
      renderMembers: renderProjectMemberList,
      confirmRemoveMember(message) {
        confirmationMessage = message;
        return true;
      },
    });

    await controller.init();

    const removeButton = {
      disabled: false,
      dataset: {
        userId: "user-2",
        memberName: "Bass Player",
      },
      setAttribute() {},
      removeAttribute() {},
    };

    await (clickHandler as ((event: { target: EventTarget | null }) => void | Promise<void>) | null)?.({
      target: {
        closest() {
          return removeButton;
        },
      } as unknown as EventTarget,
    });

    tester.expect(confirmationMessage).toBe('Remove "Bass Player" from this project?');
    tester.expect(removeCallCount).toBe(1);
    tester.expect(changeHandler !== null).toBe(true);
  });
});
