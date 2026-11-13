// Page check in a real (headless) browser.  Run:  node browser-test.js
// Keyboard, mouse, the live clock, plans with clicks, and paused mode.

const { chromium } = require("playwright");
const assert = require("assert");
const path = require("path");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 768, height: 768 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("file://" + path.join(__dirname, "index.html"));

  // 1. The live clock is honest: about 48 ticks in 2 seconds.
  await page.evaluate(() => env.reset({ seed: 1, mode: "live" }));
  await sleep(2000);
  const ticks = await page.evaluate(() => env.state().tick);
  assert.ok(ticks >= 44 && ticks <= 52, "about 48 ticks in 2 s, got " + ticks);
  console.log("ok  live clock:", ticks, "ticks in 2 s");

  // 2. Keyboard drives the truck; the mouse sprays and uses water.
  await page.evaluate(() => env.reset({ seed: 1, mode: "live" }));
  await page.keyboard.down("ArrowRight"); await sleep(700); await page.keyboard.up("ArrowRight");
  await sleep(600);
  const col = await page.evaluate(() => env.state().truck.col);
  assert.ok(col > 5, "the truck moved right, col " + col);
  await page.mouse.move(400, 400); await page.mouse.down(); await sleep(500); await page.mouse.up();
  const water = await page.evaluate(() => env.state().water);
  assert.ok(water < 120, "spraying used water, left " + water);
  console.log("ok  keyboard drives (col " + col + "), mouse sprays (water " + water + ")");

  // 3. A timed plan with a click: drive one cell down, then spray.
  await page.evaluate(() => env.reset({ seed: 1, mode: "live" }));
  await page.evaluate(() => env.setPlan([{ buttons: ["down"], ticks: 12 }, { buttons: [], click: [300, 400], ticks: 10 }], 0));
  await sleep(1500);
  const after = await page.evaluate(() => ({ s: env.state(), tape: env.tape() }));
  assert.strictEqual(after.s.truck.row, 5);
  assert.strictEqual(after.s.water, 110);
  assert.ok(after.tape.some((a) => a.click && a.click[0] === 300));
  console.log("ok  setPlan with a click");

  // 4. Paused mode only moves on step(), and draws.
  await page.evaluate(() => env.reset({ seed: 1, mode: "paused" }));
  await sleep(300);
  assert.strictEqual(await page.evaluate(() => env.state().tick), 0);
  const out = await page.evaluate(() => env.step({ buttons: ["left"], click: null }));
  assert.strictEqual(out.state.tick, 1);
  console.log("ok  paused mode");

  assert.deepStrictEqual(errors, []);
  await browser.close();
  console.log("all page checks passed");
})();
