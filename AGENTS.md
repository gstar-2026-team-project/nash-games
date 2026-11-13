# AGENTS.md

Guidance for coding agents working in this repository.

## What this is

Realtime game environments for testing AI agents under a clock (GStar Bootcamp 2026 team project). Each game lives in its own folder: `runner-v0/` (jump and duck; the simple calibration task) and `fireline-v0/` (drive a fire truck and spray with the mouse while fires spread; the general task). `harness/` lets a Claude model, or a subagent, play any of them from screenshots. The point of a game is to **measure** agents: the same agent is run in **paused** mode (game waits for each action) and **live** mode (game keeps ticking while the agent thinks), and the gap between the two is the result. The root `README.md` holds the results table and a short literature review; each game's `README.md` is its env API reference.

The detailed workflow and hard-won lessons are in `.claude/skills/env-dev/SKILL.md` — read it before changing a game, its env API, the bots, or the experiment.

## Commands

No `package.json`, no build step, no linter. Plain JavaScript, run from inside the game folder:

```bash
cd runner-v0            # or fireline-v0
node test.js            # rules only, no browser (determinism, beatable, tape replay). CI runs this.
node browser-test.js    # page check in Chromium: keyboard, mouse, live clock, setPlan, paused
node play.js            # paused-vs-live experiment with the state-reading bot, 5 to 12 min, rewrites results.md
```

A Claude model playing from screenshots (uses the Claude Code subscription through `claude -p`, no API key), run from the repo root:

```bash
node harness/sight.js fireline-v0 --agents chunk,press,hybrid,slow --modes 24,paused --seeds 1,2,3   # appends to sight-runs.jsonl, rewrites results-sight.md
node harness/sight.js fireline-v0 --agents table                                                      # only rebuild the table from the log
node harness/sight-server.js fireline-v0 /some/folder/for/pngs 8765                                    # play by sight over HTTP (for subagents)
```

Run one harness job at a time: they share the same model latency, and a second job slows the first one's live runs.

`browser-test.js` and `play.js` need Playwright: `npm install --no-save playwright && npx playwright install chromium`. With no `package.json` here, npm installs into the nearest parent that has one (e.g. `~/node_modules`); reinstall the browser if Playwright was upgraded.

There is no single-test selector; `test.js` is a flat script of asserts — comment out or copy the case you need.

Play locally by opening `<game>/index.html`. URL options: `?seed=3&tps=12&delay=6&mode=paused` (Fireline also takes `level=1..3`). A person's finished runs are listed under the game (kept in the browser), which is how the human baseline is collected.

## Architecture

Each game is split so the rules are deterministic and shared between Node and the browser:

- `game.js` — **pure rules**: `newGame`, `step`, `getState`. No drawing, no timers, no `Math.random` (seeded generator only). One `step` = one tick = 1/24 s. Exports via `module.exports` in Node and `window.Runner` in the browser.
- `index.html` — drawing, keyboard, the live wall-clock loop, and `window.env`. Draws only from game state. Loads `game.js` with a plain `<script>` tag.
- `bots.js` — simple reference agents (`idleBot`, `randomBot`, `makeRuleBot`, `makePlannerBot` — the planner returns `setPlan` steps instead of one action) that read `state()`; used by tests and the experiment, not the thing under test. Same dual Node/browser export pattern.
- `test.js` / `browser-test.js` / `play.js` — rules check, page check, experiment → `results.md`.
- `sight-config.js` — what a model is told when it plays from screenshots (the manual, the questions), how its short text answers become actions, and how live plans are used (`livePlan`: `"timed"` for Runner, `"commit"` for Fireline).

`harness/` is shared by all games: `claude-session.js` (one long-lived headless Claude process), `sight.js` (the experiment: agents `press`, `chunk`, `slow`, `hybrid`; paused and live), `sight-server.js` (the same loop over HTTP, so a subagent can play with curl and Read).

Because `step` is pure and seeded, a live run's `tape()` replayed in paused mode must reproduce the same score. If it doesn't, something in `step` depends on wall time or randomness.

### The env API is a contract

Teammates' harnesses call `window.env`; keep these working unchanged: `reset({ seed, mode, tps, actionDelay, maxTicks })`, `step(action)` (paused), `setAction(action)` (live, held until next call), `setPlan(steps, fromTick)` (live, timed `{ buttons, ticks }` steps; the past part is skipped), `state()`, `tape()`. An action is `{ buttons: [...], click: [x, y] | null }`, buttons from `up down left right space x y`. Screen is 768×768. In Fireline the click is held (the mouse button is down at that point for the tick) and plan steps may carry it: `{ buttons, click, ticks }`; `reset` also takes `level`. If the contract must change, update the game's README in the same commit and say so in the commit message.

`setPlan` returns "ok" even after the game ended — harnesses must check `state().done`.

## Deploy

Pushing to `main` triggers `.github/workflows/pages.yml`: it runs `node test.js` in `runner-v0`, and in `fireline-v0`, then copies `.github/pages/index.html` (landing page) plus each game's `index.html` and `game.js` to GitHub Pages. A new game, or any new file a page loads, must be added to the "Collect the site" step and to the landing page / root README table.

## Conventions

- Keep it small and readable: plain JS, no framework, no build step, short files, plain-language comments.
- Report agent results in **both** paused and live modes; paused numbers alone say nothing about live play.
- A bot reading `env.state()` measures latency, not vision. Before claiming a game works for agents, play it from screenshots only (downscaled to ~384 px), paused and live — see the env-dev skill §4.
- To change time pressure, change the clock (`tps`), not individual speeds.
- In the browser, all script files share one global scope: `bots.js` must not declare the same top-level name as `game.js` (Fireline's bots use `Rules`).
