import {
  apiFetch,
  setAuthenticationRequiredHandler,
} from "../src/api/api-client.js";
import { tester } from "./test-runner/tester.js";

tester.describe("API client", () => {
  tester.it("includes browser credentials with API fetch requests", async () => {
    const originalFetch = globalThis.fetch;
    let receivedInit: RequestInit | undefined;

    globalThis.fetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      receivedInit = init;

      return new Response(
        JSON.stringify({ ok: true }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }) as typeof fetch;

    try {
      await apiFetch("http://localhost:3000/api/example", {
        method: "POST",
      });

      tester.expect(receivedInit).toEqual({
        method: "POST",
        credentials: "include",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  tester.it("notifies the app when a normal API request returns 401", async () => {
    const originalFetch = globalThis.fetch;
    let notificationCount = 0;

    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Authentication required.",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }) as typeof fetch;

    setAuthenticationRequiredHandler(() => {
      notificationCount += 1;
    });

    try {
      await apiFetch("http://localhost:3000/api/projects");
      tester.expect(notificationCount).toBe(1);
    } finally {
      setAuthenticationRequiredHandler(null);
      globalThis.fetch = originalFetch;
    }
  });

  tester.it("can suppress the 401 notification while checking the current session", async () => {
    const originalFetch = globalThis.fetch;
    let notificationCount = 0;

    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Authentication required.",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }) as typeof fetch;

    setAuthenticationRequiredHandler(() => {
      notificationCount += 1;
    });

    try {
      await apiFetch("http://localhost:3000/api/auth/me", {
        notifyOnUnauthorized: false,
      });

      tester.expect(notificationCount).toBe(0);
    } finally {
      setAuthenticationRequiredHandler(null);
      globalThis.fetch = originalFetch;
    }
  });
});
