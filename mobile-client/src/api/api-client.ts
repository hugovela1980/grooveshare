import { clientConfig } from "../config/client-config.js";

export const API_BASE_URL = clientConfig.apiBaseUrl;

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type AuthenticationRequiredHandler = () => void;

type ApiFetchOptions = RequestInit & {
  notifyOnUnauthorized?: boolean;
};

let authenticationRequiredHandler: AuthenticationRequiredHandler | null = null;

export class ApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

export function setAuthenticationRequiredHandler(
  handler: AuthenticationRequiredHandler | null,
): void {
  authenticationRequiredHandler = handler;
}

export async function apiFetch(
  input: RequestInfo | URL,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const {
    notifyOnUnauthorized = true,
    ...requestInit
  } = options;

  const response = await globalThis.fetch(input, {
    ...requestInit,
    credentials: "include",
  });

  if (
    response.status === 401 &&
    notifyOnUnauthorized
  ) {
    authenticationRequiredHandler?.();
  }

  return response;
}

async function readApiResponse<T>(
  response: Response,
): Promise<ApiResponse<T>> {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      "The server returned an invalid response.",
      response.status,
    );
  }
}

export async function parseApiResponse<T>(
  response: Response,
): Promise<T> {
  const body = await readApiResponse<T>(response);

  if (
    !response.ok ||
    !body.ok ||
    body.data === undefined
  ) {
    throw new ApiError(
      body.error ?? "API request failed.",
      response.status,
    );
  }

  return body.data;
}

export async function parseApiSuccess(
  response: Response,
): Promise<void> {
  const body = await readApiResponse<unknown>(response);

  if (!response.ok || !body.ok) {
    throw new ApiError(
      body.error ?? "API request failed.",
      response.status,
    );
  }
}
