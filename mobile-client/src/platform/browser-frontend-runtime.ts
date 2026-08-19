import { createBrowserFrontendServices } from "@hugovela/frontend-browser";
import { clientConfig } from "../config/client-config.js";

/**
 * Presentation-local composition root for the shared browser transport and
 * frontend services. Desktop and mobile intentionally create separate runtime
 * instances while consuming the same shared implementations.
 */
export const browserFrontendRuntime = createBrowserFrontendServices({
  apiBaseUrl: clientConfig.apiBaseUrl,
});
