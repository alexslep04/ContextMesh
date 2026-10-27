import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);

export async function verifyFixture(repositoryPath: string): Promise<string> {
  const options = { cwd: repositoryPath, windowsHide: true, timeout: 10000 };
  const result = await execute(process.execPath, ["--experimental-strip-types", "--test", "--test-reporter=tap", "tests/auth.test.mjs"], options);
  assert.match(result.stdout, /# fail 0/);
  assert(Number(result.stdout.match(/# tests (\d+)/)?.[1]) >= 3, "Expected at least three actual fixture tests");
  assert.match(result.stdout, /# skipped 0/);
  // Check the contract independently of whatever tests the peer wrote.
  await execute(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", "import assert from 'node:assert/strict'; import { authenticate } from './src/auth.ts'; assert.equal(authenticate('demo-token'), true); assert.equal(authenticate('wrong-token'), false); assert.equal(authenticate(''), false);"], options);
  return result.stdout;
}
