import { createAppServer } from "./app.js";
import { projectsJsonStore } from "./stores/projects-json-store.js";

const PORT = 3000;

const server = createAppServer({
  projectsStore: projectsJsonStore,
});

server.listen(PORT, () => {
  console.log(`GrooveShare API running at http://localhost:${PORT}`);
});