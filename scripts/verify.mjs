import { spawnSync } from "node:child_process";

const results = [];

function runStep(label, command) {
    console.log("\n");
    console.log("========================================");
    console.log(label);
    console.log("========================================");
    console.log(`$ ${command}`);
    console.log("");

    const result = spawnSync(command, {
        shell: true,
        stdio: "inherit",
    });

    const passed = result.status === 0;

    results.push({
        label,
        passed,
    });

    return passed;
}

runStep(
    "server configuration",
    "npm run config:check",
);

runStep(
    "database connection",
    "npm run db:check",
);

runStep(
    "typecheck - server",
    "npm run typecheck -w server",
);

runStep(
    "typecheck - frontend-core",
    "npm run typecheck -w @hugovela/frontend-core",
);

runStep(
    "typecheck - client",
    "npm run typecheck -w client",
);

runStep(
    "typecheck - mobile-client",
    "npm run typecheck -w mobile-client",
);

runStep(
    "typecheck - test-runner",
    "npm run typecheck -w @hugovela/test-runner",
);

runStep(
    "tests - server",
    "npm test -w server",
);

runStep(
    "tests - frontend-core",
    "npm test -w @hugovela/frontend-core",
);

runStep(
    "tests - client",
    "npm test -w client",
);

runStep(
    "tests - mobile-client",
    "npm test -w mobile-client",
);

runStep(
    "tests - test-runner",
    "npm test -w @hugovela/test-runner",
);

runStep(
    "build - server",
    "npm run build -w server",
);

runStep(
    "build - client",
    "npm run build -w client",
);

runStep(
    "build - mobile-client",
    "npm run build -w mobile-client",
);

const allPassed = results.every((result) => result.passed);

console.log("\n");
console.log("--------------------------------------------");
console.log("--------------------------------------------");
console.log("");
console.log("       GROOVESHARE VERIFY SUMMARY");
console.log("");
console.log(
    allPassed
        ? "               PASSED"
        : "        *******FAILED*******",
);
console.log("");

for (const result of results) {
    console.log(
        `${result.passed ? "✓" : "✗"} ${result.label}`,
    );
}

console.log("");
console.log("--------------------------------------------");
console.log("--------------------------------------------");

process.exitCode = allPassed ? 0 : 1;