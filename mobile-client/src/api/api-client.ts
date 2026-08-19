import {
  ApiError,
  parseApiResponse,
  parseApiSuccess,
  type ApiRequestOptions,
  type ApiTransportResponse,
} from "@hugovela/frontend-core";
import { createBrowserFrontendServices } from "@hugovela/frontend-browser";
import { clientConfig } from "../config/client-config.js";

export const API_BASE_URL = clientConfig.apiBaseUrl;

const browserFrontend = createBrowserFrontendServices({
  apiBaseUrl: API_BASE_URL,
});

export const frontendServices = browserFrontend.services;

export { ApiError, parseApiResponse, parseApiSuccess };

export function setAuthenticationRequiredHandler(
  handler: (() => void) | null,
): void {
  browserFrontend.transport.setAuthenticationRequiredHandler(handler);
}

/**
 * Compatibility seam for the small amount of browser/client code that still
 * needs direct transport access during Stage 2. Shared services use the same
 * transport instance underneath.
 */
export function apiFetch(
  input: string,
  options: ApiRequestOptions = {},
): Promise<ApiTransportResponse> {
  return browserFrontend.transport.request(input, options);
}
