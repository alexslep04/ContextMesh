import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export interface CodexLaunch {
  command: string;
  args: string[];
  source: string;
}

interface DiscoveryOptions {
  env?: NodeJS.ProcessEnv;
  home?: string;
  platform?: NodeJS.Platform;
  architecture?: string;
}

function isFile(path: string): boolean {
  try { return statSync(path).isFile(); } catch { return false; }
}

function launchFile(path: string, source: string): CodexLaunch | undefined {
  if (!isFile(path)) return undefined;
  if (/\.[cm]?js$/i.test(path)) return { command: process.execPath, args: [resolve(path)], source };
  if (/\.(cmd|bat|ps1)$/i.test(path)) {
    // An npm Windows shim cannot be spawned as a native executable. Launch its
    // installed Node entry point with an argument array, without invoking a shell.
    const entry = join(path, "..", "node_modules", "@openai", "codex", "bin", "codex.js");
    return isFile(entry) ? { command: process.execPath, args: [resolve(entry)], source } : undefined;
  }
  return { command: resolve(path), args: [], source };
}

export function resolveCodexLaunch(options: DiscoveryOptions = {}): CodexLaunch {
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();
  const platform = options.platform ?? process.platform;
  const architecture = options.architecture ?? process.arch;
  const binary = platform === "win32" ? "codex.exe" : "codex";
  if (env.CONTEXTMESH_CODEX) {
    if (!isAbsolute(env.CONTEXTMESH_CODEX)) throw new Error("CONTEXTMESH_CODEX must be an absolute path to Codex");
    const found = launchFile(env.CONTEXTMESH_CODEX, "CONTEXTMESH_CODEX");
    if (!found) throw new Error("CONTEXTMESH_CODEX does not name a usable executable or installed Codex Node entry point: " + env.CONTEXTMESH_CODEX);
    return found;
  }

  const pathEntries = (env.PATH ?? env.Path ?? "").split(platform === "win32" ? ";" : ":").filter(Boolean).map(path => path.replace(/^"(.*)"$/, "$1"));
  for (const path of pathEntries) {
    const native = launchFile(join(path, binary), "PATH");
    if (native) return native;
    const npm = launchFile(join(path, "node_modules", "@openai", "codex", "bin", "codex.js"), "npm on PATH");
    if (npm) return npm;
  }

  const installDirectory = env.CODEX_INSTALL_DIR ?? (platform === "win32"
    ? join(env.LOCALAPPDATA ?? join(home, "AppData", "Local"), "Programs", "OpenAI", "Codex", "bin")
    : join(home, ".local", "bin"));
  const standalone = launchFile(join(installDirectory, binary), "standalone installation");
  if (standalone) return standalone;
  if (platform === "win32") {
    const npm = launchFile(join(env.APPDATA ?? join(home, "AppData", "Roaming"), "npm", "node_modules", "@openai", "codex", "bin", "codex.js"), "npm installation");
    if (npm) return npm;
    // The desktop app injects its bundled CLI into its own PATH. An ordinary
    // PowerShell window may not inherit that PATH; use the same installed CLI.
    const desktopBin = join(env.LOCALAPPDATA ?? join(home, "AppData", "Local"), "OpenAI", "Codex", "bin");
    let installations: string[] = [];
    try {
      installations = readdirSync(desktopBin, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => join(desktopBin, entry.name));
      installations.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs || b.localeCompare(a));
    } catch { /* Desktop installation is optional; continue with other hosts. */ }
    for (const directory of [desktopBin, ...installations]) {
      const desktop = launchFile(join(directory, binary), "Codex desktop app");
      if (desktop) return desktop;
    }
  }

  const platformDirectory = ({ win32: "windows", linux: "linux", darwin: "macos" } as Partial<Record<NodeJS.Platform, string>>)[platform];
  const architectureDirectory = architecture === "arm64" ? "aarch64" : "x86_64";
  for (const editor of [".vscode", ".vscode-insiders", ".vscode-oss"]) {
    const extensions = join(home, editor, "extensions");
    let versions: string[];
    try { versions = readdirSync(extensions).filter(name => name.startsWith("openai.chatgpt-")).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })); }
    catch { continue; }
    for (const version of versions) {
      const bin = join(extensions, version, "bin");
      const candidates = platformDirectory ? [join(bin, platformDirectory + "-" + architectureDirectory, binary), join(bin, binary)] : [];
      for (const candidate of candidates) {
        const found = launchFile(candidate, "VS Code extension " + version);
        if (found) return found;
      }
    }
  }
  throw new Error("Codex was not found on PATH, in its standard/desktop installation locations, or in the VS Code extension. Set CONTEXTMESH_CODEX to its full executable path or install the Codex CLI. See docs/codex.md.");
}

export function codexLauncherSource(launch: CodexLaunch, args?: string[]): string {
  // Resolve before generating scripts: Terminal 2 may have a different PATH.
  const argumentsExpression = args ? JSON.stringify([...launch.args, ...args]) : JSON.stringify(launch.args) + ".concat(process.argv.slice(2))";
  return "import { spawn } from 'node:child_process';\nconst child = spawn(" + JSON.stringify(launch.command) + ", " + argumentsExpression + ", { stdio: 'inherit', windowsHide: true });\nchild.on('error', error => { console.error('Cannot launch the resolved Codex executable: ' + error.message + '. Regenerate the connection scripts to rediscover it, or set CONTEXTMESH_CODEX.'); process.exitCode = 1; });\nchild.on('exit', (code, signal) => { process.exitCode = code ?? 1; if (signal) console.error('Codex stopped: ' + signal); });\n";
}
