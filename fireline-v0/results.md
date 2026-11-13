# Fireline v0: paused vs live (state-reading bot)

60 s runs at level 2, seeds 1, 2, 3. Score = percent of the town still standing (0 to 100).
"think" = how long the bot waits before acting. press = one action held until the next answer; plan = a timed list of steps.

| mode | bot asked for | think (ms) | mean score | scores | decisions / run | replay matches |
|---|---|---|---|---|---|---|
| paused | nothing (idle bot) | - | 45 | 40, 43, 53 | - | - |
| paused | press | any | 97 | 97, 97, 97 | 1440 | - |
| live | press | 0 | 96 | 95, 97, 97 | 1189 | yes |
| live | press | 250 | 87 | 84, 87, 91 | 206 | yes |
| live | press | 1000 | 63 | 57, 64, 68 | 58 | yes |
| live | press | 2000 | 59 | 64, 49, 65 | 30 | yes |
| live | press | 4000 | 51 | 52, 43, 58 | 15 | yes |
| live | plan | 0 | 90 | 78, 97, 94 | 50 | yes |
| live | plan | 250 | 82 | 62, 93, 92 | 22 | yes |
| live | plan | 1000 | 76 | 68, 70, 90 | 19 | yes |
| live | plan | 2000 | 74 | 66, 70, 86 | 14 | yes |
| live | plan | 4000 | 55 | 56, 42, 66 | 10 | yes |
