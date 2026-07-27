import type { AddPendingTrackInput } from "../project-draft/project-draft-state.js";
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

type FileInputLike = {
  files: FileList | null;
};

type TextElementLike = {
  textContent: string | null;
};

type CreateProjectPageControllerOptions = {
  form: FormLike;
  titleInput: InputLike;
  descriptionInput: InputLike;
  statusElement: TextElementLike;
  trackNameInput?: InputLike;
  audioFileInput?: FileInputLike;
  onProjectDraftReady: (
    input: CreateProjectInput,
    pendingTrack: AddPendingTrackInput | null,
  ) => void | Promise<void>;
};

export function createCreateProjectPageController({
  form,
  titleInput,
  descriptionInput,
  statusElement,
  trackNameInput,
  audioFileInput,
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

    const audioFile = audioFileInput?.files?.[0] ?? null;

    const pendingTrack = audioFile
      ? {
          trackName: trackNameInput?.value ?? "",
          audioFile,
        }
      : null;

    await onProjectDraftReady(
      {
        title,
        description,
      },
      pendingTrack,
    );
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