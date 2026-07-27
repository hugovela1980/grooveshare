import type { CreateProjectInput } from "../types.js";

type SubmitEventLike = {
    preventDefault: () => void;
};

type FormLike = {
    addEventListener: (
        eventName: string,
        handler: (event: SubmitEventLike) => void | Promise<void>,
    ) => void;
};

type InputLike = {
    value: string;
};

type TextElementLike = {
    textContent: string | null;
};

type CreateProjectPageControllerOptions = {
    form: FormLike;
    titleInput: InputLike;
    descriptionInput: InputLike;
    statusElement: TextElementLike;
    onProjectDraftReady: (input: CreateProjectInput) => void | Promise<void>;
};

export function createCreateProjectPageController({
    form,
    titleInput,
    descriptionInput,
    statusElement,
    onProjectDraftReady,
}: CreateProjectPageControllerOptions) {
    async function handleSubmit(event: SubmitEventLike): Promise<void> {
        event.preventDefault();

        const title = titleInput.value.trim();
        const description = descriptionInput.value.trim();

        if (!title) {
            statusElement.textContent = "Project title is required.";
            return;
        }

        await onProjectDraftReady({
            title,
            description,
        });
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