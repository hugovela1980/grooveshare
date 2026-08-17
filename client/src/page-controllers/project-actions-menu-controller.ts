type ClickEventLike = {
  target: EventTarget | null;
};

type KeyboardEventLike = {
  key?: string;
  preventDefault?: () => void;
};

type EventTargetLike = {
  addEventListener: (
    eventName: "click" | "keydown",
    handler: (event: ClickEventLike | KeyboardEventLike) => void,
  ) => void;
  removeEventListener: (
    eventName: "click" | "keydown",
    handler: (event: ClickEventLike | KeyboardEventLike) => void,
  ) => void;
};

type ButtonLike = {
  addEventListener: (
    eventName: "click",
    handler: (event: ClickEventLike) => void,
  ) => void;
  setAttribute: (name: string, value: string) => void;
  focus?: () => void;
  contains?: (target: Node | null) => boolean;
};

type MenuLike = {
  hidden: boolean | string;
  contains?: (target: Node | null) => boolean;
};

type PanelLike = {
  hidden: boolean | string;
};

type ProjectActionsMenuControllerOptions = {
  triggerButton: ButtonLike;
  menuElement: MenuLike;
  ownerControlsButton?: ButtonLike | null;
  ownerControlsPanel?: PanelLike | null;
  documentTarget?: EventTargetLike | null;
};

export function createProjectActionsMenuController({
  triggerButton,
  menuElement,
  ownerControlsButton = null,
  ownerControlsPanel = null,
  documentTarget =
  typeof document === "undefined"
    ? null
    : (document as unknown as EventTargetLike),
}: ProjectActionsMenuControllerOptions) {
  let globalListenersAttached = false;

  function setMenuOpen(isOpen: boolean): void {
    menuElement.hidden = !isOpen;
    triggerButton.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
      attachGlobalListeners();
      return;
    }

    removeGlobalListeners();
  }

  function closeMenu({ restoreFocus = false } = {}): void {
    setMenuOpen(false);

    if (restoreFocus) {
      triggerButton.focus?.();
    }
  }

  function handleDocumentClick(event: ClickEventLike | KeyboardEventLike): void {
    if (!("target" in event)) {
      return;
    }

    const target = event.target as Node | null;

    if (triggerButton.contains?.(target) || menuElement.contains?.(target)) {
      return;
    }

    closeMenu();
  }

  function handleDocumentKeydown(event: ClickEventLike | KeyboardEventLike): void {
    if (!("key" in event) || event.key !== "Escape") {
      return;
    }

    event.preventDefault?.();
    closeMenu({ restoreFocus: true });
  }

  function attachGlobalListeners(): void {
    if (!documentTarget || globalListenersAttached) {
      return;
    }

    documentTarget.addEventListener("click", handleDocumentClick);
    documentTarget.addEventListener("keydown", handleDocumentKeydown);
    globalListenersAttached = true;
  }

  function removeGlobalListeners(): void {
    if (!documentTarget || !globalListenersAttached) {
      return;
    }

    documentTarget.removeEventListener("click", handleDocumentClick);
    documentTarget.removeEventListener("keydown", handleDocumentKeydown);
    globalListenersAttached = false;
  }

  function toggleMenu(): void {
    setMenuOpen(Boolean(menuElement.hidden));
  }

  function toggleOwnerControls(): void {
    if (!ownerControlsButton || !ownerControlsPanel) {
      return;
    }

    const ownerControlsAreHidden = Boolean(ownerControlsPanel.hidden);

    ownerControlsPanel.hidden = !ownerControlsAreHidden;

    ownerControlsButton.setAttribute(
      "aria-expanded",
      String(ownerControlsAreHidden),
    );

    closeMenu();
  }

  function init(): void {
    triggerButton.addEventListener("click", () => {
      toggleMenu();
    });

    ownerControlsButton?.addEventListener("click", () => {
      toggleOwnerControls();
    });
  }

  function destroy(): void {
    closeMenu();
  }

  return {
    init,
    closeMenu,
    destroy,
  };
}
