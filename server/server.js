import http from "node:http";

const PORT = 3000;
const CLIENT_ORIGIN = "http://localhost:5173";

function sendJson(res, statusCode, data) {
  const json = JSON.stringify(data);

  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": CLIENT_ORIGIN,
  });

  res.end(json);
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      app: "GrooveShare API",
      message: "Server is healthy",
    });

    return;
  }

  sendJson(res, 404, {
    ok: false,
    error: "Not found",
  });
});

server.listen(PORT, () => {
  console.log(`GrooveShare API running at http://localhost:${PORT}`);
});