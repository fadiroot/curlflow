// Tiny local server for smoke-testing curlflow without external network.
import http from "node:http";

let nextId = 1;
const users = new Map();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  let body = {};
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = {};
    }
  }

  const send = (status, payload, headers = {}) => {
    res.writeHead(status, {
      "content-type": "application/json",
      ...headers,
    });
    res.end(JSON.stringify(payload));
  };

  if (req.method === "POST" && url.pathname === "/auth/login") {
    if (body.email && body.password) {
      return send(200, {
        token: "test-token-abc",
        user: { id: 42, email: body.email, role: "admin" },
      });
    }
    return send(400, { error: "missing credentials" });
  }

  if (req.method === "POST" && url.pathname === "/users") {
    if (req.headers.authorization !== "Bearer test-token-abc") {
      return send(401, { error: "unauthorized" });
    }
    const id = nextId++;
    const u = { id, ...body };
    users.set(id, u);
    return send(201, u);
  }

  if (req.method === "GET" && url.pathname.startsWith("/users/")) {
    const id = Number(url.pathname.split("/")[2]);
    const u = users.get(id);
    if (!u) return send(404, { error: "not found" });
    return send(200, u);
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/users/")) {
    const id = Number(url.pathname.split("/")[2]);
    const u = users.get(id);
    if (!u) return send(404, { error: "not found" });
    Object.assign(u, body);
    return send(200, u);
  }

  send(404, { error: "no route" });
});

const port = Number(process.env.PORT ?? 4999);
server.listen(port, "127.0.0.1", () => {
  console.log(`local-server listening on http://127.0.0.1:${port}`);
});
