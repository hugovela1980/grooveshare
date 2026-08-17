import "./mobile-app.integration.test.js";
import "./mobile-project-player.integration.test.js";

import "./project-actions-menu-controller.test.js";
import "./mobile-polish.test.js";

import { tester } from "./test-runner/tester.js";

await tester.run();
