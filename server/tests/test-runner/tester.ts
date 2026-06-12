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
  const failures: Array<{ suite: string; test: string; error: string }> = [];

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

        const errorMessage = error instanceof Error ? error.message : String(error);

        failures.push({
          suite: suite.name,
          test: testCase.name,
          error: errorMessage,
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
      console.log(` it: ${failure.test}`);
      console.log(` error: ${failure.error}`);
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