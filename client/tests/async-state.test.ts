import {
  setControlBusy,
  setRegionBusy,
} from "../src/ui/async-state.js";
import { tester } from "./test-runner/tester.js";

function createAttributeElement() {
  const attributes = new Map<string, string>();

  return {
    disabled: false,
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    removeAttribute(name: string) {
      attributes.delete(name);
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
  };
}

tester.describe("async UI state", () => {
  tester.it("marks a control busy and disables repeated interaction", () => {
    const control = createAttributeElement();

    setControlBusy(control, true);

    tester.expect(control.disabled).toBe(true);
    tester.expect(control.getAttribute("aria-busy")).toBe("true");
    tester.expect(control.getAttribute("data-busy")).toBe("true");

    setControlBusy(control, false);

    tester.expect(control.disabled).toBe(false);
    tester.expect(control.getAttribute("aria-busy")).toBe(null);
    tester.expect(control.getAttribute("data-busy")).toBe(null);
  });

  tester.it("marks a loading region busy without disabling its contents", () => {
    const region = createAttributeElement();

    setRegionBusy(region, true);
    tester.expect(region.getAttribute("aria-busy")).toBe("true");

    setRegionBusy(region, false);
    tester.expect(region.getAttribute("aria-busy")).toBe(null);
  });
});
