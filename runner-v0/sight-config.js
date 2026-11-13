// What a model is told when it plays Runner v0 from screenshots (used by ../harness/sight.js).
// The manual gives the rules and the timing numbers a person would learn in a minute of practice.

const Runner = require("./game.js");

const manual = `You are playing a small side-scrolling game from screenshots. Each screenshot is 384x384.

The blue block on the left is you. You run on your own and never move sideways. Obstacles slide in from the right at a constant speed.
- RED BOX on the ground: jump over it with the "space" button.
- ORANGE BAR hanging down from the top of the screen: duck under it by holding the "down" button. It cannot be jumped.
Touching an obstacle ends the game.

Time: the game runs in ticks, 24 ticks = 1 second. The white ruler on the brown ground tells you when things arrive: an obstacle whose LEFT edge is above the "1s" mark reaches you in 1 second (24 ticks), above "2s" in 48 ticks, halfway between in 36 ticks. Small marks are half seconds.

Timing, where T = ticks until the obstacle's left edge reaches you:
- Jump: press space at tick T-10 (a jump stays in the air about 26 ticks). Up to 4 ticks earlier or later still works.
- Duck: hold down from tick T-4 until tick T+16. Ducking early is harmless.`;

// "press" style: the model names the one button to hold right now.
const askPress = `Which button should be held right now? Reply with exactly one word: space, down, or none.`;

// "plan" style: the model writes timed button presses for everything it can see.
const askPlan = `Write the button presses for every obstacle visible in this frame. Ticks count from this frame (this frame = tick 0).
Format: one item per obstacle, separated by ";", as BUTTON FROM-TO. Example: "space 26-28; down 52-72" means hold space during ticks 26 to 28, then hold down during ticks 52 to 72.
If no obstacle is visible, reply "none". Reply with the plan line only.`;

// Replay a tape with the rules only, to check that a live run was recorded faithfully.
function replay(seed, tape, maxTicks) {
  const game = Runner.newGame({ seed, maxTicks });
  for (const action of tape) Runner.step(game, action);
  return game.score;
}

module.exports = {
  name: "Runner v0", seconds: 20, maxScore: 480, reset: {},
  pressHold: 4, planMax: 36,            // paused mode: ticks run per look (one button / one plan)
  livePlan: "timed",                    // live mode: a plan counts from the frame it was made from; the past part is skipped
  manual, askPress, askPlan, replay,
};
