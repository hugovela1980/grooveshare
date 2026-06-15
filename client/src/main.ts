import { projectsApi } from "./api/projects-api.js";
import { tracksApi } from "./api/tracks-api.js";
import { createProjectFormController } from "./controllers/project-controller.js";
import { createTrackUploadController } from "./controllers/track-upload-controller.js";
import "./style.css";
import { createAppShell } from "./templates/app-shell.js";
import { renderProjectList } from "./templates/project-list.js";
import { renderTrackList } from "./templates/track-list.js";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Could not find #app element");
}

app.innerHTML = createAppShell();

// project form
const form = document.querySelector<HTMLFormElement>("#project-form");
const titleInput = document.querySelector<HTMLInputElement>("#project-title");
const descriptionInput = document.querySelector<HTMLTextAreaElement>("#project-description");
const projectListElement = document.querySelector<HTMLDivElement>("#project-list");
const statusElement = document.querySelector<HTMLParagraphElement>("#project-status");

if (
  !form ||
  !titleInput ||
  !descriptionInput ||
  !projectListElement ||
  !statusElement
) {
  throw new Error("Could not find project form elements.");
};

const projectFormController = createProjectFormController({
  form,
  titleInput,
  descriptionInput,
  projectListElement,
  statusElement,
  projectsApi,
  renderProjectList,
});

await projectFormController.init();

// track upload form
const trackUploadForm =
  document.querySelector<HTMLFormElement>("#track-upload-form");
const uploadProjectSelect = document.querySelector<HTMLSelectElement>("#upload-project-select");
const trackNameInput = document.querySelector<HTMLInputElement>("#track-name");
const audioFileInput = document.querySelector<HTMLInputElement>("#audio-file");
const trackUploadStatus = document.querySelector<HTMLParagraphElement>("#track-upload-status");
const trackListElement = document.querySelector<HTMLDivElement>("#track-list");

if (
  !trackUploadForm ||
  !uploadProjectSelect ||
  !trackNameInput ||
  !audioFileInput ||
  !trackUploadStatus ||
  !trackListElement
) {
  throw new Error("Could not find track upload form elements.");
}

const trackUploadController = createTrackUploadController({
  form: trackUploadForm,
  projectSelect: uploadProjectSelect,
  trackNameInput,
  audioFileInput,
  statusElement: trackUploadStatus,
  trackListElement,
  projectsApi,
  tracksApi,
  renderTrackList,
});

await trackUploadController.init();
