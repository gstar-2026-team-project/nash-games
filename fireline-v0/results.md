# Fireline v0: paused vs live (state-reading bot)

60 s runs at level 2, seeds 1, 2, 3. Score = percent of the town still standing (0 to 100).

Rerun after the Canvas artwork refresh on Windows using Microsoft Edge (Chromium). Live runs include screenshot and browser overhead in addition to the stated thinking delay; changes from the earlier table also reflect the host and browser.

"think" = how long the bot waits before acting. press = one action held until the next answer; plan = a timed list of steps.

| mode | bot asked for | think (ms) | mean score | scores | decisions / run | replay matches |
|---|---|---|---|---|---|---|
| paused | nothing (idle bot) | - | 45 | 40, 43, 53 | - | - |
| paused | press | any | 97 | 97, 97, 97 | 1440 | - |
| live | press | 0 | 90 | 87, 89, 93 | 453 | yes |
| live | press | 250 | 86 | 84, 82, 91 | 159 | yes |
| live | press | 1000 | 64 | 53, 59, 80 | 55 | yes |
| live | press | 2000 | 58 | 57, 46, 71 | 29 | yes |
| live | press | 4000 | 52 | 52, 43, 60 | 15 | yes |
| live | plan | 0 | 82 | 63, 91, 92 | 29 | yes |
| live | plan | 250 | 83 | 70, 88, 92 | 21 | yes |
| live | plan | 1000 | 77 | 73, 71, 89 | 17 | yes |
| live | plan | 2000 | 68 | 62, 69, 74 | 14 | yes |
| live | plan | 4000 | 55 | 55, 44, 66 | 10 | yes |
