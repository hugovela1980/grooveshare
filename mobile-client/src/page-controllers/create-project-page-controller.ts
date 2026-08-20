import { isValidMusicalTimeline } from "@hugovela/frontend-core";
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
  bpmInput: InputLike;
  timeSignatureNumeratorInput: InputLike;
  timeSignatureDenominatorInput: InputLike;
  statusElement: TextElementLike;
  onProjectDraftReady: (input: CreateProjectInput) => void | Promise<void>;
};

export function createCreateProjectPageController({
  form,
  titleInput,
  descriptionInput,
  bpmInput,
  timeSignatureNumeratorInput,
  timeSignatureDenominatorInput,
  statusElement,
  onProjectDraftReady,
}: CreateProjectPageControllerOptions) {
  async function handleSubmit(event: SubmitEventLike): Promise<void> {
    event.preventDefault();

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const musicalTimeline = {
      bpm: Number(bpmInput.value),
      timeSignature: {
        numerator: Number(timeSignatureNumeratorInput.value),
        denominator: Number(timeSignatureDenominatorInput.value),
      },
    };

    if (!title) {
      statusElement.textContent = "Project title is required.";
      return;
    }

    if (!isValidMusicalTimeline(musicalTimeline)) {
      statusElement.textContent = "Enter a valid BPM and time signature.";
      return;
    }

    await onProjectDraftReady({
      title,
      description,
      musicalTimeline,
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
