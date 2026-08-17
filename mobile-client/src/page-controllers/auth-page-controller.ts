import type { SessionProvider } from "@hugovela/frontend-core";
import type { User } from "../types.js";
import {
  setControlBusy,
  type BusyControlLike,
} from "../ui/async-state.js";

type FormEventLike = {
  preventDefault: () => void;
};

type FormElementLike = {
  addEventListener: (
    eventName: "submit",
    handler: (event: FormEventLike) => void | Promise<void>,
  ) => void;
};

type InputElementLike = {
  value: string;
  focus?: () => void;
};

type TextElementLike = {
  textContent: string | null;
};

type VisibilityElementLike = {
  hidden: boolean | string;
};

type ModeButtonLike = BusyControlLike & {
  addEventListener: (
    eventName: "click",
    handler: () => void,
  ) => void;
  setAttribute?: (name: string, value: string) => void;
};

type AuthPageControllerOptions = {
  loginForm: FormElementLike;
  loginEmailInput: InputElementLike;
  loginPasswordInput: InputElementLike;
  loginSubmitButton: BusyControlLike;
  registerForm: FormElementLike;
  registerDisplayNameInput: InputElementLike;
  registerEmailInput: InputElementLike;
  registerPasswordInput: InputElementLike;
  registerSubmitButton: BusyControlLike;
  statusElement: TextElementLike;
  sessionProvider: Pick<SessionProvider, "login" | "registerUser">;
  onAuthenticated: (user: User) => void;
  loginModeButton?: ModeButtonLike | null;
  registerModeButton?: ModeButtonLike | null;
  loginCard?: VisibilityElementLike | null;
  registerCard?: VisibilityElementLike | null;
};

type AuthMode = "login" | "register";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Authentication request failed.";
}

export function createAuthPageController({
  loginForm,
  loginEmailInput,
  loginPasswordInput,
  loginSubmitButton,
  registerForm,
  registerDisplayNameInput,
  registerEmailInput,
  registerPasswordInput,
  registerSubmitButton,
  statusElement,
  sessionProvider,
  onAuthenticated,
  loginModeButton = null,
  registerModeButton = null,
  loginCard = null,
  registerCard = null,
}: AuthPageControllerOptions) {
  let requestInFlight = false;
  let currentMode: AuthMode = "login";

  function setAuthenticationBusy(
    activeButton: BusyControlLike,
    otherButton: BusyControlLike,
    isBusy: boolean,
  ): void {
    setControlBusy(activeButton, isBusy);
    otherButton.disabled = isBusy;
    loginModeButton && (loginModeButton.disabled = isBusy);
    registerModeButton && (registerModeButton.disabled = isBusy);
  }

  function setMode(mode: AuthMode, { focus = true } = {}): void {
    if (requestInFlight) {
      return;
    }

    currentMode = mode;
    const showingLogin = mode === "login";

    if (loginCard) {
      loginCard.hidden = !showingLogin;
    }

    if (registerCard) {
      registerCard.hidden = showingLogin;
    }

    loginModeButton?.setAttribute?.("aria-selected", String(showingLogin));
    registerModeButton?.setAttribute?.("aria-selected", String(!showingLogin));
    statusElement.textContent = "";

    if (!focus) {
      return;
    }

    if (showingLogin) {
      loginEmailInput.focus?.();
      return;
    }

    registerDisplayNameInput.focus?.();
  }

  async function handleLoginSubmit(
    event: FormEventLike,
  ): Promise<void> {
    event.preventDefault();

    if (requestInFlight) {
      return;
    }

    requestInFlight = true;
    setAuthenticationBusy(
      loginSubmitButton,
      registerSubmitButton,
      true,
    );
    statusElement.textContent = "Signing in...";

    try {
      const user = await sessionProvider.login({
        email: loginEmailInput.value,
        password: loginPasswordInput.value,
      });

      statusElement.textContent = "";
      onAuthenticated(user);
    } catch (error) {
      statusElement.textContent = getErrorMessage(error);
    } finally {
      requestInFlight = false;
      setAuthenticationBusy(
        loginSubmitButton,
        registerSubmitButton,
        false,
      );
    }
  }

  async function handleRegisterSubmit(
    event: FormEventLike,
  ): Promise<void> {
    event.preventDefault();

    if (requestInFlight) {
      return;
    }

    requestInFlight = true;
    setAuthenticationBusy(
      registerSubmitButton,
      loginSubmitButton,
      true,
    );
    statusElement.textContent = "Creating account...";

    const email = registerEmailInput.value;
    const password = registerPasswordInput.value;

    try {
      await sessionProvider.registerUser({
        email,
        displayName: registerDisplayNameInput.value,
        password,
      });

      statusElement.textContent = "Account created. Signing in...";

      const user = await sessionProvider.login({
        email,
        password,
      });

      statusElement.textContent = "";
      onAuthenticated(user);
    } catch (error) {
      statusElement.textContent = getErrorMessage(error);
    } finally {
      requestInFlight = false;
      setAuthenticationBusy(
        registerSubmitButton,
        loginSubmitButton,
        false,
      );
    }
  }

  function init(): void {
    loginForm.addEventListener("submit", handleLoginSubmit);
    registerForm.addEventListener("submit", handleRegisterSubmit);
    loginModeButton?.addEventListener("click", () => setMode("login"));
    registerModeButton?.addEventListener("click", () => setMode("register"));
    setMode(currentMode, { focus: false });
  }

  return {
    init,
    setMode,
  };
}
