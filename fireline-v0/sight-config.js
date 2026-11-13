// What a model is told when it plays Fireline v0 from screenshots (used by ../harness/sight.js),
// and how its short text answers become actions.

const F = require("./game.js");
const Bots = require("./bots.js");

const manual = `You are playing a firefighting game from screenshots. Each screenshot is 384x384.

THE MAP is a town seen from above, a grid of cells. A cell is named by its column letter and row number, like "N8". Column letters A to P are printed along every street that runs across, row numbers 1 to 14 along every street that runs down.
- Grey = street. Your truck can only drive on streets: columns A, F, K, P and rows 1, 5, 10, 14.
- Cream walls with a brown pitched roof = house. Green leafy canopy = tree. Plain light green = empty yard (cannot burn).
- Orange and yellow flames with smoke in a dark frame = BURNING, with the cell's name on a dark tag; taller flames mean a bigger fire that needs longer spraying. The yellow arrow on a dark badge at its upper right points where the wind pushes that fire. Dark rubble = burnt down (lost).
- A darkened house was damaged by fire. If its flames are out, it still stands and still counts, in part.
- Orange frame = hot, will catch fire soon. Blue frame = soaked, safe for a while; the frame gets thinner as it dries.
- Red truck with wheels, white stripes and a ladder = your fire truck. The white tag next to it names the cell it is on; it adds +WATER while the tank is filling, and BLOCKED while you are trying to drive where there is no street. The white dashed circle around it = how far your water reaches (3.5 cells). A pale blue jet and splashes show where water actually lands.
- Blue hydrant with a white H = refill point.
The dark strip on top shows TOWN (your score: percent of the houses still standing), the time, the WATER left (a number, full = 120), a yellow WIND arrow, and TRUCK: the name of the cell your truck is on.

RULES. Fires start on their own, grow, and spread to neighbouring houses and trees: fastest in the direction the wind arrow points, slowest against it. Downwind a fire can even jump across a street. The wind changes now and then.
- Drive with up, down, left, right. One cell takes 12 ticks (24 ticks = 1 second). Driving into a block does nothing: check the street names first.
- Spray a cell inside the dashed circle to put its fire out. A fresh fire takes about 10 ticks of spraying, a big one up to 35. Spraying a cell that is not burning soaks it, so it cannot catch fire for 10 seconds.
- Spraying uses 1 water per tick; a full tank is 120. To refill, stop on a hydrant or on one of the 8 cells around it, and do not spray: 3 water per tick.
The goal is to keep as much of the town standing as possible. You cannot save everything: choose what matters.`;

const askPress = `What should the truck do right now? Reply with exactly one of: up, down, left, right, "spray CELL" (for example "spray N8"), or none.`;

const askPlan = `Write what the truck should do next, as a short list of steps done one after another, separated by ";".
Each step is one of: "up N", "down N", "left N", "right N" (drive for N ticks; 12 ticks per cell), "spray CELL N" (spray that cell for N ticks), "wait N".
Example: "right 24; up 12; spray N8 15; spray M8 12". Plan about 2 to 4 seconds (48 to 96 ticks; anything after 96 ticks is dropped). The plan starts the moment it arrives, and you get your next look when it has finished. Reply with the plan line only.`;

// For the hybrid agent: a slower model watches the same game and writes a note for the fast one.
const askAdvice = `You are the strategist for a faster driver who reads your note before each move. Look at the whole town: the fires, the wind, the water bar, the hydrants. In at most two short sentences, say what matters most in the next 10 seconds: which fire (cell name) to fight first and why, what to soak before it burns, and whether to refill now. Reply with the note only.`;

// "N8" -> the screen point at the centre of that cell, or null.
function cellPoint(name) {
  const m = /^([a-p])(\d{1,2})$/i.exec(name.trim());
  if (!m || Number(m[2]) < 1 || Number(m[2]) > F.ROWS) return null;
  return F.cellCentre(m[1].toUpperCase().charCodeAt(0) - 65, Number(m[2]) - 1);
}

// "spray N8" / "left" / "none" -> one action
function parsePress(text) {
  const line = text.trim().split("\n").pop().toLowerCase();
  const spray = /spray\s+([a-p]\d{1,2})/.exec(line);
  if (spray && cellPoint(spray[1])) return { buttons: [], click: cellPoint(spray[1]) };
  const drive = /\b(up|down|left|right)\b/.exec(line);
  return { buttons: drive ? [drive[1]] : [], click: null };
}

// "right 24; spray N8 15; wait 6" -> [{ buttons, click, ticks }, ...]
function parsePlan(text) {
  const steps = [];
  for (const part of text.trim().split("\n").pop().toLowerCase().split(";")) {
    const spray = /spray\s+([a-p]\d{1,2})\s+(\d+)/.exec(part), other = /\b(up|down|left|right|wait)\s+(\d+)/.exec(part);
    if (spray && cellPoint(spray[1])) steps.push({ buttons: [], click: cellPoint(spray[1]), ticks: Math.min(Number(spray[2]), 240) });
    else if (other) steps.push({ buttons: other[1] === "wait" ? [] : [other[1]], click: null, ticks: Math.min(Number(other[2]), 240) });
  }
  return steps;
}

// Replay a tape with the rules only, to check that a run was recorded faithfully.
function replay(seed, tape, maxTicks) {
  const game = F.newGame({ seed, level: 2, maxTicks });
  for (const action of tape) F.step(game, action);
  return game.score;
}

// Reference rows for the table: the two state-reading bots on the same seeds (no latency).
function reference(seeds, maxTicks) {
  const play = (bot) => seeds.map((seed) => {
    const game = F.newGame({ seed, level: 2, maxTicks });
    while (!game.done) F.step(game, bot(F.getState(game)));
    return game.score;
  });
  return { "bot doing nothing": play(Bots.idleBot), "greedy bot reading state, no delay": play(Bots.greedyBot) };
}

module.exports = {
  name: "Fireline v0", seconds: 60, maxScore: 100, reset: { level: 2 },
  pressHold: 12, planMax: 96,           // paused mode: ticks run per look (one button / one plan)
  livePlan: "commit",                   // live mode: a plan starts when it arrives and runs to its end before the next look
  manual, askPress, askPlan, askAdvice, parsePress, parsePlan, replay, reference,
};
