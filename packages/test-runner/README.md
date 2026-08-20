# @hugovela/test-runner

`@hugovela/test-runner` is GrooveShare's small internal TypeScript test framework.

It exists to provide the repository with a simple, understandable test API and consistent console output without adding a larger external test framework. It is a private npm workspace package and is not intended as a general-purpose published testing library.

## Package API

The package exports one factory:

```ts
import { createTester } from "@hugovela/test-runner";

const tester = createTester();
```

Each tester instance provides:

- `describe(name, callback)` — define a test suite.
- `it(name, callback)` — define a test case.
- `test(name, callback)` — alias for `it`.
- `beforeEach(callback)` — run setup before every test in the current suite.
- `expect(actual)` — create an assertion object.
- `fn(implementation?)` — create a small mock function that records calls.
- `run()` — run all registered suites and return `{ total, passed, failed }`.

Test and `beforeEach` callbacks may be synchronous or asynchronous.

## Basic example

```ts
import { createTester } from "@hugovela/test-runner";

const tester = createTester();

let value = 0;

tester.describe("counter", () => {
  tester.beforeEach(() => {
    value = 0;
  });

  tester.it("increments", () => {
    value += 1;

    tester.expect(value).toBe(1);
  });
});

await tester.run();
```

GrooveShare suites normally create one shared tester instance for a workspace and import test modules before calling `run()` from `tests/run-tests.ts`.

## Assertions

Current assertions are intentionally small:

```ts
tester.expect(value).toBe(expected);
tester.expect(value).toEqual(expected);
tester.expect(value).toBeTruthy();
tester.expect(value).toBeFalsy();
tester.expect(mock).toHaveBeenCalled();
tester.expect(mock).toHaveBeenCalledTimes(count);
tester.expect(mock).toHaveBeenCalledWith(...args);
```

### `toBe`

Uses strict identity/equality (`!==`) semantics.

### `toEqual`

Uses the runner's simple deep-comparison implementation based on JSON serialization. It is suitable for the plain data structures used in the current GrooveShare tests, but it is not intended to duplicate the edge-case behavior of a mature assertion library.

## Mock functions

Create a mock with:

```ts
const callback = tester.fn();

callback("project-a", { force: true });
```

Recorded arguments are available through:

```ts
callback.calls
```

Clear recorded calls with:

```ts
callback.mockClear();
```

A custom implementation can be supplied:

```ts
const add = tester.fn((a, b) => Number(a) + Number(b));
```

## Output and failures

Passing suites are collapsed to a single line:

```txt
✓ project permissions
```

If a suite fails, only failed tests are listed in the suite summary. The final failure details include the test name, source filename/URL when available, the assertion line, and a simplified result message.

The runner sets:

```ts
process.exitCode = 1;
```

when any test fails, allowing npm scripts and the root verification gate to fail normally.

`run()` returns:

```ts
{
  total,
  passed,
  failed,
}
```

## Using the runner in a workspace

A workspace typically has a helper such as:

```ts
// tests/test-runner/tester.ts
import { createTester } from "@hugovela/test-runner";

export const tester = createTester();
```

Individual test files import that shared instance and register suites. The workspace `tests/run-tests.ts` imports all test modules, then runs the tester:

```ts
import "./some-feature.test.js";
import "./another-feature.test.js";

import { tester } from "./test-runner/tester.js";

await tester.run();
```

This keeps test discovery explicit and easy to inspect.

## Package development

From the repository root:

```bash
npm test -w @hugovela/test-runner
npm run typecheck -w @hugovela/test-runner
```

Or use the root convenience command:

```bash
npm run test-runner
```

The package's own tests cover mock call tracking/clearing and console-output behavior.

The complete repository gate also runs this package:

```bash
npm run verify
```

## Intentional limitations

The runner is deliberately minimal. It currently does not try to provide:

- automatic test-file discovery;
- parallel test execution;
- `afterEach` / `beforeAll` / `afterAll` hooks;
- snapshots;
- fake timers;
- module mocking;
- browser test environments;
- the large matcher surface of Jest/Vitest;
- sophisticated deep-equality semantics.

If GrooveShare eventually needs those capabilities, the project can either extend this package deliberately or migrate to a larger framework. For the current repository, keeping the runner small makes the tests and failure output easy to understand.
