import { readFileSync } from "node:fs";
import { hookConfigSchema, deliverHook } from "./hook-delivery.js";
try {
  const path = process.argv[2]; if (!path) throw new Error("Missing configuration");
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) { input += String(chunk); if (Buffer.byteLength(input) > 1024 * 1024) throw new Error("Hook input too large"); }
  const result = await deliverHook(hookConfigSchema.parse(JSON.parse(readFileSync(path, "utf8"))), JSON.parse(input));
  console.log(JSON.stringify(result));
} catch { console.error("ContextMesh hook input/configuration failed validation; host work may continue."); console.log("{}"); }
// Advisory hooks always exit zero; never return a blocking host decision.
