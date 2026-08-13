import type {
  ProjectMember,
  ProjectRole,
} from "../types.js";
import type { ProjectMembersApi } from "../api/project-members-api.js";

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
};

type SelectElementLike = {
  value: string;
};

type StatusElementLike = {
  textContent: string | null;
};

type MemberListElementLike = {
  innerHTML: string;
  addEventListener: (
    eventName: "click" | "change",
    handler: (event: MemberListEventLike) => void | Promise<void>,
  ) => void;
};

type MemberActionTargetLike = {
  value?: string;
  dataset?: {
    userId?: string;
    memberRoleSelect?: string;
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
  memberListElement: MemberListElementLike;
  statusElement?: StatusElementLike | null;
  projectMembersApi: ProjectMembersApi;
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
  memberListElement,
  statusElement,
  projectMembersApi,
  renderMembers,
  confirmRemoveMember = globalThis.confirm,
}: ProjectMembersControllerOptions) {
  async function loadMembers(): Promise<void> {
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
    }
  }

  async function handleSubmit(event: FormEventLike): Promise<void> {
    event.preventDefault?.();

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

    try {
      setStatus(statusElement, "Adding member...");

      await projectMembersApi.addProjectMember(projectId, {
        email,
        role,
      });

      emailInput.value = "";
      await loadMembers();
      setStatus(statusElement, "Member added.");
    } catch (error) {
      setStatus(
        statusElement,
        getErrorMessage(error, "Could not add member."),
      );
    }
  }

  async function handleRoleChange(event: MemberListEventLike): Promise<void> {
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
    }
  }

  async function handleMemberListClick(
    event: MemberListEventLike,
  ): Promise<void> {
    const target = event.target as MemberActionTargetLike | null;
    const removeButton = target?.closest?.(
      "[data-member-remove-button]",
    );
    const userId = removeButton?.dataset?.userId;

    if (!userId) {
      return;
    }

    if (!confirmRemoveMember("Remove this member from the project?")) {
      return;
    }

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
  };
}
