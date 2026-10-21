import { describe, it, expect } from "vitest";
import { writeFileSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { inspectRepository } from "../../src/infrastructure/git/inspect.js";
import { temporaryDirectory, fixtureRepository, git } from "../helpers.js";
describe("Git evidence", () => {
  it("detects staged, unstaged, untracked and renamed paths with spaces", async () => {
    const temp = temporaryDirectory();
    try {
      fixtureRepository(temp.path);
      writeFileSync(join(temp.path, "src/auth.ts"), "changed\n"); git(temp.path, "add", "src/auth.ts");
      writeFileSync(join(temp.path, "src/auth.ts"), "changed again\n");
      writeFileSync(join(temp.path, "file with spaces.txt"), "new\n");
      const evidence = await inspectRepository("p", temp.path);
      expect(evidence.source).toBe("git"); expect(evidence.head).toBeTruthy(); expect(evidence.branch).toBeTruthy();
      expect(evidence.files).toContainEqual({ path: "src/auth.ts", staged: true, unstaged: true, untracked: false });
      expect(evidence.files).toContainEqual({ path: "file with spaces.txt", staged: false, unstaged: false, untracked: true });
      git(temp.path, "add", "."); git(temp.path, "commit", "-m", "Changes");
      renameSync(join(temp.path, "file with spaces.txt"), join(temp.path, "renamed file.txt")); git(temp.path, "add", ".");
      expect((await inspectRepository("p", temp.path)).files.map(f => f.path)).toContain("renamed file.txt");
    } finally { temp.remove(); }
  });
  it("distinguishes linked worktrees and detached HEAD without attributing edits", async () => {
    const temp = temporaryDirectory();
    try {
      const main = join(temp.path, "main"), peer = join(temp.path, "peer"); mkdirSync(main); fixtureRepository(main);
      git(main, "worktree", "add", "-b", "peer", peer);
      const a = await inspectRepository("p", main), b = await inspectRepository("p", peer);
      expect(a.commonDirectory).toBe(b.commonDirectory); expect(a.worktreePath).not.toBe(b.worktreePath);
      git(peer, "checkout", "--detach"); expect((await inspectRepository("p", peer)).branch).toBeNull();
    } finally { temp.remove(); }
  });
  it("returns actionable failures for non-Git and missing paths", async () => {
    const temp = temporaryDirectory();
    try { await expect(inspectRepository("p", temp.path)).rejects.toMatchObject({ code: "git_inspection_failed" }); await expect(inspectRepository("p", join(temp.path, "missing"))).rejects.toMatchObject({ statusCode: 503 }); }
    finally { temp.remove(); }
  });
});
