import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";

// A fixture preview, not a dashboard or a general-purpose file server.
export async function serveSnake(repositoryPath: string, port = 0) {
  const root = await realpath(resolve(repositoryPath));
  const routes: Record<string, [string, string]> = {
    "/": ["index.html", "text/html; charset=utf-8"],
    "/index.html": ["index.html", "text/html; charset=utf-8"],
    "/app.js": ["app.js", "text/javascript; charset=utf-8"],
    "/snake.js": ["snake.js", "text/javascript; charset=utf-8"],
  };
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (!["GET", "HEAD"].includes(request.method ?? "")) { response.writeHead(405, { Allow: "GET, HEAD" }).end(); return; }
    const pathname = (request.url ?? "/").split("?")[0];
    const route = Object.hasOwn(routes, pathname) ? routes[pathname] : undefined;
    if (!route) { response.writeHead(404).end("Not found"); return; }
    try {
      const path = await realpath(join(root, route[0]));
      if (dirname(path) !== root) { response.writeHead(404).end("Not found"); return; }
      const body = await readFile(path);
      response.writeHead(200, { "Content-Type": route[1], "Content-Length": body.length });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch { response.writeHead(404).end("Not found"); }
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  const url = "http://127.0.0.1:" + (server.address() as { port: number }).port;
  return { url, stop: () => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections(); }) };
}

export async function presentSnake(repositoryPath: string) {
  const preview = await serveSnake(repositoryPath);
  console.log("\nPLAY SNAKE: " + preview.url + "\nOpen this URL in your browser. Start/Pause, arrows or WASD, Restart. Ctrl+C stops the preview.");
  await new Promise<void>((resolve, reject) => {
    const stop = () => { process.off("SIGINT", stop); process.off("SIGTERM", stop); void preview.stop().then(resolve, reject); };
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
  });
}
