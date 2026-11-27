#!/usr/bin/env node
import { init, clientIds } from "../src/init.js";
import { SERVER_URL } from "../src/clients.js";

const HELP = `ManyScripts: video transcripts for your AI apps

Usage:
  npx github:manyscripts-app/cli init              Add ManyScripts to every AI app found on this computer
  npx github:manyscripts-app/cli init --dry-run    Show what would change, change nothing
  npx github:manyscripts-app/cli init --only cursor,codex

Apps: ${clientIds().join(", ")}

Server: ${SERVER_URL}
Each config file is backed up to <file>.manyscripts-bak before it changes.
`;

const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === "help" || args.includes("--help") || args.includes("-h")) {
  process.stdout.write(HELP);
  process.exit(0);
}

if (cmd !== "init") {
  process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
  process.exit(1);
}

const dryRun = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? (args[onlyIdx + 1] || "").split(",").map((s) => s.trim()).filter(Boolean) : null;
if (only) {
  const bad = only.filter((id) => !clientIds().includes(id));
  if (bad.length) {
    process.stderr.write(`Unknown app: ${bad.join(", ")}. Use one of: ${clientIds().join(", ")}\n`);
    process.exit(1);
  }
}

const report = init({ dryRun, only });

if (!report.length) {
  process.stdout.write(`No supported AI apps found.\nAdd this remote MCP server by hand: ${SERVER_URL}\n`);
  process.exit(0);
}

process.stdout.write(dryRun ? "Dry run, nothing changed:\n\n" : "\n");
for (const r of report) {
  process.stdout.write(`${r.name}\n`);
  if (r.manual) process.stdout.write(`  ${r.manual}\n`);
  for (const line of r.results) process.stdout.write(`  ${line}\n`);
  if (r.after && !dryRun) process.stdout.write(`  Next: ${r.after}\n`);
  process.stdout.write("\n");
}
if (!dryRun) process.stdout.write("Restart your AI apps. ManyScripts works on the Free plan; you sign in the first time it runs.\n");
