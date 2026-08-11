import "./projects-json-store.test.js";
import "./tracks-json-store.test.js";
import "./upload-paths.test.js";
import "./multipart-form-data.test.js";
import "./project-api-routes.test.js";
import "./projects-postgres-store.test.js";
import { closePostgresTestDatabase } from "./db/postgres-test-db.js";
import { tester } from "./test-runner/tester.js";

try {
    await tester.run();
} finally {
    await closePostgresTestDatabase();
}