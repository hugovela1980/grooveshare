import type { StorageProvider } from "@hugovela/frontend-core";
import {
  createBrowserInvitationSessionStore,
} from "../src/platform/browser-invitation-session.js";
import {
  createGuestMixStorageProvider,
  getGuestMixStorageKey,
} from "../src/storage/guest-mix-storage.js";
import {
  parseRouteHash,
  routeToHash,
} from "../src/router/app-router.js";
import { tester } from "./test-runner/tester.js";

function createMemoryStorage(): StorageProvider {
  const values = new Map<string, string>();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

tester.describe("mobile invitation routing and browser storage", () => {
  tester.it("parses and renders an invitation route without placing the token in a project route", () => {
    const token = "secret/token value";
    const hash = routeToHash({
      screen: "invitation",
      invitationToken: token,
    });

    tester.expect(hash).toBe("#invite/secret%2Ftoken%20value");
    tester.expect(parseRouteHash(hash)).toEqual({
      screen: "invitation",
      invitationToken: token,
    });
    tester.expect(
      routeToHash({ screen: "project-player", projectId: "project-1" }),
    ).toBe("#projects/project-1");
  });

  tester.it("keeps invitation state separate in session storage", () => {
    const storage = createMemoryStorage();
    const store = createBrowserInvitationSessionStore(storage);

    store.save({
      projectId: "project-1",
      token: "raw-invitation-token",
      pendingContributor: false,
    });

    tester.expect(store.get()).toEqual({
      projectId: "project-1",
      token: "raw-invitation-token",
      pendingContributor: false,
    });

    store.setPendingContributor(true);
    tester.expect(store.get()?.pendingContributor).toBe(true);

    store.clear();
    tester.expect(store.get()).toBe(null);
  });

  tester.it("stores Guest mix settings under a Guest-only project key", () => {
    const storage = createMemoryStorage();
    const guestStorage = createGuestMixStorageProvider(
      "project-1",
      storage,
    );

    if (!guestStorage) {
      throw new Error("Expected Guest storage provider.");
    }

    const sharedViewerKey = "grooveshare:viewer-mix:project-1";
    const guestKey = getGuestMixStorageKey("project-1");

    guestStorage.setItem(sharedViewerKey, '{"volume":0.45}');

    tester.expect(storage.getItem(sharedViewerKey)).toBe(null);
    tester.expect(storage.getItem(guestKey)).toBe('{"volume":0.45}');
    tester.expect(guestStorage.getItem(sharedViewerKey)).toBe(
      '{"volume":0.45}',
    );
  });
});
