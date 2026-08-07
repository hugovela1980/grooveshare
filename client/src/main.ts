import { createGrooveShareApp } from "./app.js";
import { mountDevToolbar } from "./dev/dev-toolbar.js";
import "./css/main.css";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("Could not find #app element");
}

const app = createGrooveShareApp({
  appElement,
});

app.start();

mountDevToolbar();