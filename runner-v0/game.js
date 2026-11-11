// Runner v0: the game rules only. No drawing, no timers.
// The same file runs in the browser (index.html) and in Node (test.js).
//
// One call to step() = one tick = 1/24 second.
// An action is { buttons: [...], click: [x, y] or null }.
// Buttons: "up", "down", "left", "right", "space", "x", "y".
// This game only uses two of them:
//   "space" = jump (only works when standing on the ground)
//   "down"  = duck (only while held, only on the ground)
// The other buttons and the click are accepted and logged, but do nothing here.

const SIZE = 768;            // the canvas is SIZE x SIZE pixels
const GROUND = 600;          // y of the ground line
const PLAYER_X = 150;        // the player never moves left/right
const PLAYER_W = 40;
const STAND_H = 60;
const DUCK_H = 30;
const JUMP_SPEED = 16;       // pixels per tick, upwards, at take-off
const GRAVITY = 1.2;         // pixels per tick per tick

const LOW = { w: 30, h: 50 };   // box on the ground: jump over it
const HIGH = { w: 60, h: 120, bottom: GROUND - 40 }; // hanging bar: duck under it (too tall to jump over)

// Small seeded random generator, so the same seed gives the same game.
function makeRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function newGame(options = {}) {
  const game = {
    seed: options.seed ?? 1,
    speed: options.speed ?? 8,               // obstacle speed, pixels per tick
    actionDelay: options.actionDelay ?? 0,   // an action takes effect this many ticks later
    maxTicks: options.maxTicks ?? 24 * 60,   // 60 seconds, then the run counts as finished
    tick: 0,
    score: 0,
    done: false,
    result: "",                              // "crashed" or "finished" when done
    playerY: 0,                              // height above the ground, 0 = on the ground
    playerVy: 0,
    ducking: false,
    obstacles: [],                           // { kind: "low" | "high", x }
    nextSpawn: 30,                           // tick when the next obstacle appears
    pending: [],                             // actions waiting because of actionDelay
    log: [],                                 // every action as received, one per tick (the "tape")
  };
  game.random = makeRandom(game.seed);
  return game;
}

const NOTHING = { buttons: [], click: null };

function cleanAction(action) {
  if (!action) return NOTHING;
  return { buttons: Array.isArray(action.buttons) ? action.buttons : [], click: action.click ?? null };
}

function playerBox(game) {
  const h = game.ducking ? DUCK_H : STAND_H;
  const bottom = GROUND - game.playerY;
  return { left: PLAYER_X, right: PLAYER_X + PLAYER_W, top: bottom - h, bottom };
}

function obstacleBox(o) {
  if (o.kind === "low") {
    return { left: o.x, right: o.x + LOW.w, top: GROUND - LOW.h, bottom: GROUND };
  }
  return { left: o.x, right: o.x + HIGH.w, top: HIGH.bottom - HIGH.h, bottom: HIGH.bottom };
}

function overlaps(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

// Advance the game by one tick. Returns what happened in this tick.
function step(game, action) {
  if (game.done) return { reward: 0, done: true };

  // 1. Record the action, then pick the action that takes effect now.
  const received = cleanAction(action);
  game.log.push(received);
  game.pending.push(received);
  const now = game.pending.length > game.actionDelay ? game.pending.shift() : NOTHING;
  const pressed = (b) => now.buttons.includes(b);

  // 2. Move the player.
  const onGround = game.playerY === 0;
  if (onGround && pressed("space")) game.playerVy = JUMP_SPEED;
  game.playerY += game.playerVy;
  game.playerVy -= GRAVITY;
  if (game.playerY <= 0) { game.playerY = 0; game.playerVy = 0; }
  game.ducking = game.playerY === 0 && pressed("down");

  // 3. Move obstacles, drop the ones that left the screen, maybe add a new one.
  for (const o of game.obstacles) o.x -= game.speed;
  game.obstacles = game.obstacles.filter((o) => o.x > -100);
  if (game.tick >= game.nextSpawn) {
    game.obstacles.push({ kind: game.random() < 0.5 ? "low" : "high", x: SIZE });
    game.nextSpawn = game.tick + 30 + Math.floor(game.random() * 30); // 1.25 to 2.5 seconds apart
  }

  // 4. Check for a crash, then count the tick.
  game.tick += 1;
  const me = playerBox(game);
  if (game.obstacles.some((o) => overlaps(me, obstacleBox(o)))) {
    game.done = true;
    game.result = "crashed";
    return { reward: 0, done: true };
  }
  game.score += 1;
  if (game.tick >= game.maxTicks) { game.done = true; game.result = "finished"; }
  return { reward: 1, done: game.done };
}

// A plain summary of the game, for logging and for bots that read numbers instead of pixels.
function getState(game) {
  return {
    tick: game.tick,
    score: game.score,
    done: game.done,
    result: game.result,
    playerY: Math.round(game.playerY * 10) / 10,
    ducking: game.ducking,
    obstacles: game.obstacles.map((o) => ({ kind: o.kind, x: o.x })),
    speed: game.speed,
    actionDelay: game.actionDelay,
  };
}

const Runner = {
  SIZE, GROUND, PLAYER_X, PLAYER_W, STAND_H, DUCK_H, LOW, HIGH,
  newGame, step, getState, playerBox, obstacleBox,
};

if (typeof module !== "undefined") module.exports = Runner;
if (typeof window !== "undefined") window.Runner = Runner;
