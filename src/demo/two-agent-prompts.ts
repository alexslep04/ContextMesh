import { snakeContract } from "./snake-fixture.js";
export function twoAgentPrompt(role: "a" | "b", projectId: string, repositoryPath: string, operatorEdit: boolean): string {
  const sessionId = "codex-" + role;
  const common = `# Build Snake using ContextMesh
Work only in this disposable fixture. Both peers are real Codex sessions. Communicate through ContextMesh MCP only; never message the peer directly, read harness files or write its database. Keep this tiny: no dependencies, research, subagents or extra features. Use available native file tools or PowerShell, not assumptions about bash/apply_patch availability.
${JSON.stringify({ projectId, sessionId, repositoryPath })}
Use these identities on every tool. Every mutation needs requestId: new stable ID for new content, same ID only for an exact retry.
Register with requestId register-${role}, agentType codex, repositoryPath above. Retrieve get_project_context with your sessionId and budget 24000 before reporting work and at each checkpoint.
Poll missing context conditions for up to 240 seconds, spacing requests a few seconds. Never invent reports. If host execution is denied or tests fail, record_blocker with a distinct blockerId, explain and stop.
${operatorEdit ? "OPERATOR-EDIT MODE: never call shell/file tools. The harness makes labeled edits. Inspect Git via refresh_repository; never claim authorship or execution." : "Native mode: YOU write your assigned files and run your own tests. Do not modify package.json or CONTRACT.md."}
${snakeContract}
`;
  if (role === "a") return common + `
1. report_task requestId task-a, taskId snake-task, title Implement Snake game rules, expectedFiles [snake.js].
2. ${operatorEdit ? "The operator writes snake.js after your report." : "Implement snake.js according to CONTRACT.md. Smoke-test createGame and step using Node; B owns browser and tests."} refresh_repository until Git shows snake.js changed. save_progress_checkpoint requestId ready-a, memoryId snake-ready, taskId snake-task, content Snake engine is ready for coordination, relatedFiles [snake.js].
3. Wait for B's progress with taskId browser-task and summary starting 'Overlap acknowledged'. save_progress_checkpoint requestId overlap-a, memoryId overlap-seen-a, taskId snake-task, content Reviewed peer overlap acknowledgment, relatedFiles [snake.js].
4. Wait for B's blocker on browser-task; B will narrow scope. Do not edit its files.
5. record_decision requestId decision-a, memoryId snake-contract, taskId snake-task, decision Keep pure createGame and step functions separate from canvas controls, rationale Browser and tests consume the same rules without concurrent engine edits, relatedFiles [snake.js].
6. complete_task requestId complete-a, taskId snake-task, summary ${operatorEdit ? "Reviewed operator Snake engine" : "Implemented pure Snake engine"}, importantFiles [snake.js], decisions [Pure createGame and step exports], remainingIssues [], nextSteps [Import createGame and step into app.js; add canvas controls and movement growth collision tests]. Include actual exported signatures and state shape in summary for B.
7. end_session requestId end-a. Brief summary then stop tools; B retrieves your handoff independently.
`;
  return common + `
1. Wait for context containing A's active snake-task, Git evidence for snake.js and progress for snake-task. Read it before reporting.
2. report_task requestId task-b, taskId browser-task, title Build Snake browser and tests, expectedFiles [snake.js,index.html,app.js,tests/snake.test.mjs], dependencies [snake-task]. This intentional overlap must return a warning. Call get_conflicts AND get_project_context while present. save_progress_checkpoint requestId overlap-b, memoryId overlap-seen-b, taskId browser-task, content starting 'Overlap acknowledged' then the actual warning explanation, relatedFiles [snake.js].
3. Wait for A's progress summary Reviewed peer overlap acknowledgment. update_task requestId narrow-b, taskId browser-task, expectedFiles [index.html,app.js,tests/snake.test.mjs], reason Consume A's public engine instead of editing it. Verify get_conflicts is empty. record_blocker requestId block-b, blockerId waiting-for-snake, taskId browser-task, description Waiting for Snake engine completion handoff.
4. Wait for BOTH A's decision with rationale AND handoff for snake-task with nextSteps. Read them. save_progress_checkpoint requestId handoff-b, memoryId handoff-consumed-b, taskId browser-task, content describing the actual interface and next steps retrieved. resolve_blocker requestId unblock-b, blockerId waiting-for-snake, resolution Retrieved engine decision and handoff through ContextMesh.
5. ${operatorEdit ? "The operator writes index.html, app.js and tests/snake.test.mjs after resolution. Refresh Git until they appear; never claim writing or execution." : "Create index.html and app.js: a polished compact dark Snake game with mint snake, coral food, readable score/status, responsive canvas, Start/Pause and Restart, arrows/WASD preventing scrolling. Start paused; queue at most one legal turn per tick. Use exact DOM IDs and APIs in CONTRACT.md. Create at least seven deterministic tests/snake.test.mjs; run node --test --test-reporter=tap tests/snake.test.mjs. Do not edit snake.js; report a blocker if its contract is broken."} refresh_repository.
6. complete_task requestId complete-b, taskId browser-task, summary ${operatorEdit ? "Reviewed operator browser and tests using shared handoff" : "Built playable Snake browser and passed tests using shared handoff"}, importantFiles [index.html,app.js,tests/snake.test.mjs], decisions [Browser consumes pure engine], remainingIssues [], nextSteps [Open local preview; use arrows or WASD and demonstrate restart].
7. end_session requestId end-b. Brief summary then stop tools; harness verifies tests and restart retrieval.
`;
}
