import "./projects-json-store.test.js";
import "./tracks-json-store.test.js";
import "./upload-paths.test.js";
import "./multipart-form-data.test.js";
import "./project-api-routes.test.js";
import "./projects-postgres-store.test.js";
import "./tracks-postgres-store.test.js";
import "./users-postgres-store.test.js";
import "./password.test.js";
import "./auth-api-routes.test.js";
import "./sessions-postgres-store.test.js";
import "./project-memberships-postgres-store.test.js";

import { tester } from "./test-runner/tester.js";
import { closePostgresTestDatabase } from "./db/postgres-test-db.js";

try {
    await tester.run();
} finally {
    await closePostgresTestDatabase();
}