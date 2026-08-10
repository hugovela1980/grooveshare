import { tester } from "./tester-instance.js";

tester.describe("tester mock functions", () => {
  tester.it("tracks mock function calls", () => {
    const mockCallback = tester.fn();

    mockCallback("project-a");
    mockCallback("project-b");

    tester.expect(mockCallback).toHaveBeenCalled();
    tester.expect(mockCallback).toHaveBeenCalledTimes(2);
  });

  tester.it("can clear mock function calls", () => {
    const mockCallback = tester.fn();

    mockCallback("project-a");
    mockCallback.mockClear();

    tester.expect(mockCallback).toHaveBeenCalledTimes(0);
  });

  tester.it("checks whether a mock function was called with specific arguments", () => {
    const mockCallback = tester.fn();

    mockCallback("project-a", { force: true });
    mockCallback("project-b", { force: false });

    tester.expect(mockCallback).toHaveBeenCalledWith("project-a", { force: true });
    tester.expect(mockCallback).toHaveBeenCalledWith("project-b", { force: false });
  });
});