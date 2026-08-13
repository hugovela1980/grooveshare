import { createTester } from "../src/index.js";
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

tester.describe("tester output", () => {
  tester.it("collapses a passing suite to one line", async () => {
    const nestedTester = createTester();
    const output: string[] = [];
    const originalLog = console.log;

    nestedTester.describe("database migration behavior", () => {
      nestedTester.it("allows legacy-style tracks without an uploader", () => {});
      nestedTester.it("preserves a track when its uploader is deleted", () => {});
    });

    console.log = (...args: unknown[]) => {
      output.push(args.join(" "));
    };

    try {
      await nestedTester.run();
    } finally {
      console.log = originalLog;
    }

    tester.expect(
      output.includes("✓ database migration behavior"),
    ).toBe(true);
    tester.expect(
      output.some((line) => line.includes("allows legacy-style tracks")),
    ).toBe(false);
  });

  tester.it("shows only failed tests for a failing suite and emphasizes the summary", async () => {
    const nestedTester = createTester();
    const output: string[] = [];
    const originalLog = console.log;
    const previousExitCode = process.exitCode;

    nestedTester.describe("project API routes", () => {
      nestedTester.it("returns API health status", () => {});
      nestedTester.it("deletes a project", () => {
        nestedTester.expect("actual").toBe("expected");
      });
    });

    console.log = (...args: unknown[]) => {
      output.push(args.join(" "));
    };

    try {
      await nestedTester.run();
    } finally {
      console.log = originalLog;
      process.exitCode = previousExitCode;
    }

    tester.expect(output.includes("✗ project API routes")).toBe(true);
    tester.expect(output.includes(" ✗ deletes a project")).toBe(true);
    tester.expect(
      output.some((line) => line.includes("returns API health status")),
    ).toBe(false);
    tester.expect(
      output.filter((line) => line === "===================================").length,
    ).toBe(4);
  });
});
