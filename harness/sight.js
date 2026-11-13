// Let a Claude model play a game from screenshots only, paused and live.
//
//   node harness/sight.js <game folder> [--agents press,chunk,slow,hybrid] [--modes paused,24,12] [--seeds 1,2,3]
//                         [--fast haiku] [--slow opus]        (the models for the fast and the slow role)
//
// The model never sees env.state(). Each look: grab the frame (downscaled to 384 px), ask, act.
//   paused : the game waits while the model thinks (env.step).
//   live   : the game runs at N ticks per second while the model thinks (env.setAction / env.setPlan).
//            A game picks how live plans are used (livePlan in its sight-config.js):
//            "timed"  : the plan counts from the frame it was made from; the past part is skipped (moving obstacles).
//            "commit" : the plan starts when it arrives and runs to its end before the next look (driving somewhere).
// Agents:
//   press  : fast model, names one action to hold until its next look.
//   chunk  : fast model, writes a timed plan from each frame (action chunking).
//   slow   : stronger model with thinking, writes a timed plan.
//   hybrid : chunk, plus a slow model that watches the same game in parallel and leaves notes
//            the fast model reads before each plan (needs askAdvice in the game's sight-config.js).
// What the model is told, and how its text becomes actions, is in <game>/sight-config.js.
// Output: <game>/sight-runs.jsonl (one line per run) and <game>/results-sight.md (the table).

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { Session } = require("./claude-session.js");

function option(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return (i > 0 ? process.argv[i + 1] : fallback).split(",");
}

const FAST = option("fast", "haiku")[0], SLOW = option("slow", "opus")[0];     // which models play the two roles
const AGENTS = {
  press: { model: FAST, style: "press" },
  chunk: { model: FAST, style: "plan" },
  slow: { model: SLOW, effort: "high", style: "plan" },
  hybrid: { model: FAST, style: "plan", advisor: { model: SLOW, effort: "high" } },
};
const BUTTONS = ["up", "down", "left", "right", "space", "x", "y"];
const LOOKS_PER_SESSION = 25; // paused: start a fresh model session now and then, to keep the context short
const ADVICE_EVERY = 3;       // paused, hybrid: ask the slow model on every 3rd look

// Default answer formats (a game can bring its own parsePress / parsePlan).
// "space" / "down" / "none" -> one action
function parsePress(text) {
  const word = text.toLowerCase().match(/\b(space|down|up|left|right|none)\b/);
  return { buttons: word && word[1] !== "none" ? [word[1]] : [], click: null };
}

// "space 26-28; down 52-72" (button, from tick, to tick) -> [{ buttons: [], ticks: 26 }, { buttons: ["space"], ticks: 3 }, ...]
function parsePlan(text) {
  const line = text.trim().split("\n").pop().toLowerCase();
  const timeline = [];                              // timeline[k] = buttons held at tick k
  for (const m of line.matchAll(/([a-z]+)\s+(\d+)\s*-\s*(\d+)/g)) {
    if (!BUTTONS.includes(m[1])) continue;
    for (let k = Number(m[2]); k <= Math.min(Number(m[3]), 240); k++) (timeline[k] = timeline[k] || []).push(m[1]);
  }
  const steps = [];
  for (let k = 0; k < timeline.length; k++) {
    const buttons = timeline[k] || [];
    const last = steps[steps.length - 1];
    if (last && last.buttons.join() === buttons.join()) last.ticks += 1;
    else steps.push({ buttons, click: null, ticks: 1 });
  }
  return steps;
}

// The frame as the model sees it, plus the bookkeeping the harness needs (never shown to the model).
function grab(page) {
  return page.evaluate(() => {
    const small = document.createElement("canvas");
    small.width = small.height = 384;
    small.getContext("2d").drawImage(document.querySelector("canvas"), 0, 0, 384, 384);
    const s = env.state();
    return { png: small.toDataURL("image/png").slice(22), tick: s.tick, done: s.done, score: s.score, result: s.result };
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] || 0;

async function run(page, game, agentName, mode, seed) {
  const agent = AGENTS[agentName];
  const maxTicks = game.seconds * 24;
  const toSteps = agent.style === "press"
    ? (text) => [{ ...(game.parsePress || parsePress)(text), ticks: game.pressHold }]
    : (game.parsePlan || parsePlan);
  const newSession = () => new Session({ model: agent.model, effort: agent.effort, manual: game.manual });
  let session = newSession();
  const advisor = agent.advisor ? new Session({ ...agent.advisor, manual: game.manual }) : null;
  const thinkMs = [], adviceMs = [], answers = [];
  let note = null;                                  // the slow model's latest note: { text, tick }
  let shot;

  // The question for the fast model, with the slow model's latest note when there is one.
  const question = (tick) => (agent.style === "press" ? game.askPress : game.askPlan) +
    (note ? `\nNote from your strategist, written ${Math.max(0, Math.round((tick - note.tick) / 24))} s ago: ${note.text}` : "");
  const advise = async (frame) => {
    const answer = await advisor.ask(frame.png, game.askAdvice);
    adviceMs.push(answer.ms);
    if (answer.text.trim()) { note = { text: answer.text.trim(), tick: frame.tick }; answers.push([frame.tick, "NOTE " + note.text]); }
  };

  // Warm up on the first frame, so the slow first call of a session is not part of the run.
  await page.evaluate((o) => env.reset(o), { ...game.reset, seed, mode: "paused", maxTicks });
  const first = await grab(page);
  await Promise.all([session.ask(first.png, question(0)), advisor ? advisor.ask(first.png, game.askAdvice) : null]);

  if (mode === "paused") {
    for (let look = 0; ; look++) {
      shot = await grab(page);
      if (shot.done) break;
      if (look && look % LOOKS_PER_SESSION === 0) { session.close(); session = newSession(); }
      if (advisor && look % ADVICE_EVERY === 0) await advise(shot);
      const answer = await session.ask(shot.png, question(shot.tick));
      thinkMs.push(answer.ms); answers.push([shot.tick, answer.text, answer.ms]);
      let steps = toSteps(answer.text);
      if (!steps.length) steps = [{ buttons: [], click: null, ticks: 6 }];
      await page.evaluate(([steps, max]) => {
        let left = max;
        for (const s of steps) for (let k = 0; k < s.ticks && left > 0 && !env.state().done; k++, left--) env.step({ buttons: s.buttons, click: s.click });
      }, [steps, agent.style === "press" ? game.pressHold : game.planMax]);
    }
  } else {
    await page.evaluate((o) => env.reset(o), { ...game.reset, seed, mode: "live", tps: Number(mode), maxTicks });
    let over = false;
    const advising = advisor && (async () => {       // the slow loop, running beside the fast one
      while (!over) { const frame = await grab(page); if (frame.done) break; await advise(frame); }
    })();
    while (true) {
      shot = await grab(page);
      if (shot.done) break;
      const answer = await session.ask(shot.png, question(shot.tick));
      thinkMs.push(answer.ms); answers.push([shot.tick, answer.text, answer.ms]);
      const steps = toSteps(answer.text);
      if (agent.style === "press") await page.evaluate((a) => env.setAction(a), steps[0]);
      else if (game.livePlan === "timed") await page.evaluate(([p, t]) => env.setPlan(p, t), [steps, shot.tick]);
      else {                                        // "commit": the plan starts now, and the next look waits until it is done
        await page.evaluate((p) => env.setPlan(p), steps);
        await sleep(steps.reduce((sum, s) => sum + s.ticks, 0) * 1000 / Number(mode));
      }
    }
    over = true;
    if (advisor) { advisor.close(); await advising; }
  }
  session.close();
  if (advisor) advisor.close();
  const tape = await page.evaluate(() => env.tape());
  return {
    game: game.name, agent: agentName, model: agent.model + (agent.advisor ? " + " + agent.advisor.model : ""), effort: (agent.advisor || agent).effort || "", mode, seed,
    score: shot.score, max: game.maxScore, result: shot.result, looks: thinkMs.length, medianThinkMs: median(thinkMs),
    notes: adviceMs.length, medianNoteMs: median(adviceMs),
    replayMatches: game.replay(seed, tape, maxTicks) === shot.score, answers,
  };
}

function table(game, rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = [r.agent, r.model + (r.effort ? " (" + r.effort + ")" : ""), r.mode === "paused" ? "paused" : "live " + r.mode + " ticks/s"].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const lines = [
    `# ${game.name}: Claude playing from screenshots`, "",
    `The model sees only the 384 px frame (never \`env.state()\`). ${game.seconds} s runs, max score ${game.maxScore}; one row = mean over its seeds.`,
    "press = one action per look; chunk = a timed plan per look; slow = a timed plan from a thinking model; hybrid = chunk + a thinking model leaving notes in parallel.",
    "Models run through `claude -p` (Claude Code subscription), so think time includes its overhead. Run with `node harness/sight.js`.", "",
    "| agent | model | mode | mean score | % of max | scores | finished | seeds | looks / run | think per look (s) | notes / run | replay matches |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const [key, rs] of groups) {
    const [agent, model, mode] = key.split("|");
    lines.push(`| ${agent} | ${model} | ${mode} | ${Math.round(mean(rs.map((r) => r.score)))} | ${Math.round(100 * mean(rs.map((r) => r.score / r.max)))}% | ${rs.map((r) => Math.round(r.score)).join(", ")} | ${rs.filter((r) => r.result === "finished").length}/${rs.length} | ${rs.map((r) => r.seed).join(", ")} | ${Math.round(mean(rs.map((r) => r.looks)))} | ${(mean(rs.map((r) => r.medianThinkMs)) / 1000).toFixed(1)} | ${rs[0].notes ? Math.round(mean(rs.map((r) => r.notes))) : "-"} | ${rs.every((r) => r.replayMatches) ? "yes" : "NO"} |`);
  }
  if (game.reference) {
    const seeds = [...new Set(rows.map((r) => r.seed))].sort((a, b) => a - b);
    for (const [name, scores] of Object.entries(game.reference(seeds, game.seconds * 24))) {
      lines.push(`| ${name} | - | paused | ${Math.round(mean(scores))} | ${Math.round(100 * mean(scores) / game.maxScore)}% | ${scores.map(Math.round).join(", ")} | - | ${seeds.join(", ")} | - | - | - | - |`);
    }
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const dir = path.resolve(process.argv[2]);
  const game = require(path.join(dir, "sight-config.js"));
  const agents = option("agents", "press,chunk,slow"), modes = option("modes", "paused,24,12"), seeds = option("seeds", "1,2,3").map(Number);
  const log = path.join(dir, "sight-runs.jsonl");
  if (agents[0] !== "table") {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 768, height: 768 } });
    await page.goto("file://" + path.join(dir, "index.html"));
    for (const agent of agents) for (const mode of modes) for (const seed of seeds) {
      if (AGENTS[agent].advisor && !game.askAdvice) continue;
      const row = await run(page, game, agent, mode, seed);
      // A run where the model mostly gave no answer (for example a usage limit) measures nothing: report it, do not log it.
      const empty = row.answers.filter((a) => !String(a[1]).startsWith("NOTE") && !String(a[1]).trim()).length;
      if (empty > row.looks / 2) { console.log(agent, mode, "seed", seed, "-> NOT LOGGED:", empty, "of", row.looks, "answers were empty"); continue; }
      fs.appendFileSync(log, JSON.stringify(row) + "\n");
      console.log(agent, mode, "seed", seed, "->", row.score, row.result, "looks", row.looks, "think", row.medianThinkMs, "ms", row.notes ? "notes " + row.notes : "");
    }
    await browser.close();
  }
  // The table always shows every run in the log; delete lines from the log to drop runs. `--agents table` only rebuilds it.
  const rows = fs.readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  fs.writeFileSync(path.join(dir, "results-sight.md"), table(game, rows));
}

if (require.main === module) main();
module.exports = { parsePress, parsePlan };
