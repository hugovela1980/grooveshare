import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const repoRoot = process.cwd();
const failures = [];

function listFiles(root) {
  if (!existsSync(root)) return [];

  const files = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...listFiles(path));
    } else if (/\.(?:ts|tsx|js|mjs)$/.test(entry)) {
      files.push(path);
    }
  }
  return files;
}

function repoPath(path) {
  return relative(repoRoot, path).split(sep).join("/");
}

function fail(path, message) {
  failures.push(`${repoPath(path)}: ${message}`);
}

function importedSpecifiers(source) {
  const specifiers = [];
  const importPattern = /(?:from\s+|import\s*)["']([^"']+)["']/g;
  for (const match of source.matchAll(importPattern)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

const clientFiles = listFiles(join(repoRoot, "client", "src"));
const mobileFiles = listFiles(join(repoRoot, "mobile-client", "src"));
const coreFiles = listFiles(join(repoRoot, "packages", "frontend-core", "src"));
const browserFiles = listFiles(join(repoRoot, "packages", "frontend-browser", "src"));

for (const path of clientFiles) {
  const source = readFileSync(path, "utf8");
  for (const specifier of importedSpecifiers(source)) {
    if (specifier.includes("mobile-client")) {
      fail(path, `desktop presentation imports mobile presentation: ${specifier}`);
    }
  }
}

for (const path of mobileFiles) {
  const source = readFileSync(path, "utf8");
  for (const specifier of importedSpecifiers(source)) {
    if (specifier.includes("client/") || specifier.endsWith("/client")) {
      fail(path, `mobile presentation imports desktop presentation: ${specifier}`);
    }
  }
}

for (const path of coreFiles) {
  const source = readFileSync(path, "utf8");

  for (const specifier of importedSpecifiers(source)) {
    if (
      specifier.includes("client/") ||
      specifier.includes("mobile-client") ||
      specifier.includes("@hugovela/frontend-browser") ||
      specifier.endsWith(".css")
    ) {
      fail(path, `frontend-core depends on a presentation/browser layer: ${specifier}`);
    }
  }

  const presentationAssumptions = [
    ["document.", "document DOM access"],
    ["window.", "window DOM access"],
    [".querySelector(", "DOM querying"],
    [".innerHTML", "HTML rendering"],
    [".classList", "CSS class manipulation"],
    ["CSSStyleDeclaration", "styling API"],
  ];

  for (const [token, label] of presentationAssumptions) {
    if (source.includes(token)) {
      fail(path, `frontend-core contains ${label}`);
    }
  }
}

for (const path of browserFiles) {
  const source = readFileSync(path, "utf8");
  for (const specifier of importedSpecifiers(source)) {
    if (specifier.includes("client/") || specifier.includes("mobile-client")) {
      fail(path, `frontend-browser imports a presentation client: ${specifier}`);
    }
  }
}

const obsoleteCompatibilityFiles = [
  "client/src/api/api-client.ts",
  "client/src/api/projects-api.ts",
  "client/src/router/app-router.ts",
  "mobile-client/src/api/api-client.ts",
  "mobile-client/src/api/projects-api.ts",
  "mobile-client/src/router/app-router.ts",
];

for (const path of obsoleteCompatibilityFiles) {
  const absolutePath = join(repoRoot, ...path.split("/"));
  if (existsSync(absolutePath)) {
    fail(absolutePath, "obsolete shared-layer compatibility seam still exists");
  }
}

if (failures.length > 0) {
  console.error("Frontend architecture boundary check failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("Frontend architecture boundaries are valid.");
  console.log("- desktop and mobile presentations do not import each other");
  console.log("- frontend-core does not depend on presentation/browser packages");
  console.log("- frontend-core contains no page DOM or styling operations");
  console.log("- frontend-browser does not depend on either presentation client");
  console.log("- obsolete API/router compatibility seams are removed");
}
