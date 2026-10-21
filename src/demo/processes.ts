import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
export const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
export function nodeArguments(name: string): string[] {
  const source = import.meta.url.endsWith(".ts");
  const entry = fileURLToPath(new URL("../" + name + (source ? ".ts" : ".js"), import.meta.url));
  return source ? [fileURLToPath(new URL("../../node_modules/tsx/dist/cli.mjs", import.meta.url)), entry] : [entry];
}
export async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}
export async function waitFor<T>(check: () => Promise<T | undefined>, label: string, timeout = 15000, signal?: AbortSignal): Promise<T> {
  const deadline = Date.now() + timeout; let last: unknown;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    try { const value = await check(); if (value !== undefined) return value; } catch (error) { last = error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for " + label + (last instanceof Error ? ": " + last.message : ""));
}
export async function launchService(directory: string, port: number) {
  const env = { ...process.env, CONTEXTMESH_HOST: "127.0.0.1", CONTEXTMESH_PORT: String(port), CONTEXTMESH_DB: join(directory, "state.db"), LOG_LEVEL: "warn" };
  const logPath = join(directory, "service.log"), log = createWriteStream(logPath, { flags: "a" });
  const child: ChildProcess = spawn(process.execPath, nodeArguments("service"), { cwd: sourceRoot, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  child.stdout!.pipe(log, { end: false }); child.stderr!.pipe(log, { end: false });
  let failure: Error | undefined; child.on("error", error => { failure = error; });
  const exited = new Promise<void>(resolve => { child.once("exit", () => resolve()); child.once("error", () => resolve()); });
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null && !failure) {
      try { child.send("shutdown"); } catch { child.kill(); }
      await Promise.race([exited, new Promise<void>(resolve => { const timer = setTimeout(() => { child.kill(); resolve(); }, 5000); timer.unref(); })]);
      await exited;
    }
    await new Promise<void>(resolve => log.end(resolve));
  };
  try {
    await waitFor(async () => {
      if (failure || child.exitCode !== null) throw failure ?? new Error("Service exited: " + readFileSync(logPath, "utf8").slice(-1000));
      const response = await fetch("http://127.0.0.1:" + port + "/health", { signal: AbortSignal.timeout(500) });
      return response.ok ? true : undefined;
    }, "local service startup");
  } catch (error) { await stop(); throw error; }
  return { stop, env, pid: child.pid };
}
