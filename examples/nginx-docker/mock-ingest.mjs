import { createServer } from "node:http";

const port = Number.parseInt(process.env.MOCK_INGEST_PORT ?? "8787", 10);

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

const server = createServer(async (request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok\n");
    return;
  }

  if (request.method !== "POST") {
    response.writeHead(405, { "content-type": "text/plain" });
    response.end("method not allowed\n");
    return;
  }

  const body = await readBody(request);
  const payload = JSON.parse(body);
  console.log(
    "mock ingest received",
    JSON.stringify(
      {
        path: request.url,
        authorization: request.headers.authorization,
        siteId: request.headers["x-promptscout-site-id"],
        events: payload.events?.map((event) => ({
          provider: event.providerClassification.provider,
          path: event.request.path,
          userAgent: event.request.userAgent,
        })),
      },
      null,
      2,
    ),
  );

  response.writeHead(202, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`mock ingest listening on ${port}`);
});
