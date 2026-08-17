import type { AuthApi } from "../api/auth-api.js";
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
};

type TextElementLike = {
  textContent: string | null;
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
  authApi: Pick<AuthApi, "login" | "registerUser">;
  onAuthenticated: (user: User) => void;
};

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
  authApi,
  onAuthenticated,
}: AuthPageControllerOptions) {
  let requestInFlight = false;

  function setAuthenticationBusy(
    activeButton: BusyControlLike,
    otherButton: BusyControlLike,
    isBusy: boolean,
  ): void {
    setControlBusy(activeButton, isBusy);
    otherButton.disabled = isBusy;
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
      const user = await authApi.login({
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
      await authApi.registerUser({
        email,
        displayName: registerDisplayNameInput.value,
        password,
      });

      statusElement.textContent = "Account created. Signing in...";

      const user = await authApi.login({
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
  }

  return {
    init,
  };
}
