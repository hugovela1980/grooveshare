type EventHandler = (event: FakeEvent) => void | Promise<void>;

export type FakeEvent = {
  defaultPrevented: boolean;
  preventDefault: () => void;
};

export function createFakeEvent(): FakeEvent {
  return {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

export function createFakeInput(initialValue = "") {
  return {
    value: initialValue,
  };
}

export function createFakeTextElement() {
  return {
    textContent: "",
  };
}

export function createFakeContainer() {
  return {
    innerHTML: "",
  };
}

export function createFakeForm() {
  let submitHandler: EventHandler | null = null;
  let resetCallCount = 0;

  return {
    addEventListener(eventName: string, handler: EventHandler) {
      if (eventName === "submit") {
        submitHandler = handler;
      }
    },

    async submit() {
      if (!submitHandler) {
        throw new Error("No submit handler was registered.");
      }

      const event = createFakeEvent();
      await submitHandler(event);
      return event;
    },

    reset() {
      resetCallCount += 1;
    },

    getResetCallCount() {
      return resetCallCount;
    },
  };
}

export function createFakeSelect(initialValue = "") {
  return {
    value: initialValue,
    innerHTML: "",
  };
}

export function createFakeFileInput(files: File[] = []) {
  return {
    files,
  };
}

type ButtonClickEvent = {
  preventDefault: () => void;
};

type ButtonClickHandler = (
  event: ButtonClickEvent,
) => void | Promise<void>;

export function createFakeButton() {
  let clickHandler: ButtonClickHandler | null = null;
  let preventDefaultCallCount = 0;

  return {
    addEventListener(eventName: string, handler: ButtonClickHandler) {
      if (eventName === "click") {
        clickHandler = handler;
      }
    },

    async click() {
      if (!clickHandler) {
        throw new Error("No click handler was registered.");
      }

      await clickHandler({
        preventDefault() {
          preventDefaultCallCount += 1;
        },
      });
    },

    getPreventDefaultCallCount() {
      return preventDefaultCallCount;
    },
  };
}