import "./browser-recording-alignment-diagnostics.test.js";
import "./browser-adapters.test.js";
import "./browser-microphone-recording-adapter.test.js";
import "./browser-microphone-pcm-alignment-monitor.test.js";
import "./browser-recorded-take-playback-adapter.test.js";
import "./browser-recorded-take-upload-adapter.test.js";
import "./app-router.test.js";

import "./browser-grooveshare-app.test.js";
import { tester } from "./test-runner/tester.js";

await tester.run();
