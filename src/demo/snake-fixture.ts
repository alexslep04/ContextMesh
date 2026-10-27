import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// This contract is starter material, not completed code. Live peers implement it.
export const snakeContract = `# Snake demo contract
Use browser-compatible JavaScript ES modules, no dependencies or build step.
Agent A owns snake.js. Agent B owns index.html, app.js and tests/snake.test.mjs.
snake.js exports createGame(options = {}) and step(state, direction = state.direction).
createGame accepts width/height integer dimensions from 6 to 40 (default 20),
throws RangeError for invalid dimensions, and returns:
{width,height,snake:[{x:3,y:3},{x:2,y:3},{x:1,y:3}],direction:'right',
food:{x:5,y:3},score:0,over:false}.
step is pure: never mutate its input. Directions are up/down/left/right;
unknown directions throw RangeError, an immediate reversal is ignored.
Move one cell; food grows the snake and adds one score. Spawn the next food
at the first free cell scanning rows from (0,0). Wall/self collision sets over.
The vacating tail is safe unless growing. An ended game stays unchanged.
A completely full board has food:null and over:true. No wraparound.
The browser UI imports ./snake.js, uses a canvas, arrow keys or WASD, a score,
Start/Pause and Restart buttons, and a game-over message. Start paused so the
presenter can explain first; one direction change per tick, roughly 140ms.
Keyboard controls must prevent page scrolling. Restart resets score and board.
Use the exact DOM IDs board (canvas), score, status, start, restart.
Use document.getElementById for these nodes, window.addEventListener for keys,
and setInterval for ticks so the harness can smoke-test controls without a browser.
Tests use node:test and node:assert/strict, import ../snake.js and cover movement,
growth/score, reversal, wall/self collision, immutability and invalid dimensions.
Run node --test --test-reporter=tap tests/snake.test.mjs.
`;

export function seedSnakeFixture(repositoryPath: string) {
  mkdirSync(repositoryPath, { recursive: true });
  writeFileSync(join(repositoryPath, "package.json"), '{"private":true,"type":"module"}\n');
  writeFileSync(join(repositoryPath, "CONTRACT.md"), snakeContract);
  writeFileSync(join(repositoryPath, "snake.js"), "// Agent A implements the contract in CONTRACT.md.\n");
}

export const snakeImplementation = String.raw`export function createGame({ width = 20, height = 20 } = {}) {
  if (![width, height].every(n => Number.isInteger(n) && n >= 6 && n <= 40)) throw new RangeError('Board dimensions must be integers from 6 to 40');
  return { width, height, snake: [{x:3,y:3},{x:2,y:3},{x:1,y:3}], direction: 'right', food: {x:5,y:3}, score: 0, over: false };
}
const vectors = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
export function step(state, direction = state.direction) {
  if (!Object.hasOwn(vectors, direction)) throw new RangeError('Unknown direction');
  if (state.over) return state;
  if (direction === opposite[state.direction]) direction = state.direction;
  const [dx, dy] = vectors[direction], head = { x: state.snake[0].x + dx, y: state.snake[0].y + dy };
  const eating = state.food !== null && head.x === state.food.x && head.y === state.food.y;
  const body = eating ? state.snake : state.snake.slice(0, -1);
  if (head.x < 0 || head.y < 0 || head.x >= state.width || head.y >= state.height || body.some(p => p.x === head.x && p.y === head.y)) return { ...state, direction, over: true };
  const snake = [head, ...state.snake.map(p => ({...p}))];
  if (!eating) snake.pop();
  let food = state.food;
  if (eating) {
    food = null;
    outer: for (let y = 0; y < state.height; y++) for (let x = 0; x < state.width; x++) {
      if (!snake.some(p => p.x === x && p.y === y)) { food = {x,y}; break outer; }
    }
  }
  return { ...state, snake, direction, food, score: state.score + Number(eating), over: food === null };
}
`;

export const snakeHtml = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ContextMesh · Snake</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0a111c;color:#eef6ff;font:16px system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}
main{width:min(100%,540px)}.eyebrow{color:#6ee7be;letter-spacing:.18em;font-size:12px;text-transform:uppercase}h1{font-size:48px;margin:8px 0}.intro{color:#a7bbd0;line-height:1.6}
.bar{display:flex;justify-content:space-between;align-items:center;margin:24px 0 12px}.score{font-size:24px}#status{color:#6ee7be}canvas{width:100%;display:block;border:1px solid #294055;border-radius:14px;background:#101e2e}
.controls{display:flex;gap:12px;margin-top:18px}button{border:0;border-radius:8px;background:#6ee7be;color:#0a111c;font:600 16px system-ui;padding:12px 24px;cursor:pointer}button+button{background:#22344a;color:#eef6ff}button:focus-visible{outline:3px solid white;outline-offset:3px}.help{color:#a7bbd0;font-size:14px;line-height:1.6}footer{margin-top:24px;border-top:1px solid #294055;padding-top:16px;color:#8ea7bf;font-size:13px}
</style></head><body><main><div class="eyebrow">ContextMesh / two Codex sessions</div><h1>Snake, together.</h1><p class="intro">One agent builds the rules. Another picks up the handoff and builds the experience.</p>
<div class="bar"><strong class="score">Score <span id="score">0</span></strong><span id="status" role="status" aria-live="polite">Ready</span></div>
<canvas id="board" width="480" height="480" aria-label="Snake game board"></canvas><div class="controls"><button id="start">Start</button><button id="restart">Restart</button></div>
<p class="help">Arrow keys or WASD to steer. Space to pause. Eat the coral food and avoid the walls and your tail.</p><footer>Shared intent → overlap warning → scope update → durable handoff.</footer></main><script type="module" src="./app.js"></script></body></html>
`;

export const snakeApp = String.raw`import { createGame, step } from './snake.js';
const board = document.getElementById('board'), ctx = board.getContext('2d');
const score = document.getElementById('score'), status = document.getElementById('status');
const start = document.getElementById('start'), restart = document.getElementById('restart');
let game = createGame(), running = false, queued = game.direction, turned = false;
const keys = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right', w:'up', s:'down', a:'left', d:'right' };
const opposite = { up:'down', down:'up', left:'right', right:'left' };
function draw() {
  const cell = board.width / game.width;
  ctx.fillStyle = '#101e2e'; ctx.fillRect(0, 0, board.width, board.height);
  ctx.fillStyle = '#203248';
  for(let y=0;y<game.height;y++) for(let x=0;x<game.width;x++) ctx.fillRect(x*cell, y*cell, 1, 1);
  game.snake.forEach((p,i) => { ctx.fillStyle = i ? '#36a985' : '#8bffd2'; ctx.fillRect(p.x*cell+2,p.y*cell+2,cell-4,cell-4); });
  if(game.food) { ctx.fillStyle = '#ff8c78'; ctx.fillRect(game.food.x*cell+3,game.food.y*cell+3,cell-6,cell-6); }
  score.textContent = String(game.score); status.textContent = game.over ? 'Game over — restart to play' : running ? 'Playing' : 'Paused — press Start';
  start.textContent = running ? 'Pause' : 'Start';
}
function toggle() { if(!game.over) running = !running; draw(); }
start.addEventListener('click', toggle);
restart.addEventListener('click', () => { game = createGame(); running = false; queued = game.direction; turned = false; draw(); });
window.addEventListener('keydown', event => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if(key === ' ') { event.preventDefault(); toggle(); return; }
  if(!keys[key]) return;
  event.preventDefault();
  if(running && !turned && keys[key] !== opposite[game.direction]) { queued = keys[key]; turned = true; }
});
setInterval(() => { if(!running || game.over) return; game = step(game, queued); turned = false; if(game.over) running = false; draw(); }, 140);
draw();
`;

export const snakeTests = String.raw`import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../snake.js';
test('moves one cell without mutating the input', () => { const s = createGame(), before = JSON.stringify(s), n = step(s); assert.deepEqual(n.snake[0], {x:4,y:3}); assert.equal(JSON.stringify(s), before); });
test('grows and scores on food', () => { const s = step(step(createGame())); assert.equal(s.score, 1); assert.equal(s.snake.length, 4); assert.deepEqual(s.food, {x:0,y:0}); });
test('ignores immediate reversal', () => assert.equal(step(createGame(), 'left').direction, 'right'));
test('wall collision ends game', () => { const s = createGame({width:6,height:6}); assert.equal(step({...s,snake:[{x:5,y:3},{x:4,y:3}]}).over, true); });
test('self collision ends game', () => { const s = createGame(); assert.equal(step({...s,snake:[{x:3,y:3},{x:3,y:2},{x:4,y:2},{x:4,y:3},{x:4,y:4}]}).over, true); });
test('ended state stays ended', () => { const s = {...createGame(),over:true}; assert.deepEqual(step(s),s); });
test('rejects invalid dimensions and directions', () => { assert.throws(() => createGame({width:0}), RangeError); assert.throws(() => step(createGame(),'diagonal'), RangeError); });
`;

export function writeSnakeBrowser(repositoryPath: string) {
  mkdirSync(join(repositoryPath, "tests"), { recursive: true });
  writeFileSync(join(repositoryPath, "index.html"), snakeHtml);
  writeFileSync(join(repositoryPath, "app.js"), snakeApp);
  writeFileSync(join(repositoryPath, "tests/snake.test.mjs"), snakeTests);
}
