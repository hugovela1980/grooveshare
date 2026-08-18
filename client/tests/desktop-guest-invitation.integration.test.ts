import type { SessionProvider } from "@hugovela/frontend-core";
import { ApiError } from "../src/api/api-client.js";
import { createGrooveShareApp } from "../src/app.js";
import type {
  InvitationSession,
  InvitationSessionStore,
} from "../src/platform/browser-invitation-session.js";
import type {
  AppHistoryState,
  HistoryAdapter,
} from "../src/router/app-router.js";
import type { User } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

const user: User = {
  id: "user-1",
  email: "musician@example.com",
  displayName: "Musician",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createHistoryAdapter(initialHash: string) {
  let hash = initialHash;
  let state: AppHistoryState | null = null;
  let popStateHandler: (() => void) | null = null;

  const adapter: HistoryAdapter = {
    getHash() {
      return hash;
    },
    getState() {
      return state;
    },
    pushState(nextState, nextHash) {
      state = nextState;
      hash = nextHash;
    },
    replaceState(nextState, nextHash) {
      state = nextState;
      hash = nextHash;
    },
    back() {
      popStateHandler?.();
    },
    addPopStateListener(handler) {
      popStateHandler = handler;
      return () => {
        if (popStateHandler === handler) {
          popStateHandler = null;
        }
      };
    },
  };

  return {
    adapter,
    getHash() {
      return hash;
    },
  };
}

function createInvitationSessionStore(
  initialSession: InvitationSession | null = null,
): InvitationSessionStore & {
  getSnapshot(): InvitationSession | null;
} {
  let session: InvitationSession | null = initialSession
    ? { ...initialSession }
    : null;

  return {
    get() {
      return session ? { ...session } : null;
    },
    save(nextSession) {
      session = { ...nextSession };
    },
    setPendingContributor(pendingContributor) {
      if (session) {
        session = { ...session, pendingContributor };
      }
    },
    clear() {
      session = null;
    },
    getSnapshot() {
      return session ? { ...session } : null;
    },
  };
}

type SubmitHandler = (
  event: { preventDefault(): void },
) => void | Promise<void>;

type ClickHandler = () => void | Promise<void>;

function createForm() {
  let submitHandler: SubmitHandler | null = null;

  return {
    addEventListener(eventName: "submit", handler: SubmitHandler) {
      if (eventName === "submit") {
        submitHandler = handler;
      }
    },
    async submit() {
      await submitHandler?.({ preventDefault() {} });
    },
  };
}

function createButton() {
  let clickHandler: ClickHandler | null = null;

  return {
    disabled: false,
    addEventListener(eventName: string, handler: ClickHandler) {
      if (eventName === "click") {
        clickHandler = handler;
      }
    },
    async click() {
      await clickHandler?.();
    },
  };
}

function createInvitationAppElement() {
  const contributorButton = createButton();
  const contributorStatus = { textContent: "" as string | null };
  const homeButton = createButton();
  const authButton = createButton();
  const dismissGuestButton = createButton();
  const dismissContributorButton = createButton();
  const guestBanner = { hidden: false };
  const contributorCard = { hidden: false };
  const loginForm = createForm();
  const registerForm = createForm();
  const loginEmail = { value: "musician@example.com" };
  const loginPassword = { value: "password" };
  const registerDisplayName = { value: "Musician" };
  const registerEmail = { value: "musician@example.com" };
  const registerPassword = { value: "password" };
  const loginSubmitButton = createButton();
  const registerSubmitButton = createButton();
  const authStatus = { textContent: "" as string | null };

  const appElement = {
    innerHTML: "",
    querySelector<T>(selector: string): T | null {
      const elements = new Map<string, unknown>([
        ["#become-contributor-button", contributorButton],
        ["#contributor-invitation-status", contributorStatus],
        ["#player-guest-home-button", homeButton],
        ["#player-login-button", authButton],
        ["#dismiss-guest-access-button", dismissGuestButton],
        ["#dismiss-contributor-invitation-button", dismissContributorButton],
        ["#guest-access-banner", guestBanner],
        ["#contributor-invitation-card", contributorCard],
        ["#login-form", loginForm],
        ["#login-email", loginEmail],
        ["#login-password", loginPassword],
        ["#login-submit-button", loginSubmitButton],
        ["#register-form", registerForm],
        ["#register-display-name", registerDisplayName],
        ["#register-email", registerEmail],
        ["#register-password", registerPassword],
        ["#register-submit-button", registerSubmitButton],
        ["#auth-status", authStatus],
      ]);

      return (elements.get(selector) as T | undefined) ?? null;
    },
  };

  return {
    appElement,
    contributorButton,
    homeButton,
    authButton,
    dismissGuestButton,
    dismissContributorButton,
    guestBanner,
    contributorCard,
    loginForm,
  };
}


function createProjectMenuInvitationAppElement() {
  let clickHandler:
    | ((event: { target: EventTarget | null }) => void | Promise<void>)
    | null = null;
  const projectListElement = {
    innerHTML: "",
    addEventListener(
      eventName: "click",
      handler: (event: { target: EventTarget | null }) => void | Promise<void>,
    ) {
      if (eventName === "click") {
        clickHandler = handler;
      }
    },
    setAttribute() {},
    removeAttribute() {},
    async click(target: EventTarget | null) {
      await clickHandler?.({ target });
    },
  };
  const projectMenuStatus = { textContent: "" as string | null };
  const logoutButton = createButton();

  const appElement = {
    innerHTML: "",
    querySelector<T>(selector: string): T | null {
      const elements = new Map<string, unknown>([
        ["#project-list", projectListElement],
        ["#project-menu-status", projectMenuStatus],
        ["#logout-button", logoutButton],
      ]);

      return (elements.get(selector) as T | undefined) ?? null;
    },
  };

  return {
    appElement,
    projectListElement,
    projectMenuStatus,
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
}

tester.describe("desktop Guest invitation integration", () => {
  tester.it("opens an invitation without auth and removes the raw token from the normal project URL", async () => {
    const originalFetch = globalThis.fetch;
    const history = createHistoryAdapter("#invite/raw-guest-token");
    const invitationStore = createInvitationSessionStore();
    const {
      appElement,
      homeButton,
      dismissGuestButton,
      dismissContributorButton,
      guestBanner,
      contributorCard,
    } = createInvitationAppElement();
    const observedHeaders: string[] = [];

    const sessionProvider: SessionProvider = {
      async getCurrentUser() {
        throw new ApiError("Authentication required.", 401);
      },
      async login() {
        return user;
      },
      async registerUser() {
        return user;
      },
      async logout() {},
    };

    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      observedHeaders.push(
        new Headers(init?.headers).get("X-GrooveShare-Invite") ?? "",
      );

      if (url.endsWith("/api/invitations/guest")) {
        return new Response(
          JSON.stringify({ ok: true, data: { projectId: "project-1" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.endsWith("/api/projects/project-1")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              id: "project-1",
              title: "Shared Song",
              description: "Guest invitation",
              role: null,
              access: "guest",
              mixSettings: { channels: [] },
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    }) as typeof fetch;

    try {
      const app = createGrooveShareApp({
        appElement,
        sessionProvider,
        historyAdapter: history.adapter,
        invitationSessionStore: invitationStore,
      });

      await app.start();

      tester.expect(app.getCurrentScreen()).toBe("project-player");
      tester.expect(app.getCurrentUser()).toBe(null);
      tester.expect(history.getHash()).toBe("#projects/project-1");
      tester.expect(history.getHash().includes("raw-guest-token")).toBe(false);
      tester.expect(invitationStore.getSnapshot()).toEqual({
        projectId: "project-1",
        token: "raw-guest-token",
        pendingContributor: false,
      });
      tester.expect(appElement.innerHTML.includes("viewing this project as a Guest")).toBe(true);
      tester.expect(appElement.innerHTML.includes("Become a Contributor")).toBe(true);
      tester.expect(appElement.innerHTML.includes("player-login-button")).toBe(true);
      tester.expect(appElement.innerHTML.includes("player-back-button")).toBe(false);
      tester.expect(appElement.innerHTML.includes(">Log In</button>")).toBe(true);

      await dismissGuestButton.click();
      await dismissContributorButton.click();
      tester.expect(guestBanner.hidden).toBe(true);
      tester.expect(contributorCard.hidden).toBe(true);

      await homeButton.click();
      await flushMicrotasks();
      tester.expect(app.getCurrentScreen()).toBe("auth");

      tester.expect(observedHeaders).toEqual([
        "raw-guest-token",
        "raw-guest-token",
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  tester.it("preserves a pending Contributor invitation through Login and requires explicit acceptance", async () => {
    const originalFetch = globalThis.fetch;
    const history = createHistoryAdapter("#invite/contributor-token");
    const invitationStore = createInvitationSessionStore();
    const { appElement, contributorButton, loginForm } =
      createInvitationAppElement();
    let authenticated = false;
    let accepted = false;
    let acceptCallCount = 0;

    const sessionProvider: SessionProvider = {
      async getCurrentUser() {
        throw new ApiError("Authentication required.", 401);
      },
      async login() {
        authenticated = true;
        return user;
      },
      async registerUser() {
        return user;
      },
      async logout() {},
    };

    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "GET" && url.endsWith("/api/invitations/guest")) {
        return new Response(
          JSON.stringify({ ok: true, data: { projectId: "project-1" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (method === "POST" && url.endsWith("/api/invitations/accept")) {
        acceptCallCount += 1;
        accepted = true;
        return new Response(
          JSON.stringify({
            ok: true,
            data: { projectId: "project-1", role: "contributor" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (method === "GET" && url.endsWith("/api/projects/project-1")) {
        const invitationHeader = new Headers(init?.headers).get(
          "X-GrooveShare-Invite",
        );

        if (accepted && !invitationHeader) {
          return new Response(
            JSON.stringify({
              ok: true,
              data: {
                id: "project-1",
                title: "Shared Song",
                description: "Contributor project",
                role: "contributor",
                mixSettings: { channels: [] },
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              id: "project-1",
              title: "Shared Song",
              description: authenticated
                ? "Authenticated invitation"
                : "Guest invitation",
              role: null,
              access: "guest",
              mixSettings: { channels: [] },
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    }) as typeof fetch;

    try {
      const app = createGrooveShareApp({
        appElement,
        sessionProvider,
        historyAdapter: history.adapter,
        invitationSessionStore: invitationStore,
      });

      await app.start();
      await contributorButton.click();
      await flushMicrotasks();

      tester.expect(app.getCurrentScreen()).toBe("auth");
      tester.expect(acceptCallCount).toBe(0);
      tester.expect(invitationStore.getSnapshot()?.pendingContributor).toBe(true);

      await loginForm.submit();
      await flushMicrotasks();

      tester.expect(app.getCurrentUser()).toEqual(user);
      tester.expect(app.getCurrentScreen()).toBe("project-player");
      tester.expect(acceptCallCount).toBe(0);
      tester.expect(appElement.innerHTML.includes("Accept Contributor Invitation")).toBe(true);

      await contributorButton.click();
      await flushMicrotasks();

      tester.expect(acceptCallCount).toBe(1);
      tester.expect(invitationStore.getSnapshot()).toBe(null);
      tester.expect(app.getCurrentScreen()).toBe("project-player");
      tester.expect(appElement.innerHTML.includes("Contributor")).toBe(true);
      tester.expect(appElement.innerHTML.includes("Become a Contributor")).toBe(false);
      tester.expect(
        appElement.innerHTML.includes(
          "You have been added as a collaborator for this project.",
        ),
      ).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  tester.it("shows the active invitation on Projects only after the user is authenticated", async () => {
    const originalFetch = globalThis.fetch;
    const history = createHistoryAdapter("#projects");
    const invitationStore = createInvitationSessionStore({
      projectId: "project-1",
      token: "saved-invitation-token",
      pendingContributor: false,
    });
    const { appElement, projectListElement } =
      createProjectMenuInvitationAppElement();

    const sessionProvider: SessionProvider = {
      async getCurrentUser() {
        return user;
      },
      async login() {
        return user;
      },
      async registerUser() {
        return user;
      },
      async logout() {},
    };

    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "GET" && url.endsWith("/api/invitations/guest")) {
        return new Response(
          JSON.stringify({ ok: true, data: { projectId: "project-1" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (method === "GET" && url.endsWith("/api/projects/project-1")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              id: "project-1",
              title: "Invited Song",
              description: "Not a member yet",
              role: null,
              access: "guest",
              mixSettings: { channels: [] },
              createdAt: "2026-01-02T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (method === "GET" && url.endsWith("/api/projects")) {
        return new Response(
          JSON.stringify({ ok: true, data: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    }) as typeof fetch;

    try {
      const app = createGrooveShareApp({
        appElement,
        sessionProvider,
        historyAdapter: history.adapter,
        invitationSessionStore: invitationStore,
      });

      await app.start();
      await flushMicrotasks();

      tester.expect(app.getCurrentScreen()).toBe("project-menu");
      tester.expect(projectListElement.innerHTML.includes("Invited Song")).toBe(true);
      tester.expect(projectListElement.innerHTML.includes(">Guest<")).toBe(true);
      tester.expect(projectListElement.innerHTML.includes("project-card--invited")).toBe(true);
      tester.expect(
        projectListElement.innerHTML.includes("Become a Collaborator"),
      ).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  tester.it("blocks a stale or revoked Guest invitation before rendering the Project Player", async () => {
    const originalFetch = globalThis.fetch;
    const history = createHistoryAdapter("#projects/project-1");
    const invitationStore = createInvitationSessionStore({
      projectId: "project-1",
      token: "revoked-token",
      pendingContributor: false,
    });
    const { appElement } = createInvitationAppElement();

    const sessionProvider: SessionProvider = {
      async getCurrentUser() {
        throw new ApiError("Authentication required.", 401);
      },
      async login() {
        return user;
      },
      async registerUser() {
        return user;
      },
      async logout() {},
    };

    globalThis.fetch = (async (input) => {
      const url = String(input);

      if (url.endsWith("/api/invitations/guest")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Invitation link is invalid or disabled.",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unexpected request: GET ${url}`);
    }) as typeof fetch;

    try {
      const app = createGrooveShareApp({
        appElement,
        sessionProvider,
        historyAdapter: history.adapter,
        invitationSessionStore: invitationStore,
      });

      await app.start();

      tester.expect(app.getCurrentScreen()).toBe("auth");
      tester.expect(invitationStore.getSnapshot()).toBe(null);
      tester.expect(
        appElement.innerHTML.includes("invalid or no longer active"),
      ).toBe(true);
      tester.expect(
        appElement.innerHTML.includes("viewing this project as a Guest"),
      ).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
