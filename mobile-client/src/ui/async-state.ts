export type BusyControlLike = {
  disabled?: boolean;
  setAttribute?: (name: string, value: string) => void;
  removeAttribute?: (name: string) => void;
};

export type BusyRegionLike = {
  setAttribute?: (name: string, value: string) => void;
  removeAttribute?: (name: string) => void;
};

export function setControlBusy(
  control: BusyControlLike | null | undefined,
  isBusy: boolean,
): void {
  if (!control) {
    return;
  }

  control.disabled = isBusy;

  if (isBusy) {
    control.setAttribute?.("aria-busy", "true");
    control.setAttribute?.("data-busy", "true");
    return;
  }

  control.removeAttribute?.("aria-busy");
  control.removeAttribute?.("data-busy");
}

export function setRegionBusy(
  region: BusyRegionLike | null | undefined,
  isBusy: boolean,
): void {
  if (!region) {
    return;
  }

  if (isBusy) {
    region.setAttribute?.("aria-busy", "true");
    return;
  }

  region.removeAttribute?.("aria-busy");
}
