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

type FocusableLike = {
  focus?: () => void;
};

type ButtonLike = FocusableLike & {
  addEventListener: (
    eventName: "click",
    handler: (event: ClickEventLike) => void,
  ) => void;
  setAttribute: (name: string, value: string) => void;
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
  editProjectButton?: ButtonLike | null;
  ownerControlsButton?: ButtonLike | null;
  ownerControlsPanel?: PanelLike | null;
  ownerControlsCloseButton?: ButtonLike | null;
  onEditProject?: () => void;
  documentTarget?: EventTargetLike | null;
};

export function createProjectActionsMenuController({
  triggerButton,
  menuElement,
  editProjectButton = null,
  ownerControlsButton = null,
  ownerControlsPanel = null,
  ownerControlsCloseButton = null,
  onEditProject,
  documentTarget =
    typeof document === "undefined"
      ? null
      : (document as unknown as EventTargetLike),
}: ProjectActionsMenuControllerOptions) {
  let globalListenersAttached = false;

  function menuIsOpen(): boolean {
    return !Boolean(menuElement.hidden);
  }

  function ownerControlsAreOpen(): boolean {
    return Boolean(ownerControlsPanel) && !Boolean(ownerControlsPanel?.hidden);
  }

  function syncGlobalListeners(): void {
    const shouldAttach = menuIsOpen() || ownerControlsAreOpen();

    if (!documentTarget) {
      return;
    }

    if (shouldAttach && !globalListenersAttached) {
      documentTarget.addEventListener("click", handleDocumentClick);
      documentTarget.addEventListener("keydown", handleDocumentKeydown);
      globalListenersAttached = true;
      return;
    }

    if (!shouldAttach && globalListenersAttached) {
      documentTarget.removeEventListener("click", handleDocumentClick);
      documentTarget.removeEventListener("keydown", handleDocumentKeydown);
      globalListenersAttached = false;
    }
  }

  function setMenuOpen(isOpen: boolean): void {
    menuElement.hidden = !isOpen;
    triggerButton.setAttribute("aria-expanded", String(isOpen));
    syncGlobalListeners();
  }

  function closeMenu({ restoreFocus = false } = {}): void {
    setMenuOpen(false);

    if (restoreFocus) {
      triggerButton.focus?.();
    }
  }

  function openOwnerControls(): void {
    if (!ownerControlsButton || !ownerControlsPanel) {
      return;
    }

    closeMenu();
    ownerControlsPanel.hidden = false;
    ownerControlsButton.setAttribute("aria-expanded", "true");
    syncGlobalListeners();
  }

  function closeOwnerControls({ restoreFocus = true } = {}): void {
    if (!ownerControlsButton || !ownerControlsPanel) {
      return;
    }

    ownerControlsPanel.hidden = true;
    ownerControlsButton.setAttribute("aria-expanded", "false");
    syncGlobalListeners();

    if (restoreFocus) {
      triggerButton.focus?.();
    }
  }

  function handleDocumentClick(event: ClickEventLike | KeyboardEventLike): void {
    if (!menuIsOpen() || !("target" in event)) {
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

    if (ownerControlsAreOpen()) {
      event.preventDefault?.();
      closeOwnerControls();
      return;
    }

    if (menuIsOpen()) {
      event.preventDefault?.();
      closeMenu({ restoreFocus: true });
    }
  }

  function toggleMenu(): void {
    setMenuOpen(Boolean(menuElement.hidden));
  }

  function handleEditProject(): void {
    closeMenu();
    onEditProject?.();
  }

  function init(): void {
    triggerButton.addEventListener("click", () => {
      toggleMenu();
    });

    editProjectButton?.addEventListener("click", () => {
      handleEditProject();
    });

    ownerControlsButton?.addEventListener("click", () => {
      openOwnerControls();
    });

    ownerControlsCloseButton?.addEventListener("click", () => {
      closeOwnerControls();
    });
  }

  function destroy(): void {
    closeMenu();
    closeOwnerControls({ restoreFocus: false });
  }

  return {
    init,
    closeMenu,
    closeOwnerControls,
    destroy,
  };
}
