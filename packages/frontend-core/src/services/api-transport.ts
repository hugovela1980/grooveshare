import type { TrackMusicalPlacement } from "../domain/types.js";

export type ApiHeaders = Readonly<Record<string, string>>;

export type ApiRequestOptions = {
  method?: string;
  headers?: ApiHeaders;
  body?: unknown;
  notifyOnUnauthorized?: boolean;
};

/**
 * Minimal response shape needed by shared GrooveShare services.
 * Browser Response objects satisfy this contract structurally, but the core
 * package does not depend on DOM fetch types.
 */
export interface ApiTransportResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Transport port used by shared API services. A browser adapter supplies
 * cookie credentials, fetch, and session-expiration notification behavior.
 */
export interface ApiTransport {
  request(
    input: string,
    options?: ApiRequestOptions,
  ): Promise<ApiTransportResponse>;
}

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export class ApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

async function readApiEnvelope<T>(
  response: ApiTransportResponse,
): Promise<ApiEnvelope<T>> {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(
      "The server returned an invalid response.",
      response.status,
    );
  }
}

export async function parseApiResponse<T>(
  response: ApiTransportResponse,
): Promise<T> {
  const body = await readApiEnvelope<T>(response);

  if (!response.ok || !body.ok || body.data === undefined) {
    throw new ApiError(
      body.error ?? "API request failed.",
      response.status,
    );
  }

  return body.data;
}

export async function parseApiSuccess(
  response: ApiTransportResponse,
): Promise<void> {
  const body = await readApiEnvelope<unknown>(response);

  if (!response.ok || !body.ok) {
    throw new ApiError(
      body.error ?? "API request failed.",
      response.status,
    );
  }
}

export interface MultipartBodyFactory<TFile = unknown> {
  createTrackUploadBody(input: {
    trackName: string;
    audioFile: TFile;
    musicalPlacement?: TrackMusicalPlacement;
    alignmentOffsetSeconds?: number;
  }): unknown;
}
