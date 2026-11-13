// A tiny local server that lets someone play a game by sight: look at a PNG, send a plan, look again.
// Made for Claude Code subagents (they can run curl and read images), and handy for a person too.
//
//   node harness/sight-server.js <game folder> <folder for the PNGs> [port]
//
//   GET /manual                         the rules, as the game's sight-config.js tells them to a model
//   GET /reset?id=a&seed=1&mode=paused  new game for player "a" (mode=live&tps=24 for a running clock)
//   GET /shot?id=a                      saves the current frame (384 px) and replies { file, done }
//   GET /plan?id=a&text=right 24; ...   paused: runs the plan (at most planMax ticks); live: env.setPlan (replaces the old plan)
//
// The player never gets env.state(): only the picture. Each id has its own browser page.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const defaults = require("./sight.js");

const dir = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3]);
const port = Number(process.argv[4] || 8765);
const game = require(path.join(dir, "sight-config.js"));
const toSteps = game.parsePlan || defaults.parsePlan;
const players = new Map();          // id -> { page, mode, shotTick, log: [] }

async function handle(browser, url) {
  const q = url.searchParams, id = q.get("id") || "a";
  if (url.pathname === "/manual") return game.manual + "\n\nHOW TO ANSWER\n" + game.askPlan;

  if (url.pathname === "/reset") {
    let player = players.get(id);
    if (!player) {
      player = { page: await browser.newPage({ viewport: { width: 768, height: 768 } }) };
      await player.page.goto("file://" + path.join(dir, "index.html"));
      players.set(id, player);
    }
    player.mode = q.get("mode") || "paused";
    player.shotTick = 0;
    player.log = [];
    await player.page.evaluate((o) => env.reset(o), {
      ...game.reset, seed: Number(q.get("seed") || 1), mode: player.mode, tps: Number(q.get("tps") || 24), maxTicks: game.seconds * 24,
    });
    return { ok: true, mode: player.mode };
  }

  const player = players.get(id);
  if (!player) return { error: "call /reset first" };

  if (url.pathname === "/shot") {
    const shot = await player.page.evaluate(() => {
      const small = document.createElement("canvas");
      small.width = small.height = 384;
      small.getContext("2d").drawImage(document.querySelector("canvas"), 0, 0, 384, 384);
      const s = env.state();
      return { png: small.toDataURL("image/png").slice(22), tick: s.tick, done: s.done, score: s.score };
    });
    player.shotTick = shot.tick;
    const file = path.join(out, `${id}-${player.mode}-${String(shot.tick).padStart(4, "0")}.png`);
    fs.writeFileSync(file, Buffer.from(shot.png, "base64"));
    if (shot.done) fs.appendFileSync(path.join(out, "scores.jsonl"), JSON.stringify({ id, mode: player.mode, score: shot.score, plans: player.log }) + "\n");
    return { file, done: shot.done };
  }

  if (url.pathname === "/plan") {
    const text = q.get("text") || "", steps = toSteps(text);
    player.log.push([player.shotTick, text]);
    if (!steps.length) return { error: "no step understood; see /manual for the format" };
    if (player.mode === "paused") {
      const ran = await player.page.evaluate(([steps, max]) => {
        let n = 0;
        for (const s of steps) for (let k = 0; k < s.ticks && n < max && !env.state().done; k++, n++) env.step({ buttons: s.buttons, click: s.click });
        return n;
      }, [steps, game.planMax]);
      return { ranTicks: ran, note: ran === game.planMax ? `only the first ${game.planMax} ticks of a plan run before the next look` : undefined };
    }
    return { sent: await player.page.evaluate(([p, t]) => env.setPlan(p, t === null ? undefined : t), [steps, game.livePlan === "timed" ? player.shotTick : null]), note: "this plan replaced the old one" };
  }
  return { error: "unknown path" };
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  http.createServer(async (req, res) => {
    try {
      const answer = await handle(browser, new URL(req.url, "http://localhost"));
      res.end(typeof answer === "string" ? answer : JSON.stringify(answer));
    } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e.message || e) })); }
  }).listen(port, "127.0.0.1", () => console.log("sight server for", game.name, "on http://127.0.0.1:" + port));
})();
