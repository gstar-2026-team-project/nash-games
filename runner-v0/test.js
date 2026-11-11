// Checks on the game rules. No browser needed.  Run:  node test.js
const assert = require("assert");
const Runner = require("./game.js");
const Bots = require("./bots.js");

// Play one game in paused mode (the game waits for every decision).
function play(bot, options) {
  const game = Runner.newGame(options);
  while (!game.done) Runner.step(game, bot(Runner.getState(game)));
  return game;
}

// Play a recorded list of actions (a "tape") back into a fresh game.
function replay(tape, options) {
  const game = Runner.newGame(options);
  for (const action of tape) { if (game.done) break; Runner.step(game, action); }
  return game;
}

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log("ok  " + name); }

check("doing nothing crashes into the first obstacle", () => {
  const g = play(Bots.idleBot, { seed: 1 });
  assert.equal(g.result, "crashed");
  assert.ok(g.score < 24 * 6, "should crash within a few seconds, got " + g.score);
});

check("the rule bot finishes the full 60 s on 50 different seeds", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const g = play(Bots.makeRuleBot(), { seed });
    assert.equal(g.result, "finished", "seed " + seed + " crashed at tick " + g.tick);
    assert.equal(g.score, 24 * 60);
  }
});

check("same seed + same actions = exactly the same game", () => {
  const a = play(Bots.randomBot, { seed: 7 });
  const b = replay(a.log, { seed: 7 });
  assert.equal(b.score, a.score);
  assert.equal(b.result, a.result);
  assert.deepEqual(Runner.getState(b), Runner.getState(a));
});

check("different seeds give different obstacle patterns", () => {
  const a = play(Bots.makeRuleBot(), { seed: 1, maxTicks: 600 });
  const b = play(Bots.makeRuleBot(), { seed: 2, maxTicks: 600 });
  assert.notDeepEqual(Runner.getState(a).obstacles, Runner.getState(b).obstacles);
});

check("ducking does not save you from a box; jumping does not clear a bar", () => {
  // Hold "down" forever: survives bars, dies on the first box.
  const duck = play(() => ({ buttons: ["down"] }), { seed: 1 });
  assert.equal(duck.result, "crashed");
  // Jump into a bar on purpose: put one bar right in front and jump.
  const g = Runner.newGame({ seed: 1 });
  g.nextSpawn = 1e9;
  g.obstacles = [{ kind: "high", x: 200 }];
  let t = 0;
  while (!g.done && t < 40) { Runner.step(g, { buttons: t === 0 ? ["space"] : [] }); t++; }
  assert.equal(g.result, "crashed");
});

check("action delay: the plain rule bot crashes, the delay-aware one does not", () => {
  const delay = 6;   // 6 ticks = 0.25 s
  let plainCrashes = 0, awareCrashes = 0;
  for (let seed = 1; seed <= 20; seed++) {
    if (play(Bots.makeRuleBot(0), { seed, actionDelay: delay }).result === "crashed") plainCrashes++;
    if (play(Bots.makeRuleBot(delay * 8), { seed, actionDelay: delay }).result === "crashed") awareCrashes++;
  }
  console.log("    delay 6 ticks: plain bot crashed " + plainCrashes + "/20, delay-aware bot " + awareCrashes + "/20");
  assert.ok(plainCrashes > 10);
  assert.equal(awareCrashes, 0);
});

check("unknown buttons and clicks are accepted and logged, but change nothing", () => {
  const a = play(Bots.makeRuleBot(), { seed: 3, maxTicks: 300 });
  const extra = (s) => {
    const act = Bots.makeRuleBot()(s);
    return { buttons: act.buttons.concat(["x", "left"]), click: [100, 200] };
  };
  const b = play(extra, { seed: 3, maxTicks: 300 });
  assert.equal(b.score, a.score);
  assert.deepEqual(b.log[0].click, [100, 200]);
});

// Simulate live play without a browser: the bot sees the game at tick t, its answer
// arrives `lag` ticks later, and until then the previous answer keeps running.
function playLive(kind, lag, options) {
  const game = Runner.newGame(options);
  const rule = Bots.makeRuleBot(), planner = Bots.makePlannerBot();
  let plan = [], next = null, arriveAt = 0;
  while (!game.done) {
    if (!next) {                                        // start "thinking" about the current frame
      const s = Runner.getState(game);
      next = kind === "rule" ? [{ buttons: rule(s).buttons, ticks: Infinity }] : planner(s);
      arriveAt = game.tick + lag;
    }
    if (game.tick >= arriveAt) {                        // the answer arrives
      plan = next.map((x) => ({ ...x })); next = null;
      if (kind === "plan") {                            // skip the part of the plan already in the past
        let late = lag;
        while (late > 0 && plan.length) { const c = Math.min(late, plan[0].ticks); plan[0].ticks -= c; late -= c; if (plan[0].ticks <= 0) plan.shift(); }
      }
    }
    while (plan.length && plan[0].ticks <= 0) plan.shift();
    const buttons = plan.length ? plan[0].buttons : [];
    if (plan.length) plan[0].ticks -= 1;
    Runner.step(game, { buttons });
  }
  return game;
}

check("live with thinking lag: the rule bot falls apart, the planner bot copes", () => {
  for (const lag of [6, 24, 48]) {            // 0.25 s, 1 s, 2 s
    let rule = 0, plan = 0;
    for (let seed = 1; seed <= 20; seed++) {
      rule += playLive("rule", lag, { seed }).score;
      plan += playLive("plan", lag, { seed }).score;
    }
    const pct = (x) => Math.round((100 * x) / (20 * 24 * 60)) + "%";
    console.log("    lag " + lag + " ticks: rule bot " + pct(rule) + " of max, planner " + pct(plan));
    assert.ok(plan > rule);
  }
});

console.log(passed + " checks passed");
