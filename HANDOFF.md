# Handoff: Fireline v0 and the screenshot baseline

Written 2026-11-13 for the next Claude Code session. Delete this file when the work below is done; do not commit it.

## The goal

The owner (Nhat) set this goal, and it is still open:

> Keep refining, implementing, and playing the game with subagents until you are satisfied and ready to show it.

"Ready to show" means: Fireline is clear to play, the baseline tables are measured on the final version, the READMEs tell the story, and everything is committed locally.

Context: GStar Bootcamp team project, "LLMs that sense, think and act in realtime". The team asked each member for one or two more games and baseline performance before choosing a toy task. The owner wants a **general game for exploring model ability and agent architecture**, not a tightly controlled benchmark.

## How the owner wants you to work

- Reply in Vietnamese. Code, comments and READMEs stay in plain English.
- Agree the plan before building; ask until it is clear. Think broadly; do not shrink scope to fit a time budget.
- **Use Haiku and Opus only** (to save tokens). Haiku is the fast role, Opus the slow role. No Sonnet.
- Use the Claude Code subscription, not an API key: `claude -p` for the scripted harness, and subagents (Agent tool with `model`) for play-testing by sight.
- Commit locally. **Do not push** until the owner has looked. Nothing is committed yet.
- Do not run harness jobs or subagents for teammates' games; that is their work.
- Read `AGENTS.md` and `.claude/skills/env-dev/SKILL.md` first.

## What exists (all uncommitted)

| path | what it is | state |
|---|---|---|
| `fireline-v0/` | New game. Top-down town, fires spread with the wind, drive with arrows, spray with the mouse, refill at hydrants. Score = percent of the town standing. | `node test.js` and `node browser-test.js` pass on the final rules |
| `fireline-v0/sight-config.js` | The manual a model is given, the answer formats, parsers | current |
| `fireline-v0/results.md`, `screenshots/` | Bot paused-vs-live table and example frames | **stale**: made before the last rule and picture changes |
| `harness/sight.js` | A Claude model plays from 384 px screenshots through `claude -p`. Agents: `press`, `chunk`, `slow`, `hybrid`. Flags `--fast haiku --slow opus` | works; default slow model is now Opus |
| `harness/sight-server.js` | Local HTTP server (`/manual`, `/reset`, `/shot`, `/plan`) so a subagent can play by sight with curl and Read | works |
| `harness/claude-session.js` | One long-lived `claude -p` process (stream-json, no tools) | works; about 1 s per look for Haiku when warm |
| `runner-v0/sight-config.js`, `results-sight.md`, `sight-runs.jsonl` | Runner v0 played from screenshots, 27 runs | done (slow role there was Sonnet, before the Haiku + Opus rule) |
| `runner-v0/index.html` | Added a "Your runs" line under the game for the human baseline | tests pass |
| `.github/workflows/pages.yml`, `.github/pages/index.html` | Fireline added to the test step, the site copy and the landing page | not yet exercised (no push) |

No background jobs or servers are running.

## Results so far

**Runner v0 from screenshots** (Haiku for press and chunk; mean of seeds 1–3, max 480):

| agent | paused | live 12 ticks/s | live 24 ticks/s |
|---|---|---|---|
| press | 480 | 162 | 103 |
| chunk | 473 | 304 | 182 |
| slow (Sonnet, thinking) | 480 | 349 | 103 |

103 = crashed at the first obstacle.

**Fireline, subagents playing by sight** (60 s game, level 2; one paused and one live game each):

| round | model | paused | live 24 ticks/s |
|---|---|---|---|
| 1 (seed 4 both) | Sonnet | 94 | 63 |
| 1 (seed 4 both) | Opus | 91 | 63 |
| 2 (paused seed 5, live seed 6) | Haiku | 95 | 39 |
| 2 (paused seed 5, live seed 6) | Opus | 90 | 39 |

For scale on seeds 1–3: the idle bot keeps about 45, the greedy state-reading bot about 91 paused. The two rounds used different live seeds, so they are not comparable with each other. Subagents take 7–15 s per look, so live was 6–17 looks per game.

**Fireline, `claude -p` harness**: only partial runs on older pictures, kept in `/tmp/fireline-first-pass.jsonl` and `/tmp/fireline-second-pass-replace.jsonl` (may be gone after a reboot). Haiku live at 24 ticks/s scored about 40–65, close to idle. Do not report these; rerun.

## What was learned (add the durable ones to the env-dev skill, §0)

- **Short reasoning puzzles do not separate fast from slow models.** Haiku solved 10-step arithmetic chains and robot-turn puzzles at 15/16 or better in about 1.2 s. The bottleneck for Claude is about 1 s per look, not reasoning depth. A "puzzle gate" design was dropped for this reason.
- **A score that degrades smoothly tells more than instant death.** In Runner every slow agent dies at the first obstacle; in Fireline the bot's score falls step by step with delay (97 at 0 ms, 78 at 250 ms, 60 at 1 s, 53 at 4 s, press style).
- **A plan made from an old frame must not overtake the truck.** With `setPlan(steps, fromTick)` in Fireline, the state-reading planner bot scored the same as idle from 1 s of thinking. Skipping the "past" part desyncs a plan that is relative to where the truck stood. Fireline's harness now uses `livePlan: "commit"`: the plan starts on arrival and the next look waits until it has finished. Runner keeps `"timed"`. The fix is in place but **not yet verified by a rerun**.
- **Models misname cells inside a block.** Printing names on every street, on each fire, and on the truck fixed the reports of off-by-one columns. Check this again in the next play-test.
- **Refill while spraying gave unlimited water.** Now the tank does not refill while the mouse is held.
- In the browser, `bots.js` must not redeclare the name `game.js` declares (`const Fireline`); it uses `Rules`.
- Scripts outside the repo need `NODE_PATH=/Users/anhnhat/node_modules` to find Playwright.

## What is left, in order

1. **Rerun the Fireline bot experiment**: `cd fireline-v0 && node play.js` (about 12 min, no tokens). Check that the "plan" rows now beat idle at 1 s and more. If they do not, the commit protocol in `play.js` needs another look before anything else.
2. **Run the Fireline screenshot baseline on the final version** (Haiku fast, Opus slow), one job at a time so latencies are not disturbed:
   `node harness/sight.js fireline-v0 --agents chunk,press,hybrid,slow --modes 24,paused --seeds 1,2,3`
   Opus runs are the costly part; two seeds for `slow` and `hybrid` in paused mode are enough. Consider `--modes 12` if live 24 is still near idle.
3. **One more subagent play-test round** (Haiku and Opus) on the final picture, mainly to confirm the cell-name fix and to try live play at a lower `tps`. Start the server with `node harness/sight-server.js fireline-v0 <png folder> 8765`; the prompt used before told the subagent to use only curl and Read on the returned PNGs, never the source.
4. **Human baseline**: ask the owner to play Fireline and Runner a few times each; scores appear under the game.
5. **Docs**: add Fireline to the root `README.md` (game description, screenshots, the results tables, what paused vs live shows); add the new lessons to the env-dev skill; update `AGENTS.md` for the second game and the `harness/` folder.
6. **Commit locally**, in sensible pieces. Then show the owner and ask before pushing.
7. **Proposal**: a short paragraph for section 2.1 on how results are measured (paused vs live on the same agent) and on wanting tasks where a slower agent loses gradually. The owner asked for this earlier; it has not been written.

## Open questions for the owner

- Is level 2 the right default, or should the baseline also report level 3 (greedy bot about 71, idle about 2 over 90 s)?
- Live at 24 ticks/s is near idle for every Claude setup tried so far. Report it as the headline gap, or add a slower clock as the main live setting?
