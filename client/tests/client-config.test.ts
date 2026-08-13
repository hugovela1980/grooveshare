import {
  createClientConfig,
} from "../src/config/client-config.js";
import { tester } from "./test-runner/tester.js";

function captureErrorMessage(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error
      ? error.message
      : String(error);
  }

  return "";
}

tester.describe("client configuration", () => {
  tester.it("uses the local Node API during development by default", () => {
    const config = createClientConfig();

    tester.expect(config.apiBaseUrl).toBe(
      "http://localhost:3000",
    );
    tester.expect(config.isDevelopment).toBe(true);
    tester.expect(config.isProduction).toBe(false);
  });

  tester.it("uses same-origin API routes in production by default", () => {
    const config = createClientConfig({
      isProduction: true,
    });

    tester.expect(config.apiBaseUrl).toBe("");
    tester.expect(config.isDevelopment).toBe(false);
    tester.expect(config.isProduction).toBe(true);
  });

  tester.it("accepts an explicit API origin and removes trailing slashes", () => {
    const config = createClientConfig({
      apiBaseUrl: "https://api.example.com///",
      isProduction: true,
    });

    tester.expect(config.apiBaseUrl).toBe(
      "https://api.example.com",
    );
  });

  tester.it("rejects an API base URL with a path", () => {
    const message = captureErrorMessage(() => {
      createClientConfig({
        apiBaseUrl: "https://api.example.com/base",
      });
    });

    tester.expect(message).toBe(
      "VITE_API_BASE_URL must contain only an origin, without a path, query, hash, or credentials.",
    );
  });

  tester.it("rejects an invalid explicit API base URL", () => {
    const message = captureErrorMessage(() => {
      createClientConfig({
        apiBaseUrl: "not-a-url",
      });
    });

    tester.expect(message).toBe(
      "VITE_API_BASE_URL must be an absolute http(s) origin or left empty for same-origin API requests.",
    );
  });
});
