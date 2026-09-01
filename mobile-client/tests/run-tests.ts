import "./microphone-recording-controller.test.js";
import "./audio-player-timeline.test.js";
import "./project-invitation-controller.test.js";
import "./mobile-guest-invitation.integration.test.js";
import "./mobile-app.integration.test.js";
import "./mobile-audio-file-picker.test.js";
import "./mobile-project-player.integration.test.js";

import "./project-actions-menu-controller.test.js";
import "./mobile-polish.test.js";

import { tester } from "./test-runner/tester.js";

await tester.run();
