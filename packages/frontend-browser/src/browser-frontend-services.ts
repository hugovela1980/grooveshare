import {
  createFrontendServices,
  type FrontendServices,
} from "@hugovela/frontend-core";
import {
  createBrowserApiTransport,
  type BrowserApiTransport,
} from "./browser-api-transport.js";
import { createBrowserMultipartBodyFactory } from "./browser-multipart-body.js";

export type BrowserFrontendServices = {
  transport: BrowserApiTransport;
  services: FrontendServices<File>;
};

export function createBrowserFrontendServices(input: {
  apiBaseUrl: string;
  transport?: BrowserApiTransport;
}): BrowserFrontendServices {
  const transport = input.transport ?? createBrowserApiTransport();

  return {
    transport,
    services: createFrontendServices<File>({
      apiBaseUrl: input.apiBaseUrl,
      transport,
      multipartBodyFactory: createBrowserMultipartBodyFactory(),
    }),
  };
}
