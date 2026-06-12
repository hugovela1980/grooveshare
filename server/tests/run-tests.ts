import "./test-runner/tester.test.js";
import "./projects-json-store.test.js";
import "./tracks-json-store.test.js";
import "./project-api-routes.test.js";
import { tester } from "./test-runner/tester.js";

await tester.run();