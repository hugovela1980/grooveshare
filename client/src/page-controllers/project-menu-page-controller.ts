import type { Project } from "../types.js";

type ProjectsApi = {
    getProjects: () => Promise<Project[]>;
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
    projectsApi: ProjectsApi;
    renderProjectList: (projects: Project[]) => string;
    onProjectSelected: (project: Project) => void;
};

function getProjectIdFromTarget(target: EventTarget | null): string | null {
    const element = target as ClosestElementLike | null;
    const matchingElement = element?.closest?.("[data-project-id]");

    return matchingElement?.dataset?.projectId ?? null;
}

export function createProjectMenuPageController({
    projectListElement,
    projectsApi,
    renderProjectList,
    onProjectSelected,
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

    async function handleProjectListClick(event: ClickEventLike): Promise<void> {
        const selectedProjectId = getProjectIdFromTarget(event.target);

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