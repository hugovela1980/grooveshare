import { createGrooveShareApp } from "./app.js";
import { clientConfig } from "./config/client-config.js";
import { mountDevToolbar } from "./dev/dev-toolbar.js";
import "./css/main.css";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("Could not find #app element");
}

const app = createGrooveShareApp({
  appElement,
});

void app.start();

if (clientConfig.isDevelopment) {
  mountDevToolbar({
    visibleByDefault: false,
    enabledByDefault: true,
  });
}