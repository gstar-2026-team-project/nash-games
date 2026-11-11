# Runner v0

Game description and results: [root README](../README.md). This page is the reference for running it and for harnesses.

## Run

- Play: open `index.html`. Space = jump, Down = duck, R = restart. URL options: `?seed=3&tps=12&delay=6&mode=paused`.
- Rules check: `node test.js`. Page check: `node browser-test.js`. Paused vs live experiment: `node play.js` (~5 min, writes `results.md`). The last two need `npm install playwright && npx playwright install chromium`.

## Env API (`window.env`)

| call | mode | what it does |
|---|---|---|
| `reset({ seed, mode, tps, actionDelay, maxTicks })` | both | new game; returns the state |
| `step(action)` | paused | advance one tick |
| `setAction(action)` | live | hold this action until the next call |
| `setPlan(steps, fromTick)` | live | timed steps `{ buttons, ticks }`; the part already in the past (since `fromTick`) is skipped |
| `state()` | both | the game as numbers (for bots and debugging) |
| `tape()` | both | every action received, one per tick; replaying it paused reproduces the run |

An action is `{ buttons: [...], click: [x, y] | null }`, buttons from `up down left right space x y`. This game uses `space` and `down`; the rest are logged and ignored. `actionDelay` makes an action land N ticks later.

## Rules (`game.js`)

- 1 tick = 1/24 s. Player 40×60 px (30 px ducking) at x = 150. Jump ≈ 1.1 s, 106 px high.
- Obstacles move 8 px/tick, one every 1.25–2.5 s, box or bar at 50/50. Bars cannot be jumped.
- The ground ruler marks when an obstacle's left edge hits the player (1s = 24 ticks).
