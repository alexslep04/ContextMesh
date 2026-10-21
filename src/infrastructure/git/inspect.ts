import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import type { GitEvidence } from "../../domain/entities.js";
import { ApplicationError } from "../../domain/errors.js";
const execute = promisify(execFile);
async function git(path: string, args: string[]): Promise<string> {
  const { stdout } = await execute("git", ["-C", path, ...args], { encoding: "utf8", timeout: 5000, maxBuffer: 8 * 1024 * 1024, windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
  return stdout;
}
export async function gitVersion(): Promise<string> {
  const { stdout } = await execute("git", ["--version"], { encoding: "utf8", timeout: 5000, windowsHide: true });
  return stdout.trim();
}
export async function inspectRepository(projectId: string, repositoryPath: string): Promise<GitEvidence> {
  try {
    const worktreePath = (await git(resolve(repositoryPath), ["rev-parse", "--show-toplevel"])).trim();
    const commonDirectory = resolve(worktreePath, (await git(worktreePath, ["rev-parse", "--git-common-dir"])).trim());
    let branch: string | null = null, head: string | null = null;
    try { branch = (await git(worktreePath, ["symbolic-ref", "--quiet", "--short", "HEAD"])).trim(); }
    catch (error) { if ((error as { code?: number }).code !== 1) throw error; }
    try { head = (await git(worktreePath, ["rev-parse", "--verify", "HEAD"])).trim(); }
    catch (error) { if ((error as { code?: number }).code !== 128) throw error; }
    const entries = (await git(worktreePath, ["status", "--porcelain=v1", "-z", "--untracked-files=all"])).split("\0");
    const files: GitEvidence["files"] = [];
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]; if (!entry) continue;
      const status = entry.slice(0, 2), path = entry.slice(3).replaceAll("\\", "/");
      const untracked = status === "??";
      files.push({ path, untracked, staged: !untracked && status[0] !== " ", unstaged: !untracked && status[1] !== " " });
      if (/[RC]/.test(status)) index++; // -z rename records include a second, original path.
    }
    return { projectId, repositoryPath: resolve(repositoryPath), worktreePath, commonDirectory, branch, head, source: "git", observedAt: new Date().toISOString(), files: files.sort((a, b) => a.path.localeCompare(b.path)) };
  } catch {
    throw new ApplicationError("git_inspection_failed", "Git inspection failed. Check that Git is installed and the registered repository path exists and is a Git worktree.", 503);
  }
}
