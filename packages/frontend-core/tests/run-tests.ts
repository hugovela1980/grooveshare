import "./application-contracts.test.js";
import "./invitation-guest-workflow.test.js";
import "./project-permissions.test.js";
import "./html-audio-playback-engine.test.js";
import "./web-audio-playback-engine.test.js";
import "./mix-persistence.test.js";

import "./frontend-services.test.js";

import "./guest-mix-storage.test.js";

import { tester } from "./test-runner/tester.js";

await tester.run();
