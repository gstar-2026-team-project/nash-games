# Fireline v0

Game description and results: [root README](../README.md). This page is the reference for running it and for harnesses.

## Run

- Play: open `index.html`. Arrow keys = drive, hold the mouse button = spray, R = next town. URL options: `?seed=3&level=2&tps=12&delay=6&mode=paused`.
- Rules check: `node test.js`. Page check: `node browser-test.js`. Paused vs live with the state-reading bot: `node play.js` (~12 min, writes `results.md`). The last two need `npm install playwright && npx playwright install chromium`.
- A Claude model playing from screenshots: `node ../harness/sight.js .` (writes `results-sight.md`). Playing by sight yourself, or with a subagent: `node ../harness/sight-server.js . <folder for PNGs>`.

## Display

The town and truck are drawn with Canvas shapes; no image assets or build step are needed. Flames, smoke, emergency lights and water splashes animate from the game tick, so paused screenshots stay still. Fire names remain above the water jet, smoke stays inside its cell, and wind arrows have dark corner badges to separate them from the flames.

## Env API (`window.env`)

Same contract as Runner v0, with one addition: an action's `click` is **held**, and plan steps can carry it.

| call | mode | what it does |
|---|---|---|
| `reset({ seed, mode, tps, actionDelay, maxTicks, level })` | both | new town; returns the state. `level` 1 to 3 (default 2) |
| `step(action)` | paused | advance one tick |
| `setAction(action)` | live | hold this action (buttons and click) until the next call |
| `setPlan(steps, fromTick)` | live | timed steps `{ buttons, click, ticks }`; the part already in the past (since `fromTick`) is skipped |
| `state()` | both | the game as numbers (for bots and debugging) |
| `tape()` | both | every action received, one per tick; replaying it paused reproduces the run |

An action is `{ buttons: [...], click: [x, y] | null }`, buttons from `up down left right space x y`. This game uses the four arrows and the click; the rest are logged and ignored. `click: [x, y]` means "the mouse button is down at this screen point during this tick". `actionDelay` makes an action land N ticks later.

## Rules (`game.js`)

- 1 tick = 1/24 s. A run is 90 s by default. Score = percent of all house hp still standing (0 to 100), so damage counts, not only ruins.
- The town is a 16×14 grid of 48 px cells under a 96 px strip. Streets are columns A, F, K, P and rows 1, 5, 10, 14; the blocks between hold houses, trees and empty yards (seeded).
- The truck drives on streets only, one cell per 12 ticks. A move always ends on a cell.
- Water reaches 3.5 cells from the truck. A click further away lands at the end of the reach. Spraying costs 1 water per tick (tank 120). A burning cell loses 3 fire per tick; at 0 it is out and soaked. Spraying a cell that is not burning cools and soaks it; a soaked cell cannot heat up for 10 s.
- Parked on a hydrant or one of the 8 cells around it (3 hydrants per town), and not spraying, the tank refills 3 per tick.
- A fire starts at 10, grows 0.4 per tick up to 100, and burns hp in proportion. It heats its four neighbours: ×2.5 downwind, ×1 sideways, ×0.4 upwind; downwind it also reaches across one street or yard (×0.6). A house catches fire at heat 100, a tree at 60 (and a tree has less to burn).
- New fires start on a schedule (level 2: about every 6 to 9 s). The wind turns every 15 to 25 s.
- Nothing kills the truck. Being slow costs houses, a little at a time.

## State (`env.state()`)

`{ tick, score, done, result, level, truck: { col, row, moving, x, y }, water, refilling, blocked, wind: "N" | "E" | "S" | "W", hydrants: [{ col, row }], burning: [{ col, row, fire }], map: [16-character string per row], actionDelay }`. Map letters: `.` street, `,` yard, `H` house, `T` tree, `F` burning, `x` burnt, `w` soaked. The wind letter is where the wind blows **to**.
