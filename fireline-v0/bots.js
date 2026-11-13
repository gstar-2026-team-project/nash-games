// Simple bots for testing the env. They read the numbers from getState(), not the pixels.
// A real agent (an LLM) would look at the screenshot instead.

// (Named Rules, not Fireline: in the browser game.js already declares Fireline.)
const Rules = typeof module !== "undefined" ? require("./game.js") : window.Fireline;

// Do nothing, ever. The lower bound: the town burns on its own.
function idleBot() {
  return { buttons: [], click: null };
}

// How many cells the truck must drive from (col, row) to every street cell, and the first-step trail back.
function streetDistances(map, col, row) {
  const F = Rules, seen = new Map([[col + "," + row, { steps: 0, from: null }]]), queue = [[col, row]];
  while (queue.length) {
    const [c, r] = queue.shift(), here = seen.get(c + "," + r);
    for (const [button, [dc, dr]] of Object.entries(F.DRIVE)) {
      const nc = c + dc, nr = r + dr, key = nc + "," + nr;
      if (nr < 0 || nr >= F.ROWS || nc < 0 || nc >= F.COLS || map[nr][nc] !== "." || seen.has(key)) continue;
      seen.set(key, { steps: here.steps + 1, from: [c, r], button });
      queue.push([nc, nr]);
    }
  }
  return seen;
}

// The buttons to drive from the start of `seen` to (col, row), one per cell.
function route(seen, col, row) {
  const buttons = [];
  for (let at = seen.get(col + "," + row); at && at.from; at = seen.get(at.from.join(","))) buttons.unshift(at.button);
  return buttons;
}

// Greedy bot: go to the nearest fire and spray it; when the tank is low, go to the nearest hydrant.
// It returns a timed plan (for env.setPlan): [{ buttons, click, ticks }, ...].
// `lead` = how many ticks will pass before the plan starts (the bot's own thinking time).
// A fire keeps growing during the lead and the drive, so the bot sprays long enough for the fire it will find.
function greedyPlan(state, lead = 0) {
  const F = Rules, truck = state.truck;
  const steps = [];
  if (truck.moving > 0) steps.push({ buttons: [], click: null, ticks: truck.moving });   // finish the current move first
  const seen = streetDistances(state.map, truck.col, truck.row);
  const drive = (col, row) => { for (const b of route(seen, col, row)) steps.push({ buttons: [b], click: null, ticks: F.MOVE_TICKS }); };

  // Once at a hydrant, stay until the tank is full (spraying would stop the refill).
  const atHydrant = truck.moving === 0 && state.hydrants.some((h) => Math.abs(h.col - truck.col) <= 1 && Math.abs(h.row - truck.row) <= 1);
  if (atHydrant && state.water < F.TANK) return [{ buttons: [], click: null, ticks: Math.ceil((F.TANK - state.water) / 3) }];
  if (state.water < 20 || (state.burning.length === 0 && state.water < F.TANK)) {
    const near = state.hydrants.map((h) => ({ h, d: seen.get(h.col + "," + h.row).steps })).sort((a, b) => a.d - b.d)[0];
    drive(near.h.col, near.h.row);
    steps.push({ buttons: [], click: null, ticks: Math.ceil((F.TANK - state.water) / 3) });
    return steps;
  }

  // For every fire, the closest street cell from which the water reaches it.
  let best = null;
  for (const fire of state.burning) {
    const [fx, fy] = F.cellCentre(fire.col, fire.row);
    for (const [key, info] of seen) {
      const [c, r] = key.split(",").map(Number), [x, y] = F.cellCentre(c, r);
      if (Math.hypot(fx - x, fy - y) > F.RANGE - 4) continue;
      if (!best || info.steps < best.steps) best = { steps: info.steps, col: c, row: r, fire, aim: [fx, fy] };
    }
  }
  if (!best) return steps;
  drive(best.col, best.row);
  const fireThen = Math.min(100, best.fire.fire + 0.4 * (lead + best.steps * F.MOVE_TICKS));   // it grows 0.4 per tick
  steps.push({ buttons: [], click: best.aim, ticks: Math.ceil(fireThen / 2.6) + 4 });          // spraying wins 3 - 0.4 per tick
  return steps;
}

// The same bot answering "what do I press right now?": the first step of its plan.
function greedyBot(state) {
  const first = greedyPlan(state)[0];
  return first ? { buttons: first.buttons, click: first.click } : { buttons: [], click: null };
}

const Bots = { idleBot, greedyBot, greedyPlan };
if (typeof module !== "undefined") module.exports = Bots;
if (typeof window !== "undefined") window.Bots = Bots;
