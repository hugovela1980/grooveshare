import http, {type IncomingMessage, type ServerResponse } from "node:http";

const PORT = 3000;
const CLIENT_ORIGIN = "http://localhost:5173";

type JsonResponse = Record<string, unknown>;

function sendJson (
  res: ServerResponse,
  statusCode: number,
  data: JsonResponse,
): void {
  const json = JSON.stringify(data);

  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": CLIENT_ORIGIN,
  });
  
  res.end(json);
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
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
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`GrooveShare API running at http://localhost:${PORT}`);
});