import { createAuthPageController } from "../src/page-controllers/auth-page-controller.js";
import type { User } from "../src/types.js";
import {
  createFakeForm,
  createFakeInput,
  createFakeTextElement,
} from "./helpers/fake-dom.js";
import { tester } from "./test-runner/tester.js";

const user: User = {
  id: "user-1",
  email: "musician@example.com",
  displayName: "Musician",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createSetup() {
  const loginForm = createFakeForm();
  const loginEmailInput = createFakeInput("musician@example.com");
  const loginPasswordInput = createFakeInput("a sufficiently long password");
  const registerForm = createFakeForm();
  const registerDisplayNameInput = createFakeInput("Musician");
  const registerEmailInput = createFakeInput("new@example.com");
  const registerPasswordInput = createFakeInput("another long password");
  const statusElement = createFakeTextElement();
  const authenticatedUsers: User[] = [];

  return {
    loginForm,
    loginEmailInput,
    loginPasswordInput,
    registerForm,
    registerDisplayNameInput,
    registerEmailInput,
    registerPasswordInput,
    statusElement,
    authenticatedUsers,
  };
}

tester.describe("auth page controller", () => {
  tester.it("logs in and reports the authenticated user to the app", async () => {
    const setup = createSetup();
    const loginCalls: unknown[] = [];

    const controller = createAuthPageController({
      ...setup,
      authApi: {
        async login(input) {
          loginCalls.push(input);
          return user;
        },
        async registerUser() {
          return user;
        },
      },
      onAuthenticated(authenticatedUser) {
        setup.authenticatedUsers.push(authenticatedUser);
      },
    });

    controller.init();
    const event = await setup.loginForm.submit();

    tester.expect(event.defaultPrevented).toBe(true);
    tester.expect(loginCalls).toEqual([
      {
        email: "musician@example.com",
        password: "a sufficiently long password",
      },
    ]);
    tester.expect(setup.authenticatedUsers).toEqual([user]);
    tester.expect(setup.statusElement.textContent).toBe("");
  });

  tester.it("registers and then logs in so the new account receives a session", async () => {
    const setup = createSetup();
    const calls: string[] = [];

    const controller = createAuthPageController({
      ...setup,
      authApi: {
        async registerUser() {
          calls.push("register");
          return user;
        },
        async login() {
          calls.push("login");
          return user;
        },
      },
      onAuthenticated(authenticatedUser) {
        setup.authenticatedUsers.push(authenticatedUser);
      },
    });

    controller.init();
    const event = await setup.registerForm.submit();

    tester.expect(event.defaultPrevented).toBe(true);
    tester.expect(calls).toEqual(["register", "login"]);
    tester.expect(setup.authenticatedUsers).toEqual([user]);
    tester.expect(setup.statusElement.textContent).toBe("");
  });

  tester.it("shows authentication errors without reporting a user", async () => {
    const setup = createSetup();

    const controller = createAuthPageController({
      ...setup,
      authApi: {
        async login() {
          throw new Error("Invalid email or password.");
        },
        async registerUser() {
          return user;
        },
      },
      onAuthenticated(authenticatedUser) {
        setup.authenticatedUsers.push(authenticatedUser);
      },
    });

    controller.init();
    await setup.loginForm.submit();

    tester.expect(setup.authenticatedUsers.length).toBe(0);
    tester.expect(setup.statusElement.textContent).toBe(
      "Invalid email or password.",
    );
  });
});
