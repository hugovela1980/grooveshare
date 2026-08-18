import type { Project } from "../types.js";
import { setControlBusy, setRegionBusy, type BusyControlLike, type BusyRegionLike } from "../ui/async-state.js";

type ProjectsApi = {
  getProjects: () => Promise<Project[]>;
};

type ClickEventLike = {
  target: EventTarget | null;
};

type ProjectListElementLike = BusyRegionLike & {
  innerHTML: string;
  addEventListener: (
    eventName: "click",
    handler: (event: ClickEventLike) => void | Promise<void>,
  ) => void;
};

type ProjectButtonLike = BusyControlLike & {
  dataset?: {
    projectId?: string;
    acceptInvitationProjectId?: string;
  };
};

type ClosestElementLike = {
  closest?: (selector: string) => ProjectButtonLike | null;
};

type StatusElementLike = {
  textContent: string | null;
};

type ProjectMenuPageControllerOptions = {
  projectListElement: ProjectListElementLike;
  projectsApi: ProjectsApi;
  renderProjectList: (
    projects: Project[],
    options?: { invitationProjectId?: string | null },
  ) => string;
  getInvitedProject?: () => Project | null;
  getInvitationProjectId?: () => string | null;
  statusElement?: StatusElementLike | null;
  onProjectSelected: (project: Project) => void | Promise<void>;
  onInvitationAccepted?: (project: Project) => void | Promise<void>;
};

function getClosestTarget(
  target: EventTarget | null,
  selector: string,
): ProjectButtonLike | null {
  const element = target as ClosestElementLike | null;
  return element?.closest?.(selector) ?? null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function createProjectMenuPageController({
  projectListElement,
  projectsApi,
  renderProjectList,
  getInvitedProject = () => null,
  getInvitationProjectId = () => null,
  statusElement = null,
  onProjectSelected,
  onInvitationAccepted,
}: ProjectMenuPageControllerOptions) {
  let currentProjects: Project[] = [];
  let actionInFlight = false;

  function setStatus(message: string): void {
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  function mergeInvitedProject(projects: Project[]): Project[] {
    const invitedProject = getInvitedProject();

    if (!invitedProject) {
      return projects;
    }

    const existingIndex = projects.findIndex(
      (project) => project.id === invitedProject.id,
    );

    if (existingIndex >= 0) {
      return projects;
    }

    return [...projects, invitedProject];
  }

  function renderProjects(): void {
    projectListElement.innerHTML = renderProjectList(currentProjects, {
      invitationProjectId: getInvitationProjectId(),
    });
  }

  async function loadProjects(): Promise<void> {
    setRegionBusy(projectListElement, true);

    try {
      const projects = await projectsApi.getProjects();

      currentProjects = mergeInvitedProject(projects).sort(
        (firstProject, secondProject) => {
          return (
            new Date(secondProject.createdAt).getTime() -
            new Date(firstProject.createdAt).getTime()
          );
        },
      );

      renderProjects();
    } catch {
      projectListElement.innerHTML =
        '<p class="empty-state">Could not load projects.</p>';
    } finally {
      setRegionBusy(projectListElement, false);
    }
  }

  function findProject(projectId: string): Project | null {
    return (
      currentProjects.find((project) => project.id === projectId) ?? null
    );
  }

  async function handleProjectListClick(event: ClickEventLike): Promise<void> {
    if (actionInFlight) {
      return;
    }

    const invitationButton = getClosestTarget(
      event.target,
      "[data-accept-invitation-project-id]",
    );
    const invitationProjectId =
      invitationButton?.dataset?.acceptInvitationProjectId;

    if (invitationProjectId && invitationButton && onInvitationAccepted) {
      const project = findProject(invitationProjectId);

      if (!project) {
        return;
      }

      actionInFlight = true;
      setControlBusy(invitationButton, true);
      setStatus("Accepting collaboration invitation...");

      try {
        await onInvitationAccepted(project);
      } catch (error) {
        setStatus(
          getErrorMessage(
            error,
            "Could not accept the collaboration invitation.",
          ),
        );
        await loadProjects();
      } finally {
        setControlBusy(invitationButton, false);
        actionInFlight = false;
      }

      return;
    }

    const projectButton = getClosestTarget(event.target, "[data-project-id]");
    const selectedProjectId = projectButton?.dataset?.projectId;

    if (!selectedProjectId) {
      return;
    }

    const selectedProject = findProject(selectedProjectId);

    if (!selectedProject) {
      return;
    }

    actionInFlight = true;

    try {
      await onProjectSelected(selectedProject);
    } catch (error) {
      setStatus(
        getErrorMessage(error, "Could not open this project."),
      );
      await loadProjects();
    } finally {
      actionInFlight = false;
    }
  }

  async function init(): Promise<void> {
    projectListElement.addEventListener("click", (event) => {
      return handleProjectListClick(event);
    });

    await loadProjects();
  }

  return {
    init,
    loadProjects,
  };
}
