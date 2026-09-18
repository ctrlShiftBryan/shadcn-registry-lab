import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { diff, record, status } from "./core.ts";
import type { Status } from "./core.ts";

function render(report: Status): string {
  return [
    ...report.components.map(c => c.id + ": " + c.source + " | customization: " + c.acknowledgement),
    ...report.findings.map(f => f.code + " " + f.severity + " " + f.component + ": " + f.message),
    "Upstream updates and compatibility: not checked by this prototype."
  ].join("\n");
}

let json = process.argv.includes("--json");
try {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      cwd: { type: "string", default: "." },
      reason: { type: "string" },
      json: { type: "boolean", default: false },
      strict: { type: "boolean", default: false },
      help: { type: "boolean", default: false }
    }
  });
  json = values.json;
  const [command, component] = positionals;
  if (values.help || !command) {
    console.log("ds status|check [--strict] [--json] [--cwd PATH]\nds diff COMPONENT [--json] [--cwd PATH]\nds record COMPONENT --reason TEXT [--json] [--cwd PATH]");
  } else {
    const cwd = resolve(values.cwd);
    if (command === "diff") {
      if (!component || positionals.length !== 2) throw new Error("Usage: ds diff COMPONENT");
      const patch = await diff(cwd, component);
      console.log(json ? JSON.stringify({ schemaVersion: 1, component, diff: patch }) : patch);
    } else if (command === "record") {
      if (!component || !values.reason || positionals.length !== 2) throw new Error("Usage: ds record COMPONENT --reason TEXT");
      const report = await record(cwd, component, values.reason);
      console.log(json ? JSON.stringify(report) : render(report));
    } else if (command === "status" || command === "check") {
      if (positionals.length !== 1) throw new Error("Unexpected positional argument");
      const report = await status(cwd);
      console.log(json ? JSON.stringify(report) : render(report));
      if (command === "check" && report.findings.some(f => f.severity === "error" || values.strict)) process.exitCode = 1;
    } else throw new Error("Unknown command: " + command);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const output = json ? JSON.stringify({ schemaVersion: 1, error: { code: "DS_TOOL_ERROR", message } }) : message;
  if (json) console.log(output); else console.error(output);
  process.exitCode = 2;
}

