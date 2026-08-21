import "./microphone-recording-controller.test.js";
import "./auth-page-controller.test.js";
import "./async-state.test.js";
import "./loading-state-template.test.js";
import "./page-templates.test.js";
import "./grooveshare-app.test.js";
import "./desktop-project-player.integration.test.js";
import "./create-project-confirmation-controller.test.js";
import "./create-project-page-controller.test.js";
import "./project-menu-page-controller.test.js";
import "./project-list-template.test.js";
import "./project-player-page-controller.test.js";
import "./create-project-track-selection-controller.test.js";
import "./audio-player-template.test.js";
import "./audio-player-controller.test.js";
import "./mix-channel-slots-template.test.js";
import "./permission-aware-templates.test.js";
import "./viewer-mix-controller.test.js";
import "./project-members-controller.test.js";
import "./client-config.test.js";
import "./project-invitation-controller.test.js";
import "./project-actions-menu-controller.test.js";
import "./desktop-guest-invitation.integration.test.js";

import { tester } from "./test-runner/tester.js";

await tester.run();
