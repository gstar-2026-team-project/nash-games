# Runner v0: paused vs live

20 s runs (max score 480 ticks), seeds 1, 2, 3, one row = mean of the seeds.
"think" = how long the bot waits before acting, on top of grabbing the frame. "ticks/s" = how fast the live game clock runs (24 = normal).

| mode | bot | ticks/s | think (ms) | mean score | % of max | finished | decisions / run | frame grab (ms) | replay matches |
|---|---|---|---|---|---|---|---|---|---|
| paused | rule | - | any | 480 | 100% | 3/3 | 480 | - | - |
| live | rule | 24 | 0 | 480 | 100% | 3/3 | 386 | 45 | yes |
| live | rule | 24 | 250 | 103 | 21% | 0/3 | 16 | 35 | yes |
| live | rule | 24 | 1000 | 103 | 21% | 0/3 | 5 | 32 | yes |
| live | rule | 24 | 2000 | 103 | 21% | 0/3 | 3 | 49 | yes |
| live | planner | 24 | 0 | 480 | 100% | 3/3 | 384 | 46 | yes |
| live | planner | 24 | 250 | 480 | 100% | 3/3 | 72 | 26 | yes |
| live | planner | 24 | 1000 | 480 | 100% | 3/3 | 20 | 31 | yes |
| live | planner | 24 | 2000 | 136 | 28% | 0/3 | 3 | 56 | yes |
| live | rule | 12 | 0 | 480 | 100% | 3/3 | 796 | 43 | yes |
| live | rule | 12 | 250 | 229 | 48% | 1/3 | 70 | 25 | yes |
| live | rule | 12 | 1000 | 103 | 21% | 0/3 | 9 | 39 | yes |
| live | rule | 12 | 2000 | 103 | 21% | 0/3 | 5 | 69 | yes |
| live | planner | 12 | 0 | 480 | 100% | 3/3 | 796 | 43 | yes |
| live | planner | 12 | 250 | 480 | 100% | 3/3 | 146 | 23 | yes |
| live | planner | 12 | 1000 | 480 | 100% | 3/3 | 39 | 30 | yes |
| live | planner | 12 | 2000 | 480 | 100% | 3/3 | 20 | 41 | yes |
