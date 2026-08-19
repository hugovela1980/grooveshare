import type { AuthService } from "@hugovela/frontend-core";
import { frontendServices } from "./api-client.js";

export type AuthApi = AuthService;
export const authApi: AuthApi = frontendServices.auth;

export const registerUser = authApi.registerUser;
export const login = authApi.login;
export const getCurrentUser = authApi.getCurrentUser;
export const logout = authApi.logout;
