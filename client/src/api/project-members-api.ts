import type { ProjectMembersService } from "@hugovela/frontend-core";
import { frontendServices } from "./api-client.js";

export type ProjectMembersApi = ProjectMembersService;
export const projectMembersApi: ProjectMembersApi = frontendServices.projectMembers;

export const getProjectMembers = projectMembersApi.getProjectMembers;
export const addProjectMember = projectMembersApi.addProjectMember;
export const updateProjectMemberRole = projectMembersApi.updateProjectMemberRole;
export const removeProjectMember = projectMembersApi.removeProjectMember;
