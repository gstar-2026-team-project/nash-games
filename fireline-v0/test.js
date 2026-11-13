// Rules check, no browser needed.  Run:  node test.js

const assert = require("assert");
const F = require("./game.js");
const Bots = require("./bots.js");

function play(bot, options) {
  const game = F.newGame(options);
  while (!game.done) F.step(game, bot(F.getState(game)));
  return game;
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const SEEDS = [1, 2, 3, 4, 5, 6];

// 1. Same seed and same actions give the same game.
{
  const a = play(Bots.greedyBot, { seed: 7 }), b = play(Bots.greedyBot, { seed: 7 });
  assert.deepStrictEqual(F.getState(a), F.getState(b));
  assert.notDeepStrictEqual(F.getState(F.newGame({ seed: 7 })).map, F.getState(F.newGame({ seed: 8 })).map);
  console.log("ok  same seed, same game");
}

// 2. Doing nothing loses much of the town; the greedy bot saves most of it; harder levels are harder.
{
  const idle = {}, greedy = {};
  for (const level of [1, 2, 3]) {
    idle[level] = mean(SEEDS.map((seed) => play(Bots.idleBot, { seed, level }).score));
    greedy[level] = mean(SEEDS.map((seed) => play(Bots.greedyBot, { seed, level }).score));
    assert.ok(greedy[level] > idle[level] + 15, `level ${level}: playing must clearly beat doing nothing`);
  }
  assert.ok(idle[2] < 50 && greedy[2] > 80, "level 2: idle loses most of the town, greedy saves most of it");
  assert.ok(idle[1] > idle[2] && idle[2] > idle[3] && greedy[1] > greedy[3], "levels get harder");
  console.log("ok  idle vs greedy, mean score by level:", [1, 2, 3].map((l) => `L${l} ${idle[l].toFixed(0)} vs ${greedy[l].toFixed(0)}`).join(", "));
}

// 3. Replaying the tape of a run gives the same score.
{
  const run = play(Bots.greedyBot, { seed: 3 });
  const again = F.newGame({ seed: 3 });
  for (const action of run.log) F.step(again, action);
  assert.strictEqual(again.score, run.score);
  assert.strictEqual(again.tick, run.tick);
  console.log("ok  tape replay matches");
}

// 4. Driving: one cell takes MOVE_TICKS ticks, and only streets can be driven.
{
  const game = F.newGame({ seed: 1 });                      // the truck starts on the corner F5 (col 5, row 4)
  for (let i = 0; i < F.MOVE_TICKS * 2; i++) F.step(game, { buttons: ["right"], click: null });
  assert.deepStrictEqual([game.truck.col, game.truck.row, game.truck.moving], [7, 4, 0]);
  for (let i = 0; i < F.MOVE_TICKS; i++) F.step(game, { buttons: ["up"], click: null });   // a block is in the way
  assert.deepStrictEqual([game.truck.col, game.truck.row, game.blocked], [7, 4, true]);
  F.step(game, null);
  assert.strictEqual(game.blocked, false);
  console.log("ok  driving is one cell per", F.MOVE_TICKS, "ticks, blocks stop the truck");
}

// 5. Water: spraying a fire in reach puts it out and soaks the cell; the tank empties; a hydrant refills it.
{
  const game = F.newGame({ seed: 1 });
  for (const cell of game.cells.flat()) if (cell.state === "burning") { cell.state = "ok"; cell.fire = 0; }
  game.nextFire = Infinity;
  const target = F.cellAt(game, 6, 5);                      // G6, next to the start corner
  target.kind = "house"; target.hp = 100; target.state = "burning"; target.fire = 30;
  const aim = F.cellCentre(6, 5);
  let ticks = 0;
  while (target.state === "burning" && ticks < 100) { F.step(game, { buttons: [], click: aim }); ticks++; }
  assert.strictEqual(target.state, "ok");
  assert.ok(target.wet > 0 && ticks <= 12, "a small fire is out in about half a second");
  assert.strictEqual(game.water, F.TANK - ticks);

  for (let i = 0; i < 400; i++) F.step(game, { buttons: [], click: [760, 760] });            // far away: lands at the end of the reach
  assert.strictEqual(game.water, 0);
  const [tx, ty] = F.truckPoint(game);
  game.water = 5; F.step(game, { buttons: [], click: [760, 760] });
  assert.ok(Math.abs(Math.hypot(game.spray[0] - tx, game.spray[1] - ty) - F.RANGE) < 0.001);

  const h = game.hydrants[0];
  game.truck.col = game.truck.fromCol = h.col; game.truck.row = game.truck.fromRow = h.row; game.water = 0;
  for (let i = 0; i < 10; i++) F.step(game, { buttons: [], click: aim });                    // spraying: no refill
  assert.strictEqual(game.water, 0);
  for (let i = 0; i < 60; i++) F.step(game, null);
  assert.strictEqual(game.water, F.TANK);
  console.log("ok  spray, reach, empty tank, refill");
}

// 6. Wind: a fire reaches the downwind neighbour before the upwind one (if it gets there at all), and a soaked cell does not catch fire.
{
  const game = F.newGame({ seed: 1 });
  for (const cell of game.cells.flat()) if (cell.kind !== "street") { cell.kind = "house"; cell.hp = 100; cell.state = "ok"; cell.fire = 0; }
  game.nextFire = Infinity; game.nextWind = Infinity; game.wind = 1;   // blowing east
  const fire = F.cellAt(game, 2, 6); fire.state = "burning"; fire.fire = 10;
  const east = F.cellAt(game, 3, 6), west = F.cellAt(game, 1, 6), south = F.cellAt(game, 2, 7);
  south.wet = 100000;
  let eastAt = 0, westAt = 0;
  for (let t = 1; t <= 900 && !(eastAt && westAt); t++) {
    F.step(game, null);
    if (!eastAt && east.state !== "ok") eastAt = t;
    if (!westAt && west.state !== "ok") westAt = t;
  }
  assert.ok(eastAt > 0 && (westAt === 0 || westAt > eastAt), `downwind first (east ${eastAt}, west ${westAt})`);
  assert.strictEqual(south.state, "ok");
  console.log(`ok  wind: downwind neighbour burns after ${eastAt} ticks, upwind ${westAt ? "after " + westAt : "never"}; soaked cell stays safe`);
}

// 7. Action delay: an action lands N ticks later, and the tape still replays.
{
  const game = F.newGame({ seed: 1, actionDelay: 6 });
  for (let i = 0; i < 6; i++) F.step(game, { buttons: ["right"], click: null });
  assert.strictEqual(game.truck.col, 5);
  F.step(game, null);
  assert.strictEqual(game.truck.col, 6);
  console.log("ok  action delay");
}

console.log("all checks passed");
