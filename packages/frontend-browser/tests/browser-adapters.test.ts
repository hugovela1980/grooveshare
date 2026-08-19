import {
  createBrowserApiTransport,
  createBrowserInvitationSessionStore,
  createBrowserMultipartBodyFactory,
  createBrowserStorageProvider,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

type MemoryStorage = Storage & { values: Map<string, string> };

function createMemoryStorage(): MemoryStorage {
  const values = new Map<string, string>();
  return {
    values,
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

tester.describe("frontend-browser adapters", () => {
  tester.it("adds browser credentials and reports normal 401 responses", async () => {
    let capturedInit: RequestInit | undefined;
    let notificationCount = 0;
    const transport = createBrowserApiTransport(async (_input, init) => {
      capturedInit = init;
      return new Response(
        JSON.stringify({ ok: false, error: "Authentication required." }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    transport.setAuthenticationRequiredHandler(() => {
      notificationCount += 1;
    });

    await transport.request("https://grooveshare.example/api/projects", {
      method: "POST",
    });

    tester.expect(capturedInit).toEqual({
      method: "POST",
      credentials: "include",
    });
    tester.expect(notificationCount).toBe(1);
  });

  tester.it("can suppress 401 notification for explicit session checks", async () => {
    let notificationCount = 0;
    const transport = createBrowserApiTransport(async () => {
      return new Response(JSON.stringify({ ok: false }), { status: 401 });
    });
    transport.setAuthenticationRequiredHandler(() => {
      notificationCount += 1;
    });

    await transport.request("https://grooveshare.example/api/auth/me", {
      notifyOnUnauthorized: false,
    });

    tester.expect(notificationCount).toBe(0);
  });

  tester.it("creates FormData for browser track uploads", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "guitar.wav", {
      type: "audio/wav",
    });
    const body = createBrowserMultipartBodyFactory().createTrackUploadBody({
      trackName: "Guitar",
      audioFile: file,
    });

    if (!(body instanceof FormData)) {
      throw new Error("Expected browser multipart body to be FormData.");
    }

    tester.expect(body.get("trackName")).toBe("Guitar");
    tester.expect((body.get("audioFile") as File).name).toBe("guitar.wav");
  });

  tester.it("adapts browser local storage to the core storage port", () => {
    const storage = createMemoryStorage();
    const adapter = createBrowserStorageProvider(storage);

    adapter.setItem("key", "value");
    tester.expect(adapter.getItem("key")).toBe("value");
    adapter.removeItem("key");
    tester.expect(adapter.getItem("key")).toBe(null);
  });

  tester.it("persists shared invitation state through sessionStorage-like storage", () => {
    const storage = createMemoryStorage();
    const store = createBrowserInvitationSessionStore(storage);

    store.save({
      projectId: "project-1",
      token: "token",
      pendingContributor: false,
    });
    store.setPendingContributor(true);

    tester.expect(store.get()).toEqual({
      projectId: "project-1",
      token: "token",
      pendingContributor: true,
    });

    store.clear();
    tester.expect(store.get()).toBe(null);
  });
});
