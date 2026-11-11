# Nash's game environments

Game environments for the GStar Bootcamp 2026 team project (LLMs that sense, think and act in realtime).

| Folder | Game | Play on the web |
| --- | --- | --- |
| [`runner-v0/`](runner-v0/) | **Runner v0**: jump over boxes, duck under bars. A tiny game for testing the env interface: paused mode (the game waits for the agent) and live mode (24 ticks per second, the game does not wait), plus timed plans and action delay. | [runner-v0/](https://gstar-2026-team-project.github.io/nash-games/runner-v0/) |

## First result: reading state vs reading screenshots

- **Paused:** the game freezes after every frame and waits until the agent answers. Thinking time is free, like a turn-based game. Most published game-agent results run this way.
- **Live:** the game keeps running at 24 ticks per second while the agent thinks. Each second of thinking moves the world 24 ticks closer to the next obstacle.

| what the agent sees | paused | live, 24 ticks/s |
|---|---|---|
| **state numbers** (`env.state()`), planner bot | 100% | **100%** |
| **screenshot only** (Claude Code, 384 px frames) | 100% | **crashed at the first obstacle** |

Paused hides the problem: both agents are perfect when the game waits. Live, the screenshot player took ~8.5 s per decision and saw obstacles only ~2.7 s ahead. One seed, one run per cell; details and caveats in [`runner-v0/README.md`](runner-v0/README.md#headline-reading-state-vs-reading-screenshots).

No dependencies for the game itself: open `runner-v0/index.html` in a browser, or run `node runner-v0/test.js` to check the rules. See [`runner-v0/README.md`](runner-v0/README.md) for the interface and the first paused-vs-live results.

Every push to `main` runs the tests and deploys to GitHub Pages through [`.github/workflows/pages.yml`](.github/workflows/pages.yml).
