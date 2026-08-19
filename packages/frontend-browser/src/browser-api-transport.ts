import type {
  ApiRequestOptions,
  ApiTransport,
  ApiTransportResponse,
} from "@hugovela/frontend-core";

export type AuthenticationRequiredHandler = () => void;

type BrowserFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type BrowserApiTransport = ApiTransport & {
  setAuthenticationRequiredHandler(
    handler: AuthenticationRequiredHandler | null,
  ): void;
};

export function createBrowserApiTransport(
  fetchImplementation?: BrowserFetch,
): BrowserApiTransport {
  let authenticationRequiredHandler: AuthenticationRequiredHandler | null = null;

  async function request(
    input: string,
    options: ApiRequestOptions = {},
  ): Promise<ApiTransportResponse> {
    const {
      notifyOnUnauthorized = true,
      body,
      ...requestOptions
    } = options;

    const fetcher = fetchImplementation ?? ((...args) => globalThis.fetch(...args));
    const response = await fetcher(input, {
      ...requestOptions,
      ...(body === undefined ? {} : { body: body as BodyInit }),
      credentials: "include",
    });

    if (response.status === 401 && notifyOnUnauthorized) {
      authenticationRequiredHandler?.();
    }

    return response;
  }

  return {
    request,
    setAuthenticationRequiredHandler(handler) {
      authenticationRequiredHandler = handler;
    },
  };
}
