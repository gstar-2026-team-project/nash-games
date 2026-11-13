// Drive the game in a real (headless) browser, the way an agent would.  Run:  node play.js
//
// It answers one question: how much does thinking time hurt when the fire does not wait?
//   paused mode : the game waits for every decision.
//   live mode   : the game runs at 24 ticks per second; the bot "thinks" for N ms per decision.
// One bot (greedy: nearest fire first, refill when low), asked in two ways:
//   press : "what do I do right now?"            -> env.setAction, held until the next answer
//   plan  : "what do I do over the next seconds?" -> env.setPlan, a timed list of steps; the bot looks
//           again only when the plan is done (a plan made from an old frame must not overtake the truck)
// Only the waiting and the way of asking change.
//
// Output: screenshots/ (example frames) and results.md (the table).

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const F = require("./game.js");
const Bots = require("./bots.js");

const PAGE = "file://" + path.join(__dirname, "index.html");
const SECONDS = 60;                       // length of each run
const LEVEL = 2;
const SEEDS = [1, 2, 3];
const THINK_MS = [0, 250, 1000, 2000, 4000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Paused: one decision per tick, as slow as we like. `shots` = { tick: file name } frames to save.
async function runPaused(browser, seed, bot, shots) {
  const page = await browser.newPage({ viewport: { width: 768, height: 768 } });
  await page.goto(PAGE);
  let state = await page.evaluate((o) => env.reset(o), { seed, level: LEVEL, mode: "paused", maxTicks: SECONDS * 24 });
  while (!state.done) {
    state = (await page.evaluate((a) => env.step(a), bot(state))).state;
    if (shots && shots[state.tick]) await page.locator("canvas").screenshot({ path: path.join(__dirname, "screenshots", shots[state.tick]) });
  }
  await page.close();
  return state.score;
}

// Live: grab a frame, think, act. Meanwhile the fire keeps going.
async function runLive(browser, { seed, thinkMs, ask }) {
  const page = await browser.newPage({ viewport: { width: 768, height: 768 } });
  await page.goto(PAGE);
  await page.evaluate((o) => env.reset(o), { seed, level: LEVEL, mode: "live", maxTicks: SECONDS * 24 });
  let decisions = 0, state;
  while (true) {
    await page.screenshot();                          // what an LLM agent would receive (not used by this bot)
    state = await page.evaluate(() => env.state());   // what this simple bot actually reads
    if (state.done) break;
    const answer = ask === "press" ? Bots.greedyBot(state) : Bots.greedyPlan(state, thinkMs * 24 / 1000);   // the planner knows its own delay
    await sleep(thinkMs);                             // pretend to think (an LLM call would go here)
    if (ask === "press") await page.evaluate((a) => env.setAction(a), answer);
    else {
      await page.evaluate((p) => env.setPlan(p), answer);
      await sleep(Math.min(answer.reduce((sum, s) => sum + s.ticks, 0), 144) * 1000 / 24);  // at most 6 s per plan
    }
    decisions += 1;
  }
  const tape = await page.evaluate(() => env.tape());
  await page.close();
  const replay = F.newGame({ seed, level: LEVEL, maxTicks: SECONDS * 24 });   // the tape must reproduce the run
  for (const action of tape) F.step(replay, action);
  return { score: state.score, decisions, replayMatches: replay.score === state.score };
}

(async () => {
  fs.mkdirSync(path.join(__dirname, "screenshots"), { recursive: true });
  const browser = await chromium.launch();
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const rows = [];
  const add = (mode, ask, think, scores, extra) => {
    rows.push(`| ${mode} | ${ask} | ${think} | ${mean(scores).toFixed(0)} | ${scores.map((s) => s.toFixed(0)).join(", ")} | ${extra} |`);
    console.log(rows[rows.length - 1]);
  };

  const shots = { 1: "1-start.png", 300: "2-fighting.png", 900: "3-later.png" };
  add("paused", "nothing (idle bot)", "-", await Promise.all(SEEDS.map((seed) => runPaused(browser, seed, Bots.idleBot, seed === 1 && { 1440: "4-nobody-played.png" }))), "- | -");
  add("paused", "press", "any", await Promise.all(SEEDS.map((seed) => runPaused(browser, seed, Bots.greedyBot, seed === 1 && shots))), "1440 | -");
  for (const ask of ["press", "plan"]) for (const thinkMs of THINK_MS) {
    const runs = await Promise.all(SEEDS.map((seed) => runLive(browser, { seed, thinkMs, ask })));   // the three seeds run side by side
    add("live", ask, thinkMs, runs.map((r) => r.score), `${Math.round(mean(runs.map((r) => r.decisions)))} | ${runs.every((r) => r.replayMatches) ? "yes" : "NO"}`);
  }
  await browser.close();

  fs.writeFileSync(path.join(__dirname, "results.md"), [
    "# Fireline v0: paused vs live (state-reading bot)", "",
    `${SECONDS} s runs at level ${LEVEL}, seeds ${SEEDS.join(", ")}. Score = percent of the town still standing (0 to 100).`,
    "\"think\" = how long the bot waits before acting. press = one action held until the next answer; plan = a timed list of steps.", "",
    "| mode | bot asked for | think (ms) | mean score | scores | decisions / run | replay matches |",
    "|---|---|---|---|---|---|---|",
    ...rows, "",
  ].join("\n"));
  console.log("wrote results.md");
})();
