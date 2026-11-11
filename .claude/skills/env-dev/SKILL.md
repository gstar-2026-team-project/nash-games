---
name: env-dev
description: How to build, change, test and ship a realtime game environment in this repository (Runner v0 and later games). Use when changing a game's rules or look, the env API (reset, step, setAction, setPlan, state, tape), the bots, or the paused-vs-live experiment.
---

# Building realtime environments

The games in this repo are **environments for testing AI agents under a clock**. A game is good when it is fun and clear for a person, and when it measures something about agents. Polish matters, but the measurement matters more.

A change is done when it is tested, played by sight, its numbers are re-run, it is committed to `main`, and the game is live on GitHub Pages.

## 0. Lessons so far (read every time, add to it)

- **A bot that reads `env.state()` is not playing.** It measures latency, not vision. Before you say a game works for agents, play it **from screenshots only**: grab a frame, decide from the pixels, act, grab again. Write down what was hard to see.
- **Paused numbers say nothing about live play.** The same bot went from 100% (paused) to 21% (live, 250 ms of thinking). Always report both modes.
- **"Press now" fails for slow thinkers; timed plans work.** Keep `setPlan` working, and test it whenever the loop changes.
- **The real limit is look-ahead.** An agent needs to see roughly 2× its thinking time ahead. When you change speed or screen layout, re-check how far ahead a player can see.
- **Lowering one speed can make a game harder.** Halving obstacle speed made jumps harder, because the jump window shrank. To change time pressure, change the clock (`tps`), not single speeds.
- **Keep it small.** The owner wants code that is simple to read and control: plain JavaScript, no build step, no framework, short files, plain words in comments.

## 1. Where things live

| Part | File | Rule |
|---|---|---|
| Rules | `<game>/game.js` | Pure: `newGame`, `step`, `getState`. No drawing, no timers, no `Math.random` (use the seeded generator). One `step` = one tick = 1/24 s. |
| Screen + API | `<game>/index.html` | Drawing, keyboard, the live clock, and `window.env`. Draws from the game state only. |
| Bots | `<game>/bots.js` | Simple reference agents. Not the thing being tested. |
| Checks | `test.js`, `browser-test.js` | Rules without a browser, then the page in a browser. |
| Experiment | `play.js` → `results.md` | Paused vs live table. |

## 2. The env API is a contract

Other teammates' harnesses may call it. These calls must keep working the same way:

- `reset({ seed, mode, tps, actionDelay, maxTicks })`
- `step(action)`: paused mode only
- `setAction(action)`: live mode, held until the next call
- `setPlan(steps, fromTick)`
- `state()`
- `tape()`

An action is `{ buttons: [...], click: [x, y] | null }`, with buttons from `up down left right space x y`. The screen is 768×768.

If the contract has to change, update the game's README in the same commit and say so in the commit message.

## 3. Checks, in order

```bash
node <game>/test.js            # rules: determinism, beatable, replay
node <game>/browser-test.js    # page: keyboard, clock, click, plans, paused
node <game>/play.js            # experiment, about 5 min; then update the README table
```

- **Replay must match.** A live run's `tape()` replayed in paused mode gives the same score. If not, something in `step` depends on wall time or randomness.
- **Motion by frames, not by eye.** To check movement, step the game in paused mode and save a short strip of frames, for example every 3rd tick around a jump. Look at the strip.
- **The clock is honest.** About 48 ticks in 2 s at `tps` 24 (`browser-test.js` checks this).

## 4. Play it by sight before calling it done

1. Open the page at 768×768 in a real browser (Playwright is fine).
2. In paused mode, play 30 s using only screenshots: no `env.state()`.
3. Do it again in live mode at `tps` 24.
4. Write three lines in the commit or PR: what you could see in time, what you could not, and one change that would help a human or an agent.

## 5. Look and clarity

- The first 10 seconds must explain the game: the thing to react to is obvious, and there is one line of guidance.
- Things to react to need strong, distinct colours and shapes. A model reading a downscaled frame must still tell them apart.
- The score and time text stays readable over everything (it has a panel behind it).
- No decoration that could be confused with something the player must react to.

## 6. Ship

- Commit and push to `main` after each finished, checked change.
- The Pages workflow runs `test.js` and deploys. Open the live link and check that the game loads.
- Add any new game to the table in the root `README.md`.
