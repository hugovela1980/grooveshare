import "./test-runner/tester.test.js";
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
import "./confirm-project-page-controller.test.js";
import "./tracks-api.test.js";
import "./projects-api.test.js";
import { tester } from "./test-runner/tester.js";

await tester.run();