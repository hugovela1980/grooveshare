import type { CreateProjectInput, Project } from "../types.js";

type SubmitEventLike = {
    preventDefault: () => void;
};

type FormLike = {
    addEventListener: (
        eventName: string,
        handler: (event: SubmitEventLike) => void | Promise<void>,
    ) => void;
    reset: () => void;
};

type InputLike = {
    value: string;
};

type TextElementLike = {
    textContent: string | null;
};

type ProjectsApi = {
    createProject: (input: CreateProjectInput) => Promise<Project>;
};

type CreateProjectPageControllerOptions = {
    form: FormLike;
    titleInput: InputLike;
    descriptionInput: InputLike;
    statusElement: TextElementLike;
    projectsApi: ProjectsApi;
    onProjectCreated?: (project: Project) => void | Promise<void>;
};

export function createCreateProjectPageController({
    form,
    titleInput,
    descriptionInput,
    statusElement,
    projectsApi,
    onProjectCreated,
}: CreateProjectPageControllerOptions) {
    async function handleSubmit(event: SubmitEventLike): Promise<void> {
        event.preventDefault();

        const title = titleInput.value.trim();
        const description = descriptionInput.value.trim();

        if (!title) {
            statusElement.textContent = "Project title is required.";
            return;
        }

        try {
            const project = await projectsApi.createProject({
                title,
                description,
            });

            form.reset();
            statusElement.textContent = "Project created.";

            if (onProjectCreated) {
                await onProjectCreated(project);
            }
        } catch (error) {
            // console.error(error);
            statusElement.textContent = "Could not create project.";
        }
    }

    function init(): void {
        form.addEventListener("submit", (event) => {
            return handleSubmit(event);
        });
    }

    return {
        init,
    };
}