import "./browser-adapters.test.js";
import "./browser-microphone-recording-adapter.test.js";
import "./app-router.test.js";

import "./browser-grooveshare-app.test.js";
import { tester } from "./test-runner/tester.js";

await tester.run();
