type DetailsElementLike = {
  open: boolean;
};

type ScrollTargetLike = {
  addEventListener: (
    type: "scroll",
    listener: () => void,
    options?: { passive?: boolean },
  ) => void;
  removeEventListener: (type: "scroll", listener: () => void) => void;
};

type ProjectDetailsScrollControllerOptions = {
  detailsElement: DetailsElementLike;
  scrollTarget: ScrollTargetLike;
  isPageAtBottom: () => boolean;
};

export function createProjectDetailsScrollController({
  detailsElement,
  scrollTarget,
  isPageAtBottom,
}: ProjectDetailsScrollControllerOptions) {
  let initialized = false;

  function handleScroll(): void {
    if (detailsElement.open && isPageAtBottom()) {
      detailsElement.open = false;
    }
  }

  function init(): void {
    if (initialized) {
      return;
    }

    initialized = true;
    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
  }

  function destroy(): void {
    if (!initialized) {
      return;
    }

    initialized = false;
    scrollTarget.removeEventListener("scroll", handleScroll);
  }

  return {
    init,
    destroy,
  };
}
