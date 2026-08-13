import type { AuthApi } from "../api/auth-api.js";
import type { User } from "../types.js";

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
  registerForm: FormElementLike;
  registerDisplayNameInput: InputElementLike;
  registerEmailInput: InputElementLike;
  registerPasswordInput: InputElementLike;
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
  registerForm,
  registerDisplayNameInput,
  registerEmailInput,
  registerPasswordInput,
  statusElement,
  authApi,
  onAuthenticated,
}: AuthPageControllerOptions) {
  async function handleLoginSubmit(
    event: FormEventLike,
  ): Promise<void> {
    event.preventDefault();
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
    }
  }

  async function handleRegisterSubmit(
    event: FormEventLike,
  ): Promise<void> {
    event.preventDefault();
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
