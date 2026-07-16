import type { Project } from "../types.js";

type ElementLike = {
    innerHTML: string;
};

type ProjectsApi = {
    getProjects: () => Promise<Project[]>;
};

type RenderProjectList = (projects: Project[]) => string;

type ProjectMenuPageControllerOptions = {
    projectListElement: ElementLike;
    projectsApi: ProjectsApi;
    renderProjectList: RenderProjectList;
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
}: ProjectMenuPageControllerOptions) {
    async function init(): Promise<void> {
        try {
            const projects = await projectsApi.getProjects();
            const sortedProjects = sortProjectsNewestFirst(projects);

            projectListElement.innerHTML = renderProjectList(sortedProjects);
        } catch (error) {
            // console.error(error);
            projectListElement.innerHTML =
                '<p class="empty-state">Could not load projects.</p>';
        }
    }

    return {
        init,
    };
}