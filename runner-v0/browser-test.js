// Quick checks of the browser page itself (keyboard, click, plans).  Run:  node browser-test.js
const { chromium } = require("playwright");
const assert = require("assert");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 768, height: 768 } });
  await page.goto("file://" + path.join(__dirname, "index.html"));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 1. A human can jump with the keyboard in live mode.
  await page.evaluate(() => env.reset({ seed: 1, mode: "live" }));
  await page.keyboard.down(" "); await sleep(150); await page.keyboard.up(" ");
  const y = await page.evaluate(() => env.state().playerY);
  assert.ok(y > 0, "space should make the player jump, playerY = " + y);
  console.log("ok  keyboard jump (playerY " + y + ")");

  // 2. The live clock runs at about 24 ticks per second.
  await page.evaluate(() => env.reset({ seed: 1, mode: "live" }));
  await sleep(2000);
  const ticks = await page.evaluate(() => env.state().tick);
  assert.ok(ticks >= 44 && ticks <= 52, "expected ~48 ticks in 2 s, got " + ticks);
  console.log("ok  live clock: " + ticks + " ticks in 2 s");

  // 3. A mouse click on the canvas is recorded in the tape.
  await page.mouse.click(300, 200); await sleep(100);
  const clicks = await page.evaluate(() => env.tape().filter((a) => a.click).map((a) => a.click));
  assert.deepEqual(clicks[0], [300, 200]);
  console.log("ok  click recorded at " + JSON.stringify(clicks[0]));

  // 4. A plan made from an old frame: the past part is skipped, a fully-past plan is reported.
  const tick = await page.evaluate(() => env.state().tick);
  const reply = await page.evaluate((t) => env.setPlan([{ buttons: ["space"], ticks: 1 }], t - 10), tick);
  assert.equal(reply, "plan arrived too late");
  console.log("ok  late plan reported: " + reply);

  // 5. step() only works in paused mode, and paused mode does not move on its own.
  let threw = false;
  try { await page.evaluate(() => env.step({ buttons: [] })); } catch (e) { threw = true; }
  assert.ok(threw);
  await page.evaluate(() => env.reset({ seed: 1, mode: "paused" }));
  await sleep(500);
  assert.equal(await page.evaluate(() => env.state().tick), 0);
  console.log("ok  paused mode waits for step()");

  await page.screenshot({ path: path.join(__dirname, "screenshots", "1-start.png") });
  await browser.close();
  console.log("5 browser checks passed");
})();
