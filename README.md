# Nash's game environments

Game environments for the GStar Bootcamp 2026 team project (LLMs that sense, think and act in realtime).

## Game: Runner v0

[Play it](https://gstar-2026-team-project.github.io/nash-games/runner-v0/) · [code and env API](runner-v0/README.md)

The player runs on its own. Jump over **red boxes** (Space), duck under **orange bars** (hold Down). Score = ticks survived; touching anything ends the run. Screen 768×768, 24 ticks per second.

The game runs in two modes:
- **Paused:** the game freezes after every frame and waits for the agent. Thinking is free.
- **Live:** the game keeps running while the agent thinks. One second of thinking = 24 ticks closer to the next obstacle.

| start | jump | duck | crash |
|---|---|---|---|
| ![](runner-v0/screenshots/1-start.png) | ![](runner-v0/screenshots/2-jump.png) | ![](runner-v0/screenshots/3-duck.png) | ![](runner-v0/screenshots/4-crash.png) |

## Results

| agent | paused | live, 24 ticks/s |
|---|---|---|
| bot reading state, presses now, 0.25 s thinking | 100% | 21% |
| bot reading state, sends a timed plan, 1 s thinking | 100% | 100% |
| Claude from screenshots only, timed plans, ~8.5 s per decision | 100% | crashed at the first obstacle |

21% = crashed at the first obstacle. Paused hides the problem; live, a slow agent fails unless it plans ahead, and an obstacle is visible only ~2.7 s before it hits. Bots: 20 s runs, seeds 1–3 ([full table](runner-v0/results.md)). Claude: one 30 s run, seed 5.

## Gaps this can fill

- Most game-agent results are reported paused. This game measures the same agent paused and live.
- Action chunking (timed plans) has not been tested for LLM game agents. The env supports it directly (`setPlan`).
- Few realtime tasks use pixels and low-level buttons while staying easy for humans.
- Post-training against a live clock is open. Seeded games and replayable action tapes make rollouts cheap.

## Open questions

- How fast must a pixel-reading model be to survive live with timed plans? (Real API latency, not a tool loop.)
- How much does the on-screen time ruler help a model reading frames?
- Which clock for training: wall clock, or a reproducible token clock / latency injection?
