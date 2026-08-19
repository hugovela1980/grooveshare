import type { ProjectsService } from "@hugovela/frontend-core";
import { frontendServices } from "./api-client.js";

export type ProjectsApi = ProjectsService;
export const projectsApi: ProjectsApi = frontendServices.projects;

export const getProjects = projectsApi.getProjects;
export const getProject = projectsApi.getProject;
export const createProject = projectsApi.createProject;
export const updateProjectDetails = projectsApi.updateProjectDetails;
export const deleteProject = projectsApi.deleteProject;
export const saveMixSettings = projectsApi.saveMixSettings;
