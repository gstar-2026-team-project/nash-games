// Drive the game in a real (headless) browser, the way an agent would.  Run:  node play.js
//
// It answers one question: how much does thinking time hurt when the game does not wait?
//   paused mode : the game waits for every decision (like Game-TARS and SpeedrunBench).
//   live mode   : the game runs at 24 ticks per second; the bot "thinks" for N ms per decision.
// Two bots: a "rule" bot that only decides what to press now, and a "planner" bot that sends
// a timed plan ("wait 10 ticks, then jump"). Only the waiting and the bot change.
//
// Output: screenshots/ (example frames) and results.md (the table).

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const Runner = require("./game.js");
const Bots = require("./bots.js");

const PAGE = "file://" + path.join(__dirname, "index.html");
const SECONDS = 20;                       // length of each run
const SEEDS = [1, 2, 3];
const THINK_MS = [0, 250, 1000, 2000];
const TPS = [24, 12];                   // live game clock: 24 ticks/s = normal, 12 = half speed
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openGame(browser) {
  const page = await browser.newPage({ viewport: { width: 768, height: 768 } });
  await page.goto(PAGE);
  return page;
}

// Paused: one decision per tick, as slow as we like.
async function runPaused(browser, seed) {
  const page = await openGame(browser);
  let state = await page.evaluate((o) => env.reset(o), { seed, mode: "paused", maxTicks: SECONDS * 24 });
  const bot = Bots.makeRuleBot();
  while (!state.done) {
    const out = await page.evaluate((a) => env.step(a), bot(state));
    state = out.state;
  }
  await page.close();
  return { score: state.score, result: state.result, decisions: state.tick };
}

// Live: grab a frame, think, act. Meanwhile the game keeps going.
//   bot "rule"    : decides what to press right now (env.setAction)
//   bot "planner" : sends a timed plan for the next few seconds (env.setPlan)
async function runLive(browser, { seed, tps, thinkMs, bot: kind }) {
  const page = await openGame(browser);
  await page.evaluate((o) => env.reset(o), { seed, tps, mode: "live", maxTicks: SECONDS * 24 });
  const rule = Bots.makeRuleBot(), planner = Bots.makePlannerBot();
  let decisions = 0, grabMs = 0, state;
  while (true) {
    const t0 = Date.now();
    await page.screenshot();                          // what an LLM agent would receive (not used by these bots)
    state = await page.evaluate(() => env.state());   // what these simple bots actually read
    grabMs += Date.now() - t0;
    if (state.done) break;
    const answer = kind === "rule" ? rule(state) : planner(state);
    await sleep(thinkMs);                             // pretend to think (an LLM call would go here)
    if (kind === "rule") await page.evaluate((a) => env.setAction(a), answer);
    else await page.evaluate(([p, t]) => env.setPlan(p, t), [answer, state.tick]);
    decisions++;
  }
  const tape = await page.evaluate(() => env.tape());
  await page.close();
  return { score: state.score, result: state.result, decisions, grabMs: Math.round(grabMs / Math.max(decisions, 1)), tape };
}

// Example frames for the README: start, mid-jump, ducking, crash.
async function saveExampleFrames(browser, dir) {
  const page = await openGame(browser);
  let state = await page.evaluate(() => env.reset({ seed: 1, mode: "paused" }));
  const bot = Bots.makeRuleBot();
  const wanted = { start: false, jump: false, duck: false };
  await page.screenshot({ path: path.join(dir, "1-start.png") });
  while (!state.done && !(wanted.jump && wanted.duck)) {
    state = (await page.evaluate((a) => env.step(a), bot(state))).state;
    const next = state.obstacles[0];
    if (!wanted.jump && state.playerY > 60) { await page.screenshot({ path: path.join(dir, "2-jump.png") }); wanted.jump = true; }
    if (!wanted.duck && state.ducking && next && next.kind === "high" && next.x < 200) { await page.screenshot({ path: path.join(dir, "3-duck.png") }); wanted.duck = true; }
  }
  state = await page.evaluate(() => env.reset({ seed: 1, mode: "paused" }));
  while (!state.done) state = (await page.evaluate(() => env.step({ buttons: [] }))).state;
  await page.screenshot({ path: path.join(dir, "4-crash.png") });
  await page.close();
}

(async () => {
  const shots = path.join(__dirname, "screenshots");
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();

  await saveExampleFrames(browser, shots);
  console.log("saved example frames");

  const rows = [];
  for (const seed of SEEDS) {
    const r = await runPaused(browser, seed);
    rows.push({ mode: "paused", bot: "rule", tps: "-", thinkMs: "any", seed, ...r });
    console.log("paused", seed, r.result, r.score);
  }
  for (const tps of TPS) {
    for (const thinkMs of THINK_MS) {
      // all bots and seeds for this setting run at the same time, in separate tabs
      const runs = [];
      for (const bot of ["rule", "planner"]) for (const seed of SEEDS) runs.push({ seed, tps, thinkMs, bot });
      const results = await Promise.all(runs.map((run) => runLive(browser, run)));
      results.forEach((r, i) => {
        const run = runs[i];
        // check: replaying the recorded tape in paused mode must give the same score
        const g = Runner.newGame({ seed: run.seed, maxTicks: SECONDS * 24 });
        for (const a of r.tape) { if (g.done) break; Runner.step(g, a); }
        rows.push({ mode: "live", ...run, score: r.score, result: r.result, decisions: r.decisions, grabMs: r.grabMs, replayOk: g.score === r.score });
        console.log("live", run.bot, "tps", tps, "think", thinkMs, "seed", run.seed, r.result, r.score, "replay ok:", g.score === r.score);
      });
    }
  }
  await browser.close();

  const max = SECONDS * 24;
  let md = `# Runner v0: paused vs live\n\n${SECONDS} s runs (max score ${max} ticks), seeds ${SEEDS.join(", ")}, one row = mean of the seeds.\n`;
  md += `"think" = how long the bot waits before acting, on top of grabbing the frame. "ticks/s" = how fast the live game clock runs (24 = normal).\n\n`;
  md += `| mode | bot | ticks/s | think (ms) | mean score | % of max | finished | decisions / run | frame grab (ms) | replay matches |\n|---|---|---|---|---|---|---|---|---|---|\n`;
  const groups = [["paused", "rule", "-", "any"]];
  for (const tps of TPS) for (const bot of ["rule", "planner"]) for (const t of THINK_MS) groups.push(["live", bot, tps, t]);
  for (const [mode, bot, tps, t] of groups) {
    const g = rows.filter((r) => r.mode === mode && r.bot === bot && r.tps === tps && r.thinkMs === t);
    const mean = g.reduce((s, r) => s + r.score, 0) / g.length;
    const fin = g.filter((r) => r.result === "finished").length;
    const dec = Math.round(g.reduce((s, r) => s + r.decisions, 0) / g.length);
    const grab = mode === "live" ? Math.round(g.reduce((s, r) => s + r.grabMs, 0) / g.length) : "-";
    const rep = mode === "live" ? (g.every((r) => r.replayOk) ? "yes" : "NO") : "-";
    md += `| ${mode} | ${bot} | ${tps} | ${t} | ${Math.round(mean)} | ${Math.round((100 * mean) / max)}% | ${fin}/${g.length} | ${dec} | ${grab} | ${rep} |\n`;
  }
  fs.writeFileSync(path.join(__dirname, "results.md"), md);
  console.log("\n" + md);
})();
