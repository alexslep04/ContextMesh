import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
const execute = promisify(execFile);
// Independent of B's tests: a green but vacuous suite cannot prove the game.
const contractCheck = String.raw`
import assert from 'node:assert/strict';
import { createGame, step } from './snake.js';
const s = createGame(), before = JSON.stringify(s);
assert.equal(s.width,20); assert.equal(s.height,20); assert.equal(s.score,0); assert.equal(s.over,false);
assert.deepEqual(s.snake,[{x:3,y:3},{x:2,y:3},{x:1,y:3}]); assert.deepEqual(s.food,{x:5,y:3});
assert.deepEqual(step(s).snake[0],{x:4,y:3}); assert.equal(JSON.stringify(s),before);
assert.equal(step(s,'left').direction,'right'); assert.deepEqual(step(s,'up').snake[0],{x:3,y:2});
const fed=step(step(s)); assert.equal(fed.score,1); assert.equal(fed.snake.length,4); assert.deepEqual(fed.food,{x:0,y:0});
assert.equal(step({...s,snake:[{x:19,y:3},{x:18,y:3}]}).over,true);
assert.equal(step({...s,snake:[{x:3,y:3},{x:3,y:2},{x:4,y:2},{x:4,y:3},{x:4,y:4}]}).over,true);
assert.equal(step({...s,snake:[{x:3,y:3},{x:3,y:2},{x:4,y:2},{x:4,y:3}]}).over,false);
assert.deepEqual(step({...s,over:true}),{...s,over:true});
for(const width of [0,5,41,6.5,NaN]) assert.throws(()=>createGame({width}),RangeError);
assert.throws(()=>createGame({height:0}),RangeError); assert.throws(()=>step(s,'diagonal'),RangeError);
assert.equal(createGame({width:6,height:6}).width,6);
const body=[]; for(let y=0;y<6;y++) for(let x=0;x<6;x++) if(x!==1||y!==0) body.push({x,y});
const full=step({...s,width:6,height:6,snake:body,direction:'right',food:{x:1,y:0}});
assert.equal(full.over,true); assert.equal(full.food,null);
`;
// Execute agent-authored browser code with timer/buttons/keys. Real browser QA
// complements this deterministic smoke check.
const browserCheck = String.raw`
import assert from 'node:assert/strict';
const elements = {}, keys = {}, timers=[]; let paints=0;
for(const id of ['board','score','status','start','restart']) elements[id]={textContent:'',width:480,height:480,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
elements.board.getContext=()=>new Proxy({}, {get:(_,key)=>key==='fillRect'?()=>paints++:()=>{},set:()=>true});
globalThis.document={getElementById:id=>elements[id]};
globalThis.window={addEventListener:(type,fn)=>{keys[type]=fn;}};
globalThis.setInterval=fn=>{timers.push(fn);return timers.length;};
await import('./app.js');
assert(paints>0,'Browser must render board'); assert.equal(Number(elements.score.textContent),0);
assert(timers.length>0,'Browser must register a timer');
const click=id=>{assert.equal(typeof elements[id].handlers.click,'function'); elements[id].handlers.click();};
const tick=()=>timers.forEach(fn=>fn());
const press=key=>{let prevented=false; keys.keydown({key,preventDefault(){prevented=true;}}); assert(prevented,'Keys must prevent scrolling');};
click('start'); tick(); tick(); assert.equal(Number(elements.score.textContent),1,'Eating updates visible score');
click('start'); for(let i=0;i<25;i++) tick(); assert(!/game over/i.test(elements.status.textContent),'Paused game must not move');
click('restart'); assert.equal(Number(elements.score.textContent),0);
click('start'); press('ArrowDown'); tick(); for(let i=0;i<25;i++) tick(); assert(/game over/i.test(elements.status.textContent),'Wall collision must be visible');
click('restart'); assert(!/game over/i.test(elements.status.textContent)); assert.equal(Number(elements.score.textContent),0);
`;
export async function verifyFixture(repositoryPath: string): Promise<string> {
  const options = { cwd: repositoryPath, windowsHide: true, timeout: 15000 };
  // Explicit TAP is stable across Node versions and terminal environments.
  const result = await execute(process.execPath, ["--test", "--test-reporter=tap", "tests/snake.test.mjs"], options);
  assert.match(result.stdout, /# fail 0/);
  assert(Number(result.stdout.match(/# tests (\d+)/)?.[1]) >= 7, "Expected at least seven actual fixture tests");
  assert.match(result.stdout, /# skipped 0/);
  await execute(process.execPath, ["--input-type=module", "-e", contractCheck], options);
  const html = readFileSync(join(repositoryPath, "index.html"), "utf8");
  assert.match(html, /<canvas\b/i);
  assert.match(html, /<script\b[^>]*type=["']module["'][^>]*src=["']\.\/?app\.js["']/i);
  for (const id of ["board", "score", "status", "start", "restart"]) assert(html.includes('id="' + id + '"') || html.includes("id='" + id + "'"), "Missing game element: " + id);
  await execute(process.execPath, ["--input-type=module", "-e", browserCheck], options);
  return result.stdout;
}
