// Simple bots for testing the env. They read the numbers from getState(), not the pixels.
// A real agent (an LLM) would look at the screenshot instead.

const Runner = typeof module !== "undefined" ? require("./game.js") : window.Runner;

// Do nothing, ever. The lower bound.
function idleBot() {
  return { buttons: [], click: null };
}

// Press random buttons. Another lower bound.
function randomBot() {
  const r = Math.random();
  return { buttons: r < 0.05 ? ["space"] : r < 0.15 ? ["down"] : [], click: null };
}

// Rule bot: jump over boxes, duck under bars.
// `lead` = how many extra pixels early it reacts. Use lead = actionDelay * speed
// to make it aware of the action delay.
function makeRuleBot(lead = 0) {
  return function ruleBot(state) {
    const front = Runner.PLAYER_X + Runner.PLAYER_W;
    // the first obstacle that has not fully passed the player yet
    const next = state.obstacles.find((o) => {
      const w = o.kind === "low" ? Runner.LOW.w : Runner.HIGH.w;
      return o.x + w > Runner.PLAYER_X;
    });
    if (!next) return { buttons: [], click: null };
    const distance = next.x - front;          // pixels between the player and the obstacle
    if (next.kind === "low" && distance <= 70 + lead && distance > 0) return { buttons: ["space"], click: null };
    if (next.kind === "high" && distance <= 40 + lead) return { buttons: ["down"], click: null };
    return { buttons: [], click: null };
  };
}


// Planner bot: for slow thinkers in live mode.
// Instead of "what do I press now?", it answers "what should I press over the next few
// seconds, starting from this frame?" and sends a timed plan: env.setPlan(steps, state.tick).
// The game drops whatever part of the plan is already in the past when it arrives.
function makePlannerBot() {
  return function plannerBot(state) {
    const front = Runner.PLAYER_X + Runner.PLAYER_W;
    const horizon = 96;                          // look 4 seconds ahead
    const timeline = Array.from({ length: horizon }, () => []);
    for (const o of state.obstacles) {
      const w = o.kind === "low" ? Runner.LOW.w : Runner.HIGH.w;
      for (let k = 0; k < horizon; k++) {
        const x = o.x - state.speed * k;         // where this obstacle will be in k ticks
        const distance = x - front;
        if (x + w <= Runner.PLAYER_X) break;     // it has passed the player
        if (o.kind === "low" && distance <= 64) { timeline[k].push("space"); break; } // jump once
        if (o.kind === "high" && distance <= 40) timeline[k].push("down");          // duck until passed
      }
    }
    // Turn the per-tick list into steps.
    const steps = [];
    for (const buttons of timeline) {
      const last = steps[steps.length - 1];
      if (last && last.buttons.join() === buttons.join()) last.ticks += 1;
      else steps.push({ buttons, ticks: 1 });
    }
    return steps;
  };
}

const Bots = { idleBot, randomBot, makeRuleBot, makePlannerBot };
if (typeof module !== "undefined") module.exports = Bots;
if (typeof window !== "undefined") window.Bots = Bots;
