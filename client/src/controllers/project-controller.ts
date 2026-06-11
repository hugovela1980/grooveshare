import type { CreateProjectInput, Project } from "../types.js";

type ProjectFormLike = {
  addEventListener: (
    eventName: string,
    handler: (event: { preventDefault: () => void }) => void | Promise<void>,
  ) => void;
  reset: () => void;
};

type InputLike = {
  value: string;
};

type TextElementLike = {
  textContent: string | null;
};

type ContainerLike = {
  innerHTML: string;
};

type ProjectsApi = {
  getProjects: () => Promise<Project[]>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
};

type ProjectFormControllerOptions = {
  form: ProjectFormLike;
  titleInput: InputLike;
  descriptionInput: InputLike;
  projectListElement: ContainerLike;
  statusElement: TextElementLike;
  projectsApi: ProjectsApi;
  renderProjectList: (projects: Project[]) => string;
};

export function createProjectFormController({
  form,
  titleInput,
  descriptionInput,
  projectListElement,
  statusElement,
  projectsApi,
  renderProjectList,
}: ProjectFormControllerOptions) {
  async function loadProjects(): Promise<void> {
    const projects = await projectsApi.getProjects();
    projectListElement.innerHTML = renderProjectList(projects);
  }

  async function handleSubmit(event: { preventDefault: () => void }): Promise<void> {
    event.preventDefault();

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!title) {
      statusElement.textContent = "Project title is required.";
      return;
    }

    await projectsApi.createProject({
      title,
      description,
    });

    form.reset();
    await loadProjects();

    statusElement.textContent = "Project created.";
  }

  async function init(): Promise<void> {
    form.addEventListener("submit", (event) => {
      return handleSubmit(event);
    });

    await loadProjects();

    statusElement.textContent = "";
  }

  return {
    init,
  };
}