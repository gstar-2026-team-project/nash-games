// Fireline v0: the game rules only. No drawing, no timers.
// The same file runs in the browser (index.html) and in Node (test.js).
//
// A small town seen from above. Fires start and spread on their own, pushed by the wind.
// You drive a fire truck along the streets and spray water with the mouse.
// Score = how much of the town is still standing, 0 to 100.
//
// One call to step() = one tick = 1/24 second.
// An action is { buttons: [...], click: [x, y] or null }.
//   "up" "down" "left" "right" = drive (one cell takes MOVE_TICKS ticks; only streets can be driven)
//   click = the mouse button is held at screen point [x, y] during this tick: spray water there
// The other buttons are accepted and logged, but do nothing here.

const SIZE = 768;            // the canvas is SIZE x SIZE pixels
const CELL = 48;             // one map cell, in pixels
const COLS = 16, ROWS = 14;  // the map is 16 x 14 cells
const TOP = 96;              // the map starts below a 96 px strip for the score and the wind
const STREET_COLS = [0, 5, 10, 15];
const STREET_ROWS = [0, 4, 9, 13];
const MOVE_TICKS = 12;       // ticks to drive from one cell to the next
const RANGE = 3.5 * CELL;    // how far the water reaches from the truck
const TANK = 120;            // water in a full tank; spraying uses 1 per tick
const REFILL = 3;            // water gained per tick while parked next to a hydrant
const WET_TICKS = 240;       // a soaked cell cannot catch fire for this long
const WIND = [               // wind directions: where the wind blows TO
  { name: "N", dc: 0, dr: -1 }, { name: "E", dc: 1, dr: 0 }, { name: "S", dc: 0, dr: 1 }, { name: "W", dc: -1, dr: 0 },
];
const DRIVE = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// Level = how hard the fire is. firstFires at the start, a new one about every `every` ticks,
// and `spread` scales how fast heat passes to the neighbours.
const LEVELS = {
  1: { firstFires: 2, every: 240, spread: 1.2 },
  2: { firstFires: 3, every: 144, spread: 1.8 },
  3: { firstFires: 4, every: 96, spread: 2.4 },
};
// What can burn. `ignite` = heat needed to catch fire, `hp` = how much there is to burn.
const BURNS = { house: { ignite: 100, hp: 100 }, tree: { ignite: 60, hp: 40 } };

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
    level: LEVELS[options.level] ? options.level : 2,
    actionDelay: options.actionDelay ?? 0,   // an action takes effect this many ticks later
    maxTicks: options.maxTicks ?? 24 * 90,   // 90 seconds
    tick: 0,
    score: 100,
    done: false,
    result: "",                              // "finished" (time is up) or "lost" (nothing left)
    cells: [],                               // cells[row][col] = { kind, state, heat, fire, hp, wet }
    hydrants: [],                            // [{ col, row }], on street corners
    truck: { col: 5, row: 4, fromCol: 5, fromRow: 4, moving: 0 },  // moving = ticks left to reach (col, row)
    water: TANK,
    spray: null,                             // [x, y] where the water landed this tick, for drawing
    refilling: false,                        // is the tank filling up this tick?
    blocked: false,                          // did the truck try to drive where there is no street this tick?
    wind: 0,                                 // index into WIND
    nextWind: 0,
    nextFire: 24,
    pending: [],                             // actions waiting because of actionDelay
    log: [],                                 // every action as received, one per tick (the "tape")
  };
  const random = game.random = makeRandom(game.seed);

  // The town: streets in a grid, and blocks of houses, trees and empty yards between them.
  for (let row = 0; row < ROWS; row++) {
    game.cells.push([]);
    for (let col = 0; col < COLS; col++) {
      let kind = "street";
      if (!STREET_COLS.includes(col) && !STREET_ROWS.includes(row)) {
        const r = random();
        kind = r < 0.6 ? "house" : r < 0.85 ? "tree" : "yard";
      }
      game.cells[row].push({ kind, state: "ok", heat: 0, fire: 0, hp: BURNS[kind] ? BURNS[kind].hp : 0, wet: 0 });
    }
  }
  // Three hydrants on street corners, away from where the truck starts.
  const corners = [];
  for (const row of STREET_ROWS) for (const col of STREET_COLS) if (col !== 5 || row !== 4) corners.push({ col, row });
  for (let i = 0; i < 3; i++) game.hydrants.push(corners.splice(Math.floor(random() * corners.length), 1)[0]);

  game.houses = game.cells.flat().filter((c) => c.kind === "house").length;
  game.wind = Math.floor(random() * 4);
  game.nextWind = 360 + Math.floor(random() * 240);
  for (let i = 0; i < LEVELS[game.level].firstFires; i++) startFire(game);
  return game;
}

const NOTHING = { buttons: [], click: null };

function cleanAction(action) {
  if (!action) return NOTHING;
  return { buttons: Array.isArray(action.buttons) ? action.buttons : [], click: Array.isArray(action.click) ? action.click : null };
}

function cellAt(game, col, row) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS ? game.cells[row][col] : null;
}

function canBurn(cell) {
  return cell && BURNS[cell.kind] && cell.state === "ok";
}

// Centre of a cell on the screen.
function cellCentre(col, row) {
  return [col * CELL + CELL / 2, TOP + row * CELL + CELL / 2];
}

// Where the truck is on the screen (it slides between cells while moving).
function truckPoint(game) {
  const t = game.truck, part = t.moving / MOVE_TICKS;
  const [x, y] = cellCentre(t.col + (t.fromCol - t.col) * part, t.row + (t.fromRow - t.row) * part);
  return [x, y];
}

// A new fire in a random house or tree that is not burning yet.
function startFire(game) {
  for (let tries = 0; tries < 30; tries++) {
    const cell = cellAt(game, Math.floor(game.random() * COLS), Math.floor(game.random() * ROWS));
    if (canBurn(cell) && cell.wet === 0) { cell.state = "burning"; cell.fire = 10; return; }
  }
}

// Advance the game by one tick. Returns what happened in this tick.
function step(game, action) {
  if (game.done) return { reward: 0, done: true };
  const level = LEVELS[game.level];

  // 1. Record the action, then pick the action that takes effect now.
  const received = cleanAction(action);
  game.log.push(received);
  game.pending.push(received);
  const now = game.pending.length > game.actionDelay ? game.pending.shift() : NOTHING;

  // 2. Drive. A move always finishes in the next cell; a new one starts only from a cell centre.
  const truck = game.truck;
  game.blocked = false;
  if (truck.moving > 0) truck.moving -= 1;
  else {
    const button = Object.keys(DRIVE).find((b) => now.buttons.includes(b));
    if (button) {
      const col = truck.col + DRIVE[button][0], row = truck.row + DRIVE[button][1];
      const target = cellAt(game, col, row);
      if (target && target.kind === "street") {
        truck.fromCol = truck.col; truck.fromRow = truck.row;
        truck.col = col; truck.row = row; truck.moving = MOVE_TICKS - 1;
      } else game.blocked = true;              // a drive button is held, but there is no street that way
    }
  }

  // 3. Spray. The water lands where the mouse points, or at the end of its reach in that direction.
  game.spray = null;
  if (now.click && game.water > 0) {
    const [tx, ty] = truckPoint(game);
    let dx = now.click[0] - tx, dy = now.click[1] - ty;
    const far = Math.hypot(dx, dy);
    if (far > RANGE) { dx *= RANGE / far; dy *= RANGE / far; }
    const x = tx + dx, y = ty + dy;
    game.spray = [x, y];
    game.water -= 1;
    const cell = cellAt(game, Math.floor(x / CELL), Math.floor((y - TOP) / CELL));
    if (cell && cell.state === "burning") {
      cell.fire -= 3;
      if (cell.fire <= 0) { cell.state = "ok"; cell.fire = 0; cell.heat = 0; cell.wet = WET_TICKS; }  // the fire is out
    } else if (canBurn(cell)) {
      cell.heat = Math.max(0, cell.heat - 4);
      cell.wet = Math.min(WET_TICKS, cell.wet + 3);                                                  // soak it in advance
    }
  }

  // 4. Refill while parked on or next to a hydrant (also diagonally), and not spraying.
  game.refilling = truck.moving === 0 && !now.click && game.water < TANK &&        // not while the mouse is held
    game.hydrants.some((h) => Math.abs(h.col - truck.col) <= 1 && Math.abs(h.row - truck.row) <= 1);
  if (game.refilling) game.water = Math.min(TANK, game.water + REFILL);

  // 5. Fire. Every burning cell grows, loses hp, and heats its neighbours: fast downwind, slow upwind.
  //    Downwind it can also jump one street or yard. Heat is added up first, so the order of cells does not matter.
  const wind = WIND[game.wind];
  const heat = new Map();
  const warm = (cell, amount) => { if (canBurn(cell) && cell.wet === 0) heat.set(cell, (heat.get(cell) || 0) + amount); };
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const cell = game.cells[row][col];
    if (cell.state !== "burning") continue;
    cell.fire = Math.min(100, cell.fire + 0.4);
    cell.hp -= 0.6 * cell.fire / 100;
    if (cell.hp <= 0) { cell.hp = 0; cell.fire = 0; cell.state = "burnt"; continue; }
    const push = level.spread * 0.5 * cell.fire / 100;
    for (const d of WIND) {
      const along = d.dc * wind.dc + d.dr * wind.dr;          // 1 = downwind, -1 = upwind, 0 = sideways
      warm(cellAt(game, col + d.dc, row + d.dr), push * (along === 1 ? 2.5 : along === -1 ? 0.4 : 1));
    }
    if (!canBurn(cellAt(game, col + wind.dc, row + wind.dr))) warm(cellAt(game, col + 2 * wind.dc, row + 2 * wind.dr), push * 0.6);
  }
  for (const cell of game.cells.flat()) {
    if (cell.wet > 0) cell.wet -= 1;
    if (!canBurn(cell)) continue;
    if (heat.has(cell)) cell.heat += heat.get(cell); else cell.heat = Math.max(0, cell.heat - 0.1);
    if (cell.heat >= BURNS[cell.kind].ignite) { cell.state = "burning"; cell.fire = 10; cell.heat = 0; }
  }

  // 6. New fires and wind changes arrive on their own schedule.
  if (game.tick >= game.nextFire) {
    startFire(game);
    game.nextFire = game.tick + level.every + Math.floor(game.random() * level.every * 0.5);
  }
  if (game.tick >= game.nextWind) {
    game.wind = (game.wind + 1 + Math.floor(game.random() * 3)) % 4;   // always a different direction
    game.nextWind = game.tick + 360 + Math.floor(game.random() * 240); // every 15 to 25 seconds
  }

  // 7. Count the tick and the score: the share of all house hp that is left.
  game.tick += 1;
  const before = game.score;
  let hp = 0;
  for (const cell of game.cells.flat()) if (cell.kind === "house") hp += cell.hp;
  game.score = Math.round(10 * hp / game.houses) / 10;
  if (game.score <= 0) { game.done = true; game.result = "lost"; }
  else if (game.tick >= game.maxTicks) { game.done = true; game.result = "finished"; }
  return { reward: game.score - before, done: game.done };
}

// A plain summary of the game, for logging and for bots that read numbers instead of pixels.
// map: one string per row. "." street, "," yard, "H" house, "T" tree, "F" burning, "x" burnt, "w" soaked.
function getState(game) {
  const [x, y] = truckPoint(game);
  const burning = [];
  const map = game.cells.map((line, row) => line.map((cell, col) => {
    if (cell.state === "burning") { burning.push({ col, row, fire: Math.round(cell.fire) }); return "F"; }
    if (cell.state === "burnt") return "x";
    if (cell.kind === "street") return ".";
    if (cell.kind === "yard") return ",";
    if (cell.wet > 0) return "w";
    return cell.kind === "house" ? "H" : "T";
  }).join(""));
  return {
    tick: game.tick, score: game.score, done: game.done, result: game.result, level: game.level,
    truck: { col: game.truck.col, row: game.truck.row, moving: game.truck.moving, x: Math.round(x), y: Math.round(y) },
    water: game.water, refilling: game.refilling, blocked: game.blocked, wind: WIND[game.wind].name, hydrants: game.hydrants, burning, map,
    actionDelay: game.actionDelay,
  };
}

const Fireline = {
  SIZE, CELL, COLS, ROWS, TOP, MOVE_TICKS, RANGE, TANK, WET_TICKS, WIND, DRIVE, BURNS, LEVELS,
  newGame, step, getState, cellAt, cellCentre, truckPoint,
};

if (typeof module !== "undefined") module.exports = Fireline;
if (typeof window !== "undefined") window.Fireline = Fireline;
