// One long-lived headless Claude Code process that looks at frames and answers in text.
// It uses the Claude Code subscription (`claude -p`), so no API key is needed.
// No tools, no project settings: the model only sees the manual, the frame and the question.

const { spawn } = require("child_process");

class Session {
  // model: "haiku" | "sonnet" | "opus" | ...   effort: "low" | "medium" | "high" | undefined
  constructor({ model, effort, manual }) {
    const args = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
      "--model", model, "--tools", "", "--strict-mcp-config", "--setting-sources", "",
      "--system-prompt", manual];
    if (effort) args.push("--effort", effort);
    this.proc = spawn("claude", args, { stdio: ["pipe", "pipe", "ignore"] });
    this.waiting = null;            // the resolve() of the question being answered
    let buffer = "";
    this.proc.stdout.on("data", (chunk) => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        if (!line.trim()) continue;
        let message; try { message = JSON.parse(line); } catch { continue; }
        if (message.type === "result" && this.waiting) {
          const done = this.waiting; this.waiting = null;
          done(message.is_error ? "" : String(message.result || ""));
        }
      }
    });
    this.proc.on("exit", () => { if (this.waiting) { this.waiting(""); this.waiting = null; } });
  }

  // Show one PNG frame (base64, or null for text only) with a short question. Returns { text, ms }.
  ask(pngBase64, question) {
    const start = Date.now();
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.waiting = null; resolve({ text: "", ms: Date.now() - start }); }, 120000);
      this.waiting = (text) => { clearTimeout(timer); resolve({ text, ms: Date.now() - start }); };
      const content = [{ type: "text", text: question }];
      if (pngBase64) content.unshift({ type: "image", source: { type: "base64", media_type: "image/png", data: pngBase64 } });
      this.proc.stdin.write(JSON.stringify({ type: "user", message: { role: "user", content } }) + "\n");
    });
  }

  close() { try { this.proc.stdin.end(); this.proc.kill(); } catch {} }
}

module.exports = { Session };
