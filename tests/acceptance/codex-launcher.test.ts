import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { codexLauncherSource, resolveCodexLaunch } from "../../src/demo/codex.js";
import { temporaryDirectory } from "../helpers.js";

function file(path: string, content = "") {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return path;
}

describe("live demo Codex discovery and launch", () => {
  it("finds the newest installed VS Code binary when Codex is absent from PATH", () => {
    const temp = temporaryDirectory();
    try {
      const extensions = join(temp.path, ".vscode", "extensions");
      file(join(extensions, "openai.chatgpt-1.9", "bin", "windows-x86_64", "codex.exe"));
      const expected = file(join(extensions, "openai.chatgpt-1.10", "bin", "windows-x86_64", "codex.exe"));
      const found = resolveCodexLaunch({ env: { PATH: "" }, home: temp.path, platform: "win32", architecture: "x64" });
      expect(found.command).toBe(expected);
      expect(found.args).toEqual([]);
      expect(found.source).toContain("VS Code extension");
    } finally { temp.remove(); }
  });

  it("prefers an explicit path and rejects an invalid override without silently switching installations", () => {
    const temp = temporaryDirectory();
    try {
      const binary = file(join(temp.path, "custom install", "codex.exe"));
      expect(resolveCodexLaunch({ env: { CONTEXTMESH_CODEX: binary }, home: temp.path }).command).toBe(binary);
      expect(() => resolveCodexLaunch({ env: { CONTEXTMESH_CODEX: join(temp.path, "missing.exe") }, home: temp.path })).toThrow("CONTEXTMESH_CODEX");
      expect(() => resolveCodexLaunch({ env: { CONTEXTMESH_CODEX: "relative.exe" }, home: temp.path })).toThrow("absolute");
    } finally { temp.remove(); }
  });

  it("finds the desktop-bundled CLI from an external terminal with no Codex on PATH", () => {
    const temp = temporaryDirectory();
    try {
      const local = join(temp.path, "AppData", "Local");
      const expected = file(join(local, "OpenAI", "Codex", "bin", "installed-build", "codex.exe"));
      const found = resolveCodexLaunch({ env: { PATH: "", LOCALAPPDATA: local }, home: temp.path, platform: "win32" });
      expect(found).toMatchObject({ command: expected, source: "Codex desktop app" });
    } finally { temp.remove(); }
  });

  it("supports npm Node entry points without trying to spawn a Windows cmd shim", () => {
    const temp = temporaryDirectory();
    try {
      const bin = join(temp.path, "npm");
      const shim = file(join(bin, "codex.cmd"));
      const entry = file(join(bin, "node_modules", "@openai", "codex", "bin", "codex.js"));
      const found = resolveCodexLaunch({ env: { PATH: bin }, home: temp.path, platform: "win32" });
      expect(found).toMatchObject({ command: process.execPath, args: [entry] });
      expect(resolveCodexLaunch({ env: { CONTEXTMESH_CODEX: shim }, home: temp.path }).args).toEqual([entry]);
    } finally { temp.remove(); }
  });

  it("reports a missing installation with an actionable error", () => {
    const temp = temporaryDirectory();
    try { expect(() => resolveCodexLaunch({ env: { PATH: "" }, home: temp.path, platform: "win32" })).toThrow("Set CONTEXTMESH_CODEX"); }
    finally { temp.remove(); }
  });

  it("runs a generated launcher with empty PATH while preserving spaces and embedded TOML quotes", async () => {
    const temp = temporaryDirectory();
    try {
      const entry = file(join(temp.path, "fake CLI with spaces", "codex.mjs"), "console.log(JSON.stringify(process.argv.slice(2)));\n");
      const launch = { command: process.execPath, args: [entry], source: "test" };
      const args = ["exec", "-c", 'mcp_servers.contextmesh={command="C:/Program Files/nodejs/node.exe"}', "a prompt with spaces and 'quotes'"];
      const launcher = file(join(temp.path, "start-agent.mjs"), codexLauncherSource(launch, args));
      const env = { ...process.env, PATH: "", Path: "" };
      const response = await promisify(execFile)(process.execPath, [launcher], { env, windowsHide: true, timeout: 5000 });
      expect(JSON.parse(response.stdout)).toEqual(args);
      file(launcher, codexLauncherSource(launch));
      const check = await promisify(execFile)(process.execPath, [launcher, "login", "status"], { env, windowsHide: true, timeout: 5000 });
      expect(JSON.parse(check.stdout)).toEqual(["login", "status"]);
    } finally { temp.remove(); }
  });

  it("propagates the CLI's failure status instead of reporting launcher success", async () => {
    const temp = temporaryDirectory();
    try {
      const entry = file(join(temp.path, "codex.mjs"), "process.exit(7);\n");
      const launcher = file(join(temp.path, "start-agent.mjs"), codexLauncherSource({ command: process.execPath, args: [entry], source: "test" }, []));
      await expect(promisify(execFile)(process.execPath, [launcher], { windowsHide: true, timeout: 5000 })).rejects.toMatchObject({ code: 7 });
    } finally { temp.remove(); }
  });
});
