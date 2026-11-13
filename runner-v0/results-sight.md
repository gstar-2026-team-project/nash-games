# Runner v0: Claude playing from screenshots

The model sees only the 384 px frame (never `env.state()`). 20 s runs, max score 480; one row = mean over its seeds.
press = one action per look; chunk = a timed plan per look; slow = a timed plan from a thinking model; hybrid = chunk + a thinking model leaving notes in parallel.
Models run through `claude -p` (Claude Code subscription), so think time includes its overhead. Run with `node harness/sight.js`.

| agent | model | mode | mean score | % of max | scores | finished | seeds | looks / run | think per look (s) | notes / run | replay matches |
|---|---|---|---|---|---|---|---|---|---|---|---|
| chunk | haiku | paused | 473 | 99% | 460, 480, 480 | 2/3 | 1, 2, 3 | 19 | 1.5 | - | yes |
| press | haiku | paused | 480 | 100% | 480, 480, 480 | 3/3 | 1, 2, 3 | 120 | 1.1 | - | yes |
| slow | sonnet (high) | paused | 480 | 100% | 480, 480, 480 | 3/3 | 1, 2, 3 | 19 | 1.9 | - | yes |
| chunk | haiku | live 24 ticks/s | 182 | 38% | 103, 309, 134 | 0/3 | 1, 2, 3 | 6 | 1.4 | - | yes |
| chunk | haiku | live 12 ticks/s | 304 | 63% | 480, 188, 244 | 1/3 | 1, 2, 3 | 16 | 1.4 | - | yes |
| press | haiku | live 24 ticks/s | 103 | 21% | 103, 103, 103 | 0/3 | 1, 2, 3 | 5 | 0.7 | - | yes |
| press | haiku | live 12 ticks/s | 162 | 34% | 281, 103, 103 | 0/3 | 1, 2, 3 | 14 | 1.0 | - | yes |
| slow | sonnet (high) | live 24 ticks/s | 103 | 21% | 103, 103, 103 | 0/3 | 1, 2, 3 | 3 | 1.1 | - | yes |
| slow | sonnet (high) | live 12 ticks/s | 349 | 73% | 480, 276, 290 | 1/3 | 1, 2, 3 | 12 | 2.6 | - | yes |
