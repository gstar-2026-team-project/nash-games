# Fireline v0: Claude playing from screenshots

The model sees only the 384 px frame (never `env.state()`). 60 s runs, max score 100; one row = mean over its seeds.

These baseline runs used the earlier graphics, before the truck, flame and town artwork was refreshed. The rules are unchanged, but these scores do not measure the refreshed graphics.

press = one action per look; chunk = a timed plan per look; slow = a timed plan from a thinking model; hybrid = chunk + a thinking model leaving notes in parallel.
Models run through `claude -p` (Claude Code subscription), so think time includes its overhead. Run with `node harness/sight.js`.

| agent | model | mode | mean score | % of max | scores | finished | seeds | looks / run | think per look (s) | notes / run | replay matches |
|---|---|---|---|---|---|---|---|---|---|---|---|
| chunk | haiku | live 24 ticks/s | 57 | 57% | 52, 55, 65 | 3/3 | 1, 2, 3 | 9 | 3.7 | - | yes |
| press | haiku | live 24 ticks/s | 59 | 59% | 52, 65, 62 | 3/3 | 1, 2, 3 | 38 | 1.3 | - | yes |
| hybrid | haiku + opus (high) | live 24 ticks/s | 53 | 53% | 52, 45, 61 | 3/3 | 1, 2, 3 | 9 | 3.1 | 11 | yes |
| slow | opus (high) | live 24 ticks/s | 55 | 55% | 52, 45, 69 | 3/3 | 1, 2, 3 | 9 | 3.9 | - | yes |
| chunk | haiku | paused | 78 | 78% | 79, 63, 93 | 3/3 | 1, 2, 3 | 19 | 2.4 | - | yes |
| press | haiku | paused | 87 | 87% | 86, 85, 89 | 3/3 | 1, 2, 3 | 120 | 1.1 | - | yes |
| bot doing nothing | - | paused | 45 | 45% | 40, 43, 53 | - | 1, 2, 3 | - | - | - | - |
| greedy bot reading state, no delay | - | paused | 97 | 97% | 97, 97, 97 | - | 1, 2, 3 | - | - | - | - |
