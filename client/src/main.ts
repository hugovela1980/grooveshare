import { projectsApi } from "./api/projects-api.js";
import { createProjectFormController } from "./controllers/project-controller.js";
import "./style.css";
import { createAppShell } from "./templates/app-shell.js";
import { renderProjectList } from "./templates/project-list.js";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Could not find #app element");
}

app.innerHTML = createAppShell();

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