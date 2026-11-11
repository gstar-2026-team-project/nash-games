# Runner v0: paused vs live

20 s runs (max score 480 ticks), seeds 1, 2, 3, one row = mean of the seeds.
"think" = how long the bot waits before acting, on top of grabbing the frame. "ticks/s" = how fast the live game clock runs (24 = normal).

| mode | bot | ticks/s | think (ms) | mean score | % of max | finished | decisions / run | frame grab (ms) | replay matches |
|---|---|---|---|---|---|---|---|---|---|
| paused | rule | - | any | 480 | 100% | 3/3 | 480 | - | - |
| live | rule | 24 | 0 | 480 | 100% | 3/3 | 250 | 75 | yes |
| live | rule | 24 | 250 | 103 | 21% | 0/3 | 15 | 41 | yes |
| live | rule | 24 | 1000 | 103 | 21% | 0/3 | 5 | 55 | yes |
| live | rule | 24 | 2000 | 103 | 21% | 0/3 | 3 | 73 | yes |
| live | planner | 24 | 0 | 480 | 100% | 3/3 | 251 | 74 | yes |
| live | planner | 24 | 250 | 480 | 100% | 3/3 | 71 | 32 | yes |
| live | planner | 24 | 1000 | 480 | 100% | 3/3 | 20 | 35 | yes |
| live | planner | 24 | 2000 | 136 | 28% | 0/3 | 3 | 69 | yes |
| live | rule | 12 | 0 | 480 | 100% | 3/3 | 502 | 75 | yes |
| live | rule | 12 | 250 | 131 | 27% | 0/3 | 38 | 37 | yes |
| live | rule | 12 | 1000 | 103 | 21% | 0/3 | 9 | 44 | yes |
| live | rule | 12 | 2000 | 103 | 21% | 0/3 | 5 | 47 | yes |
| live | planner | 12 | 0 | 480 | 100% | 3/3 | 497 | 76 | yes |
| live | planner | 12 | 250 | 480 | 100% | 3/3 | 142 | 31 | yes |
| live | planner | 12 | 1000 | 480 | 100% | 3/3 | 39 | 33 | yes |
| live | planner | 12 | 2000 | 480 | 100% | 3/3 | 20 | 38 | yes |
