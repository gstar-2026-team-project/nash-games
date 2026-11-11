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
| Claude from screenshots only, timed plans, ~8.5 s per decision while first obstacle ~2.1s | 100% | crashed at the first obstacle |

21% = crashed at the first obstacle. Paused hides the problem; live, a slow agent fails unless it plans ahead, and an obstacle is visible only ~2.7 s before it hits. Bots: 20 s runs, seeds 1–3 ([full table](runner-v0/results.md)). Claude: one 30 s run, seed 5.

## Open questions

- How fast must a pixel-reading model be to survive live with timed plans? (Real API/Inference latency.)
- How much does the on-screen time ruler help a model reading frames?
- Which clock for training: wall clock, or a reproducible token clock / latency injection?

## Literature review (short)

A short version for this repo. Also, Huikang provided very comprehensive review in [huikang-literature-review](https://github.com/gstar-2026-team-project/huikang-literature-review).

**1. The loop.** A game do like computer-use agent runs *frame → think → action*, again and again.

**2. The problem.** Most benchmarks let the world wait while the model thinks. A real game does not: at 24 FPS, 2 s of thinking means 48 frames missed.

**3. How people deal with it.**

| idea | how | example |
|---|---|---|
| Think less | reason only at key moments, act directly otherwise | [Game-TARS](https://arxiv.org/abs/2510.23691) (sparse thinking). On Doom, no thinking scored 13.2 and thinking every step 7.2 |
| Don't think | map video straight to actions, no LLM | [VPT](https://arxiv.org/abs/2206.11795), [FDM-1](https://si.inc/posts/fdm1/) (company claims only) |
| Two loops | a reasoning model plans in the background; a fast non-reasoning model acts before each deadline | AgileThinker in [RealtimeGym](https://arxiv.org/abs/2511.04898): under rising time pressure 0.90 → 0.58, vs planning alone 0.92 → 0.05 |
| Action chunking | send a short plan, keep thinking while it runs | [Real-time chunking](https://arxiv.org/abs/2506.07339) (robotics): robots keep working with over 300 ms of model latency |

**4. How results are measured.**
- **Paused:** the game waits for every action. Game-TARS, VPT and SpeedrunBench (scored in frames, its main results are offline action tapes) run this way.
- **Live:** the game moves on while the model thinks, by wall clock or by a token budget (RealtimeGym uses text observations and a token clock).
- The gap between the two is the cost of thinking time. Runner v0 measures both for the same agent.

**5. Gaps this game can fill.**
- Most game-agent results are paused. Live results with **pixels** and low-level buttons on tasks that are easy for humans are rare.
- Action chunking has not been tested for LLM game agents. The env supports it directly (`setPlan`).
- Post-training against a live clock is open.
