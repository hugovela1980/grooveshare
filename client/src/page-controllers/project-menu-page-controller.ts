import type { Project } from "../types.js";

type ProjectsApi = {
    getProjects: () => Promise<Project[]>;
    deleteProject: (projectId: string) => Promise<Project>;
};

type ClickEventLike = {
    target: EventTarget | null;
};

type ProjectListElementLike = {
    innerHTML: string;
    addEventListener: (
        eventName: "click",
        handler: (event: ClickEventLike) => void | Promise<void>,
    ) => void;
};

type TextElementLike = {
    textContent: string | null;
};

type ProjectButtonLike = {
    dataset?: {
        projectId?: string;
    };
};

type ClosestElementLike = {
    closest?: (selector: string) => ProjectButtonLike | null;
};

type ProjectMenuPageControllerOptions = {
    projectListElement: ProjectListElementLike;
    statusElement?: TextElementLike | null;
    projectsApi: ProjectsApi;
    renderProjectList: (projects: Project[]) => string;
    onProjectSelected: (project: Project) => void;
    confirmDelete?: (message: string) => boolean;
};

function getProjectIdFromTarget(
    target: EventTarget | null,
    selector: string,
): string | null {
    const element = target as ClosestElementLike | null;
    const matchingElement = element?.closest?.(selector);

    return matchingElement?.dataset?.projectId ?? null;
}

function setStatus(
    statusElement: TextElementLike | null | undefined,
    message: string,
): void {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message;
}

export function createProjectMenuPageController({
    projectListElement,
    statusElement,
    projectsApi,
    renderProjectList,
    onProjectSelected,
    confirmDelete = globalThis.confirm,
}: ProjectMenuPageControllerOptions) {
    let currentProjects: Project[] = [];

    async function loadProjects(): Promise<void> {
        try {
            const projects = await projectsApi.getProjects();

            currentProjects = [...projects].sort((firstProject, secondProject) => {
                return (
                    new Date(secondProject.createdAt).getTime() -
                    new Date(firstProject.createdAt).getTime()
                );
            });

            projectListElement.innerHTML = renderProjectList(currentProjects);
        } catch {
            projectListElement.innerHTML =
                '<p class="empty-state">Could not load projects.</p>';
        }
    }

    async function handleDeleteProject(projectId: string): Promise<void> {
        const confirmed = confirmDelete(
            "Delete this project and all of its uploaded tracks?",
        );

        if (!confirmed) {
            return;
        }

        try {
            setStatus(statusElement, "Deleting project...");

            await projectsApi.deleteProject(projectId);
            await loadProjects();

            setStatus(statusElement, "Project deleted.");
        } catch {
            setStatus(statusElement, "Could not delete project.");
        }
    }

    async function handleProjectListClick(event: ClickEventLike): Promise<void> {
        const deleteProjectId = getProjectIdFromTarget(
            event.target,
            "[data-project-delete-button]",
        );

        if (deleteProjectId) {
            await handleDeleteProject(deleteProjectId);
            return;
        }

        const selectedProjectId = getProjectIdFromTarget(
            event.target,
            "[data-project-id]",
        );

        if (!selectedProjectId) {
            return;
        }

        const selectedProject = currentProjects.find((project) => {
            return project.id === selectedProjectId;
        });

        if (!selectedProject) {
            return;
        }

        onProjectSelected(selectedProject);
    }

    async function init(): Promise<void> {
        projectListElement.addEventListener("click", (event) => {
            return handleProjectListClick(event);
        });

        await loadProjects();
    }

    return {
        init,
    };
}