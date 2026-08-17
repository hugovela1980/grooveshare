type ViteEnvironment = {
  DEV?: boolean;
  PROD?: boolean;
  VITE_API_BASE_URL?: string;
};

export type ClientConfig = {
  apiBaseUrl: string;
  isDevelopment: boolean;
  isProduction: boolean;
};

function normalizeApiBaseUrl(rawValue: string): string {
  const value = rawValue.trim().replace(/\/+$/, "");

  if (!value) {
    return "";
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "VITE_API_BASE_URL must be an absolute http(s) origin or left empty for same-origin API requests.",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      "VITE_API_BASE_URL must use http or https.",
    );
  }

  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "VITE_API_BASE_URL must contain only an origin, without a path, query, hash, or credentials.",
    );
  }

  return url.origin;
}

export function createClientConfig({
  apiBaseUrl,
  isProduction = false,
}: {
  apiBaseUrl?: string;
  isProduction?: boolean;
} = {}): ClientConfig {
  const configuredBaseUrl = apiBaseUrl?.trim();

  return {
    apiBaseUrl: configuredBaseUrl
      ? normalizeApiBaseUrl(configuredBaseUrl)
      : "",
    isDevelopment: !isProduction,
    isProduction,
  };
}

const viteEnvironment = (
  import.meta as ImportMeta & { env?: ViteEnvironment }
).env;

export const clientConfig = createClientConfig({
  apiBaseUrl: viteEnvironment?.VITE_API_BASE_URL,
  isProduction: viteEnvironment?.PROD === true,
});
