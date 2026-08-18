import type {
  GeneratedProjectInvitation,
  ProjectInvitationStatus,
} from "../api/invitations-api.js";
import { setControlBusy } from "../ui/async-state.js";

type InvitationApi = {
  getProjectInvitationStatus: (
    projectId: string,
  ) => Promise<ProjectInvitationStatus | null>;
  generateProjectInvitation: (
    projectId: string,
  ) => Promise<GeneratedProjectInvitation>;
  disableProjectInvitation: (
    projectId: string,
  ) => Promise<ProjectInvitationStatus>;
};

type ClickButtonLike = {
  disabled: boolean;
  hidden?: boolean | string;
  textContent?: string | null;
  addEventListener: (
    eventName: "click",
    handler: () => void | Promise<void>,
  ) => void;
};

type TextElementLike = {
  textContent: string | null;
};

type ValueElementLike = {
  value: string;
  hidden?: boolean | string;
};

type ProjectInvitationControllerOptions = {
  projectId: string;
  invitationApi: InvitationApi;
  statusElement: TextElementLike;
  linkInput: ValueElementLike;
  generateButton: ClickButtonLike;
  copyButton: ClickButtonLike;
  regenerateButton: ClickButtonLike;
  disableButton: ClickButtonLike;
  buildShareLink: (token: string) => string;
  copyText: (value: string) => Promise<void>;
};

export function createProjectInvitationController({
  projectId,
  invitationApi,
  statusElement,
  linkInput,
  generateButton,
  copyButton,
  regenerateButton,
  disableButton,
  buildShareLink,
  copyText,
}: ProjectInvitationControllerOptions) {
  let currentStatus: ProjectInvitationStatus | null = null;
  let currentShareLink = "";
  let requestInFlight = false;

  function syncControls(): void {
    const active = currentStatus?.active === true;
    const hasCopyableLink = currentShareLink.length > 0;

    generateButton.hidden = active;
    regenerateButton.hidden = !active;
    disableButton.hidden = !active;
    copyButton.hidden = !hasCopyableLink;
    linkInput.hidden = !hasCopyableLink;
    linkInput.value = currentShareLink;

    if (hasCopyableLink) {
      statusElement.textContent =
        "Guest access is active. This link can be copied and shared.";
      return;
    }

    if (active) {
      statusElement.textContent =
        "Guest access is active. Regenerate the link to get a new copyable URL in this browser.";
      return;
    }

    statusElement.textContent =
      "Guest access is off. Generate a link when you are ready to share this project.";
  }

  function setBusy(isBusy: boolean): void {
    setControlBusy(generateButton, isBusy);
    setControlBusy(copyButton, isBusy);
    setControlBusy(regenerateButton, isBusy);
    setControlBusy(disableButton, isBusy);
  }

  async function loadStatus(): Promise<void> {
    try {
      currentStatus = await invitationApi.getProjectInvitationStatus(projectId);
      currentShareLink = "";
      syncControls();
    } catch (error) {
      statusElement.textContent =
        error instanceof Error
          ? error.message
          : "Could not load collaboration-link status.";
    }
  }

  async function generate(): Promise<void> {
    if (requestInFlight) {
      return;
    }

    requestInFlight = true;
    setBusy(true);
    statusElement.textContent = "Generating collaboration link...";

    try {
      const invitation =
        await invitationApi.generateProjectInvitation(projectId);

      currentStatus = invitation;
      currentShareLink = buildShareLink(invitation.token);
      syncControls();
    } catch (error) {
      statusElement.textContent =
        error instanceof Error
          ? error.message
          : "Could not generate collaboration link.";
    } finally {
      requestInFlight = false;
      setBusy(false);
    }
  }

  async function copy(): Promise<void> {
    if (!currentShareLink || requestInFlight) {
      return;
    }

    requestInFlight = true;
    setBusy(true);

    try {
      await copyText(currentShareLink);
      statusElement.textContent = "Collaboration link copied.";
    } catch {
      statusElement.textContent =
        "Could not copy automatically. Select and copy the link above.";
    } finally {
      requestInFlight = false;
      setBusy(false);
    }
  }

  async function disable(): Promise<void> {
    if (requestInFlight) {
      return;
    }

    requestInFlight = true;
    setBusy(true);
    statusElement.textContent = "Disabling Guest access...";

    try {
      currentStatus = await invitationApi.disableProjectInvitation(projectId);
      currentShareLink = "";
      syncControls();
    } catch (error) {
      statusElement.textContent =
        error instanceof Error
          ? error.message
          : "Could not disable Guest access.";
    } finally {
      requestInFlight = false;
      setBusy(false);
    }
  }

  function init(): void {
    generateButton.addEventListener("click", generate);
    regenerateButton.addEventListener("click", generate);
    copyButton.addEventListener("click", copy);
    disableButton.addEventListener("click", disable);
    void loadStatus();
  }

  return {
    init,
    loadStatus,
    generate,
    copy,
    disable,
  };
}
