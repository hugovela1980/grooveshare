import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type TestCallback = () => void | Promise<void>;

type MockFunction = {
  (...args: unknown[]): unknown;
  calls: unknown[][];
  mockClear: () => void;
};

type TestCase = {
  name: string;
  callback: TestCallback;
};

type TestSuite = {
  name: string;
  tests: TestCase[];
  beforeEachCallbacks: TestCallback[];
};

type TestFailure = {
  suite: string;
  test: string;
  error: string;
  fileUrl: string;
  assertion: string;
  result: string;
};

const testSuites: TestSuite[] = [];
let currentSuite: TestSuite | null = null;

function formatValue(value: unknown): string {
  return typeof value === "string" ? `"${value}"` : JSON.stringify(value, null, 2);
}

function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function createAssertionError(message: string): Error {
  return new Error(message);
}

type ParsedFileUrl = {
  fileUrlWithoutLocation: string;
  lineNumber: number;
};

function parseFileUrlWithLocation(fileUrl: string): ParsedFileUrl | null {
  const match = fileUrl.match(
    /^(file:\/\/.*\.(?:ts|tsx|js|jsx|mjs|cjs)):(\d+):(\d+)$/,
  );

  if (!match) {
    return null;
  }

  return {
    fileUrlWithoutLocation: match[1],
    lineNumber: Number(match[2]),
  };
}

function getAssertionLine(fileUrl: string): string {
  const parsedFileUrl = parseFileUrlWithLocation(fileUrl);

  if (!parsedFileUrl) {
    return "Unknown assertion";
  }

  try {
    const filePath = fileURLToPath(parsedFileUrl.fileUrlWithoutLocation);
    const fileLines = readFileSync(filePath, "utf8").split(/\r?\n/);
    const assertionLine = fileLines[parsedFileUrl.lineNumber - 1];

    return assertionLine?.trim() || "Unknown assertion";
  } catch {
    return "Unknown assertion";
  }
}

function getFailureResult(errorMessage: string): string {
  const toBeMatch = errorMessage.match(/^Expected (.+) to be .+$/);

  if (toBeMatch) {
    return `got ${toBeMatch[1]}`;
  }

  const toEqualMatch = errorMessage.match(/^Expected (.+) to equal .+$/);

  if (toEqualMatch) {
    return `got ${toEqualMatch[1]}`;
  }

  return errorMessage;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getErrorStack(error: unknown): string {
  return error instanceof Error && error.stack ? error.stack : "";
}

function normalizeFileReference(fileReference: string): string {
  if (fileReference.startsWith("file://")) {
    return fileReference;
  }

  return `file:///${fileReference.replaceAll("\\", "/")}`;
}

function extractFileReferenceFromStackLine(stackLine: string): string | null {
  const fileUrlMatch = stackLine.match(
    /file:\/\/[^\s)]+?\.(?:ts|tsx|js|jsx|mjs|cjs):\d+:\d+/,
  );

  if (fileUrlMatch) {
    return fileUrlMatch[0];
  }

  const windowsPathMatch = stackLine.match(
    /[A-Za-z]:[\\/][^\s)]+?\.(?:ts|tsx|js|jsx|mjs|cjs):\d+:\d+/,
  );

  if (windowsPathMatch) {
    return normalizeFileReference(windowsPathMatch[0]);
  }

  const unixPathMatch = stackLine.match(
    /\/[^\s)]+?\.(?:ts|tsx|js|jsx|mjs|cjs):\d+:\d+/,
  );

  if (unixPathMatch) {
    return normalizeFileReference(unixPathMatch[0]);
  }

  return null;
}

function isTestRunnerInternalFile(fileReference: string): boolean {
  return fileReference
    .replaceAll("\\", "/")
    .includes("/tests/test-runner/tester.ts");
}

function getFailureFileUrl(error: unknown): string {
  const stack = getErrorStack(error);

  if (!stack) {
    return "Unknown file";
  }

  const fileReferences = stack
    .split("\n")
    .map(extractFileReferenceFromStackLine)
    .filter((fileReference): fileReference is string => {
      return fileReference !== null;
    });

  return (
    fileReferences.find((fileReference) => {
      return !isTestRunnerInternalFile(fileReference);
    }) ??
    fileReferences[0] ??
    "Unknown file"
  );
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown): void {
      if (actual !== expected) {
        throw createAssertionError(
          `Expected ${formatValue(actual)} to be ${formatValue(expected)}`,
        );
      }
    },

    toEqual(expected: unknown): void {
      if (!deepEqual(actual, expected)) {
        throw createAssertionError(
          `Expected ${formatValue(actual)} to equal ${formatValue(expected)}`,
        );
      }
    },

    toBeTruthy(): void {
      if (!actual) {
        throw createAssertionError(`Expected ${formatValue(actual)} to be truthy`);
      }
    },

    toBeFalsy(): void {
      if (actual) {
        throw createAssertionError(`Expected ${formatValue(actual)} to be falsy`);
      }
    },

    toHaveBeenCalled(): void {
      if (!isMockFunction(actual)) {
        throw createAssertionError("Expected value to be a mock function.");
      }

      if (actual.calls.length === 0) {
        throw createAssertionError("Expected mock function to have been called.");
      }
    },

    toHaveBeenCalledTimes(expectedCallCount: number): void {
      if (!isMockFunction(actual)) {
        throw createAssertionError("Expected value to be a mock function.");
      }

      if (actual.calls.length !== expectedCallCount) {
        throw createAssertionError(
          `Expected mock function to have been called ${expectedCallCount} times, but it was called ${actual.calls.length} times.`,
        );
      }
    },

    toHaveBeenCalledWith(...expectedArgs: unknown[]): void {
      if (!isMockFunction(actual)) {
        throw createAssertionError("Expected value to be a mock function.");
      }

      const wasCalledWithExpectedArgs = actual.calls.some((callArgs) => {
        return deepEqual(callArgs, expectedArgs);
      });

      if (!wasCalledWithExpectedArgs) {
        throw createAssertionError(
          `Expected mock function to have been called with ${formatValue(
            expectedArgs,
          )}, but received calls: ${formatValue(actual.calls)}`,
        );
      }
    },
  };
}

function isMockFunction(value: unknown): value is MockFunction {
  return (
    typeof value === "function" &&
    "calls" in value &&
    Array.isArray((value as MockFunction).calls)
  );
}

function describe(name: string, callback: () => void): void {
  const suite: TestSuite = {
    name,
    tests: [],
    beforeEachCallbacks: [],
  };

  testSuites.push(suite);

  const previousSuite = currentSuite;
  currentSuite = suite;

  callback();

  currentSuite = previousSuite;
}

function beforeEach(callback: TestCallback): void {
  if (!currentSuite) {
    throw new Error("tester.beforeEach() must be inside tester.describe().");
  }

  currentSuite.beforeEachCallbacks.push(callback);
}

function it(name: string, callback: TestCallback): void {
  if (!currentSuite) {
    throw new Error(`Test "${name}" must be inside tester.describe().`);
  }

  currentSuite.tests.push({ name, callback });
}

const test = it;

function fn(implementation: (...args: unknown[]) => unknown = () => undefined) {
  const mockFunction = ((...args: unknown[]) => {
    mockFunction.calls.push(args);
    return implementation(...args);
  }) as MockFunction;

  mockFunction.calls = [];

  mockFunction.mockClear = () => {
    mockFunction.calls = [];
  };

  return mockFunction;
}

async function run() {
  let total = 0;
  let passed = 0;
  let failed = 0;
  const failures: TestFailure[] = [];

  console.log("\nRunning tests...\n");

  for (const suite of testSuites) {
    console.log(`\n${suite.name}`);

    for (const testCase of suite.tests) {
      total += 1;

      try {
        for (const beforeEachCallback of suite.beforeEachCallbacks) {
          await beforeEachCallback();
        }

        await testCase.callback();

        passed += 1;
        console.log(` ✓ ${testCase.name}`);
      } catch (error) {
        failed += 1;

        const errorMessage = getErrorMessage(error);
        const fileUrl = getFailureFileUrl(error);
        const assertion = getAssertionLine(fileUrl);
        const result = getFailureResult(errorMessage);

        failures.push({
          suite: suite.name,
          test: testCase.name,
          error: errorMessage,
          fileUrl,
          assertion,
          result,
        });

        console.log(` ✗ ${testCase.name}`);
        console.log(` ${errorMessage}`);
      }
    }
  }

  console.log("\nTest Summary");
  console.log(` Total: ${total}`);
  console.log(` Passed: ${passed}`);
  console.log(` Failed: ${failed}`);

  if (failures.length > 0) {
    console.log("\nFailed Test Details");

    failures.forEach((failure, index) => {
      console.log(`\n${index + 1}. ${failure.suite}`);
      console.log(`   test: ${failure.test}`);
      console.log(`   file: ${failure.fileUrl}`);
      console.log(`   assertion: ${failure.assertion}`);
      console.log(`   error: ${failure.result}`);
    });
  }

  if (failed > 0) {
    process.exitCode = 1;
  }

  return { total, passed, failed };
}

export const tester = {
  describe,
  it,
  test,
  beforeEach,
  expect,
  fn,
  run,
};