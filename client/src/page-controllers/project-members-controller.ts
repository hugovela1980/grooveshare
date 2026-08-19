import type {
  ProjectMember,
  ProjectRole,
} from "../types.js";
import type { ProjectMembersService } from "@hugovela/frontend-core";
import {
  setControlBusy,
  setRegionBusy,
  type BusyControlLike,
  type BusyRegionLike,
} from "../ui/async-state.js";

type FormEventLike = {
  preventDefault?: () => void;
};

type MemberListEventLike = {
  target: EventTarget | null;
};

type FormElementLike = {
  addEventListener: (
    eventName: "submit",
    handler: (event: FormEventLike) => void | Promise<void>,
  ) => void;
};

type InputElementLike = {
  value: string;
  focus?: () => void;
  blur?: () => void;
};

type SelectElementLike = BusyControlLike & {
  value: string;
};

type StatusElementLike = {
  textContent: string | null;
};

type MemberListElementLike = BusyRegionLike & {
  innerHTML: string;
  addEventListener: (
    eventName: "click" | "change",
    handler: (event: MemberListEventLike) => void | Promise<void>,
  ) => void;
};

type MemberActionTargetLike = BusyControlLike & {
  value?: string;
  dataset?: {
    userId?: string;
    memberRoleSelect?: string;
    memberName?: string;
  };
  closest?: (
    selector: string,
  ) => MemberActionTargetLike | null;
};

type ProjectMembersControllerOptions = {
  projectId: string;
  form: FormElementLike;
  emailInput: InputElementLike;
  roleSelect: SelectElementLike;
  submitButton: BusyControlLike;
  memberListElement: MemberListElementLike;
  statusElement?: StatusElementLike | null;
  projectMembersApi: ProjectMembersService;
  renderMembers: (members: ProjectMember[]) => string;
  confirmRemoveMember?: (message: string) => boolean;
};

function setStatus(
  statusElement: StatusElementLike | null | undefined,
  message: string,
): void {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isAssignableRole(
  role: string,
): role is Exclude<ProjectRole, "owner"> {
  return role === "viewer" || role === "contributor";
}

export function createProjectMembersController({
  projectId,
  form,
  emailInput,
  roleSelect,
  submitButton,
  memberListElement,
  statusElement,
  projectMembersApi,
  renderMembers,
  confirmRemoveMember = globalThis.confirm,
}: ProjectMembersControllerOptions) {
  let mutationInFlight = false;

  async function loadMembers(): Promise<void> {
    setRegionBusy(memberListElement, true);

    try {
      const members = await projectMembersApi.getProjectMembers(projectId);
      memberListElement.innerHTML = renderMembers(members);
    } catch (error) {
      memberListElement.innerHTML =
        '<p class="empty-state">Could not load project members.</p>';
      setStatus(
        statusElement,
        getErrorMessage(error, "Could not load project members."),
      );
    } finally {
      setRegionBusy(memberListElement, false);
    }
  }

  async function handleSubmit(event: FormEventLike): Promise<void> {
    event.preventDefault?.();

    if (mutationInFlight) {
      return;
    }

    const email = emailInput.value.trim();
    const role = roleSelect.value;

    if (!email) {
      setStatus(statusElement, "Enter a member email address.");
      return;
    }

    if (!isAssignableRole(role)) {
      setStatus(statusElement, "Choose Viewer or Contributor.");
      return;
    }

    mutationInFlight = true;
    setControlBusy(submitButton, true);

    try {
      setStatus(statusElement, "Adding member...");

      await projectMembersApi.addProjectMember(projectId, {
        email,
        role,
      });

      emailInput.value = "";
      emailInput.blur?.();
      await loadMembers();
      setStatus(statusElement, "Member added.");
    } catch (error) {
      setStatus(
        statusElement,
        getErrorMessage(error, "Could not add member."),
      );
    } finally {
      setControlBusy(submitButton, false);
      mutationInFlight = false;
    }
  }

  async function handleRoleChange(event: MemberListEventLike): Promise<void> {
    if (mutationInFlight) {
      return;
    }

    const target = event.target as MemberActionTargetLike | null;
    const userId = target?.dataset?.userId;
    const role = target?.value ?? "";

    if (
      !target?.dataset ||
      target.dataset.memberRoleSelect === undefined ||
      !userId ||
      !isAssignableRole(role)
    ) {
      return;
    }

    mutationInFlight = true;
    setControlBusy(target, true);

    try {
      setStatus(statusElement, "Updating member role...");
      await projectMembersApi.updateProjectMemberRole(
        projectId,
        userId,
        role,
      );
      await loadMembers();
      setStatus(statusElement, "Member role updated.");
    } catch (error) {
      setStatus(
        statusElement,
        getErrorMessage(error, "Could not update member role."),
      );
      await loadMembers();
    } finally {
      setControlBusy(target, false);
      mutationInFlight = false;
    }
  }

  async function handleMemberListClick(
    event: MemberListEventLike,
  ): Promise<void> {
    if (mutationInFlight) {
      return;
    }

    const target = event.target as MemberActionTargetLike | null;
    const removeButton = target?.closest?.(
      "[data-member-remove-button]",
    );
    const userId = removeButton?.dataset?.userId;

    if (!userId || !removeButton) {
      return;
    }

    const memberName = removeButton.dataset?.memberName?.trim();
    const confirmationMessage = memberName
      ? `Remove "${memberName}" from this project?`
      : "Remove this member from the project?";

    if (!confirmRemoveMember(confirmationMessage)) {
      return;
    }

    mutationInFlight = true;
    setControlBusy(removeButton, true);

    try {
      setStatus(statusElement, "Removing member...");
      await projectMembersApi.removeProjectMember(projectId, userId);
      await loadMembers();
      setStatus(statusElement, "Member removed.");
    } catch (error) {
      setStatus(
        statusElement,
        getErrorMessage(error, "Could not remove member."),
      );
    } finally {
      setControlBusy(removeButton, false);
      mutationInFlight = false;
    }
  }

  async function init(): Promise<void> {
    form.addEventListener("submit", (event) => handleSubmit(event));
    memberListElement.addEventListener("change", (event) => {
      return handleRoleChange(event);
    });
    memberListElement.addEventListener("click", (event) => {
      return handleMemberListClick(event);
    });

    await loadMembers();
  }

  return {
    init,
    loadMembers,
  };
}
