import type { Project } from "../types.js";

type ProjectButtonLike = {
    getAttribute: (name: string) => string | null;
};

type ProjectListClickTarget = {
    closest?: (selector: string) => ProjectButtonLike | null;
};

type ProjectListClickEvent = {
    target: ProjectListClickTarget | null;
};

type ProjectListElementLike = {
    innerHTML: string;
    addEventListener?: (
        eventName: string,
        handler: (event: ProjectListClickEvent) => void,
    ) => void;
};

type ProjectsApi = {
    getProjects: () => Promise<Project[]>;
};

type RenderProjectList = (projects: Project[]) => string;

type ProjectMenuPageControllerOptions = {
    projectListElement: ProjectListElementLike;
    projectsApi: ProjectsApi;
    renderProjectList: RenderProjectList;
    onProjectSelected?: (project: Project) => void;
};

function sortProjectsNewestFirst(projects: Project[]): Project[] {
    return [...projects].sort((a, b) => {
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
}

export function createProjectMenuPageController({
    projectListElement,
    projectsApi,
    renderProjectList,
    onProjectSelected,
}: ProjectMenuPageControllerOptions) {
    let loadedProjects: Project[] = [];

    function initializeProjectSelection(): void {
        projectListElement.addEventListener?.("click", (event) => {
            const projectButton = event.target?.closest?.("[data-project-id]");
            const projectId = projectButton?.getAttribute("data-project-id");

            if (!projectId) {
                return;
            }

            const selectedProject = loadedProjects.find((project) => {
                return project.id === projectId;
            });

            if (!selectedProject) {
                return;
            }

            onProjectSelected?.(selectedProject);
        });
    }

    async function init(): Promise<void> {
        initializeProjectSelection();

        try {
            const projects = await projectsApi.getProjects();
            const sortedProjects = sortProjectsNewestFirst(projects);

            loadedProjects = sortedProjects;
            projectListElement.innerHTML = renderProjectList(sortedProjects);
        } catch {
            projectListElement.innerHTML =
                '<p class="empty-state">Could not load projects.</p>';
        }
    }

    return {
        init,
    };
}