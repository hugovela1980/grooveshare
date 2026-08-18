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
  manageMembersButton?: ButtonLike | null;
  manageMembersPanel?: PanelLike | null;
  manageMembersCloseButton?: ButtonLike | null;
  collaborationLinkButton?: ButtonLike | null;
  collaborationLinkPanel?: PanelLike | null;
  collaborationLinkCloseButton?: ButtonLike | null;
  onEditProject?: () => void;
  onOpenManageMembers?: () => void | Promise<void>;
  onOpenCollaborationLink?: () => void | Promise<void>;
  documentTarget?: EventTargetLike | null;
};

export function createProjectActionsMenuController({
  triggerButton,
  menuElement,
  editProjectButton = null,
  manageMembersButton = null,
  manageMembersPanel = null,
  manageMembersCloseButton = null,
  collaborationLinkButton = null,
  collaborationLinkPanel = null,
  collaborationLinkCloseButton = null,
  onEditProject,
  onOpenManageMembers,
  onOpenCollaborationLink,
  documentTarget =
    typeof document === "undefined"
      ? null
      : (document as unknown as EventTargetLike),
}: ProjectActionsMenuControllerOptions) {
  let globalListenersAttached = false;

  function menuIsOpen(): boolean {
    return !Boolean(menuElement.hidden);
  }

  function panelIsOpen(panel: PanelLike | null): boolean {
    return Boolean(panel) && !Boolean(panel?.hidden);
  }

  function anyPanelIsOpen(): boolean {
    return (
      panelIsOpen(manageMembersPanel) ||
      panelIsOpen(collaborationLinkPanel)
    );
  }

  function syncGlobalListeners(): void {
    const shouldAttach = menuIsOpen() || anyPanelIsOpen();

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

  function closePanel(
    button: ButtonLike | null,
    panel: PanelLike | null,
    { restoreFocus = true } = {},
  ): void {
    if (!button || !panel) {
      return;
    }

    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    syncGlobalListeners();

    if (restoreFocus) {
      triggerButton.focus?.();
    }
  }

  function openPanel({
    button,
    panel,
    otherButton,
    otherPanel,
    onOpen,
  }: {
    button: ButtonLike | null;
    panel: PanelLike | null;
    otherButton: ButtonLike | null;
    otherPanel: PanelLike | null;
    onOpen?: () => void | Promise<void>;
  }): void {
    if (!button || !panel) {
      return;
    }

    closeMenu();
    closePanel(otherButton, otherPanel, { restoreFocus: false });
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    syncGlobalListeners();
    void onOpen?.();
  }

  function openManageMembers(): void {
    openPanel({
      button: manageMembersButton,
      panel: manageMembersPanel,
      otherButton: collaborationLinkButton,
      otherPanel: collaborationLinkPanel,
      onOpen: onOpenManageMembers,
    });
  }

  function closeManageMembers({ restoreFocus = true } = {}): void {
    closePanel(manageMembersButton, manageMembersPanel, { restoreFocus });
  }

  function openCollaborationLink(): void {
    openPanel({
      button: collaborationLinkButton,
      panel: collaborationLinkPanel,
      otherButton: manageMembersButton,
      otherPanel: manageMembersPanel,
      onOpen: onOpenCollaborationLink,
    });
  }

  function closeCollaborationLink({ restoreFocus = true } = {}): void {
    closePanel(collaborationLinkButton, collaborationLinkPanel, {
      restoreFocus,
    });
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

    if (panelIsOpen(collaborationLinkPanel)) {
      event.preventDefault?.();
      closeCollaborationLink();
      return;
    }

    if (panelIsOpen(manageMembersPanel)) {
      event.preventDefault?.();
      closeManageMembers();
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

    manageMembersButton?.addEventListener("click", () => {
      openManageMembers();
    });

    manageMembersCloseButton?.addEventListener("click", () => {
      closeManageMembers();
    });

    collaborationLinkButton?.addEventListener("click", () => {
      openCollaborationLink();
    });

    collaborationLinkCloseButton?.addEventListener("click", () => {
      closeCollaborationLink();
    });
  }

  function destroy(): void {
    closeMenu();
    closeManageMembers({ restoreFocus: false });
    closeCollaborationLink({ restoreFocus: false });
  }

  return {
    init,
    closeMenu,
    closeManageMembers,
    closeCollaborationLink,
    destroy,
  };
}
