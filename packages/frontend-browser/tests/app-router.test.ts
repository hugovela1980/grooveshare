import {
  createAppRouter,
  parseRouteHash,
  routeToHash,
  type AppHistoryState,
  type AppRoute,
  type HistoryAdapter,
} from "../src/index.js";
import { tester } from "./test-runner/tester.js";

function createPageRenderers() {
  return {
    auth: () => "<main>Authentication</main>",
    invitation: () => "<main>Invitation</main>",
    "project-menu": () => "<main>Project Menu</main>",
    "create-project": () => "<main>Create Project</main>",
    "project-player": () => "<main>Project Player</main>",
  };
}

function createFakeHistoryAdapter(initialHash = "#projects") {
  type Entry = { hash: string; state: AppHistoryState };
  let entries: Entry[] = [];
  let index = -1;
  let handler: (() => void) | null = null;
  let hash = initialHash;
  let state: AppHistoryState | null = null;

  const adapter: HistoryAdapter = {
    getHash: () => hash,
    getState: () => state,
    pushState(nextState, nextHash) {
      entries = entries.slice(0, index + 1);
      entries.push({ hash: nextHash, state: nextState });
      index = entries.length - 1;
      hash = nextHash;
      state = nextState;
    },
    replaceState(nextState, nextHash) {
      const entry = { hash: nextHash, state: nextState };
      if (index < 0) {
        entries = [entry];
        index = 0;
      } else {
        entries[index] = entry;
      }
      hash = nextHash;
      state = nextState;
    },
    back() {
      if (index <= 0) return;
      index -= 1;
      hash = entries[index].hash;
      state = entries[index].state;
      handler?.();
    },
    addPopStateListener(nextHandler) {
      handler = nextHandler;
      return () => {
        if (handler === nextHandler) handler = null;
      };
    },
  };

  return { adapter, getHash: () => hash };
}

tester.describe("frontend-browser app router", () => {
  tester.it("owns shared browser hash parsing and formatting", () => {
    tester.expect(routeToHash({ screen: "project-menu" })).toBe("#projects");
    tester.expect(
      routeToHash({ screen: "invitation", invitationToken: "secret/value" }),
    ).toBe("#invite/secret%2Fvalue");
    tester.expect(parseRouteHash("#projects/project%201")).toEqual({
      screen: "project-player",
      projectId: "project 1",
    });
  });

  tester.it("coordinates browser history without knowing desktop or mobile markup", () => {
    const appElement = { innerHTML: "" };
    const history = createFakeHistoryAdapter();
    const restoredRoutes: AppRoute[] = [];

    const router = createAppRouter({
      appElement,
      initialScreen: "project-menu",
      pageRenderers: createPageRenderers(),
      historyAdapter: history.adapter,
      onHistoryNavigation(route) {
        restoredRoutes.push(route);
        router.renderCurrentScreen();
      },
    });

    router.start({ screen: "project-menu" });
    router.navigateTo({ screen: "create-project" });
    tester.expect(history.getHash()).toBe("#projects/new");

    tester.expect(router.goBack({ screen: "project-menu" })).toBe(true);
    tester.expect(restoredRoutes).toEqual([{ screen: "project-menu" }]);
    tester.expect(appElement.innerHTML).toBe("<main>Project Menu</main>");
  });
});
