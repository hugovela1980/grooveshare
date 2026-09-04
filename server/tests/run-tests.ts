import "./projects-json-store.test.js";
import "./tracks-json-store.test.js";
import "./playback-derivative-generator.test.js";
import "./upload-paths.test.js";
import "./multipart-form-data.test.js";
import "./upload-validation.test.js";
import "./project-api-routes.test.js";
import "./project-membership-api-routes.test.js";
import "./project-role-api-routes.test.js";
import "./authorization-integration.test.js";
import "./projects-postgres-store.test.js";
import "./tracks-postgres-store.test.js";
import "./users-postgres-store.test.js";
import "./password.test.js";
import "./auth-api-routes.test.js";
import "./sessions-postgres-store.test.js";
import "./project-memberships-postgres-store.test.js";
import "./project-invitation.test.js";
import "./project-invitation-api-routes.test.js";
import "./project-invitations-postgres-store.test.js";
import "./migration-behavior.test.js";
import "./reset-development-data.test.js";
import "./server-config.test.js";

import { tester } from "./test-runner/tester.js";
import { closePostgresTestDatabase } from "./db/postgres-test-db.js";

process.env.NODE_ENV = "test";

try {
    await tester.run();
} finally {
    await closePostgresTestDatabase();
}
