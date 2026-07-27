import "./test-runner/tester.test.js";
import "./project-controller.test.js";
import "./track-upload-controller.test.js";
import "./app-router.test.js";
import "./page-templates.test.js";
import "./grooveshare-app.test.js";
import "./create-project-page-controller.test.js";
import "./project-menu-page-controller.test.js";
import "./project-list-template.test.js";
import "./project-player-page-controller.test.js";
import "./project-draft-state.test.js";
import "./pending-track-list-template.test.js";
import "./pending-track-selection-controller.test.js";
import { tester } from "./test-runner/tester.js";

await tester.run();