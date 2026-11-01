import { createServer } from "node:http";
import { readFile, stat, watch } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const host = process.env.HR_DEV_HOST || "127.0.0.1";
const port = Number(process.env.HR_DEV_PORT || 4173);
const root = resolve("apps/hr-web");
const reloadClients = new Set();

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

const developmentScripts = `
<script>
(() => {
  const events = new EventSource("/__dev_reload");
  events.onmessage = event => {
    if (event.data === "reload") location.reload();
  };

  const preview = new URLSearchParams(location.search).get("preview") === "1" &&
    ["127.0.0.1", "localhost"].includes(location.hostname);
  if (!preview) return;

  addEventListener("DOMContentLoaded", () => {
    const gate = document.getElementById("hr-login");
    const shell = document.querySelector(".app-shell");
    const banner = document.getElementById("system-banner");
    if (gate) gate.hidden = true;
    if (shell) shell.inert = false;
    if (banner) {
      banner.textContent = "LOCAL UI PREVIEW · ไม่ได้เชื่อมบัญชี HR และจะไม่เขียนข้อมูลจริง";
      banner.setAttribute("role", "status");
    }
    document.documentElement.dataset.localPreview = "true";
  }, { once: true });
})();
</script>`;

function safeFilePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const requested = resolve(root, `.${decoded === "/" ? "/index.html" : decoded}`);
  const fromRoot = relative(root, requested);
  if (fromRoot === "" || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== "..")) return requested;
  return null;
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${host}:${port}`);

  if (url.pathname === "/__dev_reload") {
    response.writeHead(200, {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    });
    response.write(": connected\n\n");
    reloadClients.add(response);
    request.on("close", () => reloadClients.delete(response));
    return;
  }

  // The production HttpOnly session handler only accepts HTTPS Vercel origins.
  // Keep local UI development fail-closed instead of imitating production auth.
  if (url.pathname === "/api/hr-session") {
    sendJson(response, 401, { error: "local_dev_session_disabled" });
    return;
  }

  if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  const requested = safeFilePath(url.pathname);
  if (!requested) {
    sendJson(response, 403, { error: "path_forbidden" });
    return;
  }

  try {
    let filePath = requested;
    if ((await stat(filePath)).isDirectory()) filePath = resolve(filePath, "index.html");
    let body = await readFile(filePath);
    const extension = extname(filePath).toLowerCase();
    if (extension === ".html") {
      const html = body.toString("utf8");
      body = Buffer.from(html.includes("</body>")
        ? html.replace("</body>", `${developmentScripts}</body>`)
        : `${html}${developmentScripts}`);
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes.get(extension) || "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    if (error?.code === "ENOENT") sendJson(response, 404, { error: "not_found" });
    else {
      console.error(error);
      sendJson(response, 500, { error: "local_dev_server_error" });
    }
  }
});

let reloadTimer;
const watcher = watch(root, { recursive: true });
(async () => {
  for await (const event of watcher) {
    if (!event.filename) continue;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      for (const client of reloadClients) client.write("data: reload\n\n");
    }, 80);
  }
})().catch(error => console.error("File watcher stopped:", error));

server.listen(port, host, () => {
  console.log(`HR Web:        http://${host}:${port}/`);
  console.log(`UI preview:   http://${host}:${port}/?preview=1`);
  console.log("Watching apps/hr-web for changes. Press Ctrl+C to stop.");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    watcher.close();
    for (const client of reloadClients) client.end();
    server.close(() => process.exit(0));
  });
}
