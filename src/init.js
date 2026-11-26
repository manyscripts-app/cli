import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CLIENTS, SERVER_NAME, SERVER_URL } from "./clients.js";

const BACKUP_SUFFIX = ".manyscripts-bak";

export function onPath(bin) {
  const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const exts = process.platform === "win32" ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";") : [""];
  return dirs.some((d) => exts.some((e) => {
    try { fs.accessSync(path.join(d, bin + e), fs.constants.X_OK); return true; } catch { return false; }
  }));
}

function backup(file) {
  if (fs.existsSync(file)) fs.copyFileSync(file, file + BACKUP_SUFFIX);
}

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.manyscripts-tmp-${process.pid}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

/** Adds the server to one JSON settings file. Returns "added" | "already" | "skipped: <why>". */
export function addToJson({ file, key, entry, onlyIfDirExists }, dryRun) {
  if (onlyIfDirExists && !fs.existsSync(path.dirname(file))) return "skipped: app folder not found";
  let data = {};
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf8");
    if (raw.trim()) {
      try { data = JSON.parse(raw); } catch { return "skipped: file is not plain JSON, left unchanged"; }
      if (!data || typeof data !== "object" || Array.isArray(data)) return "skipped: unexpected file shape, left unchanged";
    }
  }
  const servers = data[key] ?? {};
  if (typeof servers !== "object" || Array.isArray(servers)) return `skipped: "${key}" has an unexpected shape, left unchanged`;
  if (servers[SERVER_NAME] && JSON.stringify(servers[SERVER_NAME]) === JSON.stringify({ ...servers[SERVER_NAME], ...entry })) return "already";
  const updating = Boolean(servers[SERVER_NAME]);
  if (dryRun) return updating ? "would update" : "would add";
  backup(file);
  data[key] = { ...servers, [SERVER_NAME]: { ...(servers[SERVER_NAME] || {}), ...entry } };
  writeAtomic(file, JSON.stringify(data, null, 2) + "\n");
  return updating ? "updated" : "added";
}

/** Adds [mcp_servers.manyscripts] to a Codex config.toml as text, leaving the rest as is. */
export function addToToml({ file }, dryRun) {
  const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (/^\s*\[mcp_servers\.manyscripts\]\s*$/m.test(raw)) return "already";
  if (dryRun) return "would add";
  backup(file);
  const block = `[mcp_servers.${SERVER_NAME}]\nurl = "${SERVER_URL}"\n`;
  writeAtomic(file, raw + (raw && !raw.endsWith("\n") ? "\n" : "") + (raw ? "\n" : "") + block);
  return "added";
}

function runCli(cli, dryRun, run) {
  if (dryRun) return `would run: ${cli.bin} ${cli.args.join(" ")}`;
  const r = run(cli.bin, cli.args);
  if (r.status === 0) return "added";
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  if (/already exists/i.test(out)) return "already";
  return null; // fall back to editing the file
}

const defaultRun = (bin, args) =>
  spawnSync(bin, args, { encoding: "utf8", stdio: ["inherit", "pipe", "pipe"], shell: process.platform === "win32" });

/**
 * opts: { dryRun, only: string[] | null, onPath, run }
 * Returns [{ id, name, results: string[], after?, manual? }]
 */
export function init(opts = {}) {
  const { dryRun = false, only = null, onPath: has = onPath, run = defaultRun } = opts;
  const report = [];
  for (const c of CLIENTS) {
    if (only && !only.includes(c.id)) continue;
    if (!only && !c.detect(has)) continue;
    const row = { id: c.id, name: c.name, results: [] };
    if (c.manual) {
      row.manual = c.manual;
    } else {
      let done = false;
      // Some app commands overwrite silently (Codex), and Codex also starts a
      // sign-in, so do not run them when the server is already in the file.
      const fileChecks = c.files().map((f) => (f.toml ? addToToml(f, true) : addToJson(f, true)));
      if (fileChecks.length && fileChecks.every((r) => r === "already")) {
        row.results.push("already");
        done = true;
      }
      if (!done && c.cli && has(c.cli.bin)) {
        const r = runCli(c.cli, dryRun, run);
        if (r) { row.results.push(r); done = true; }
      }
      if (!done) {
        for (const f of c.files()) {
          const r = f.toml ? addToToml(f, dryRun) : addToJson(f, dryRun);
          row.results.push(`${r} (${f.file})`);
        }
      }
      row.after = c.after;
    }
    report.push(row);
  }
  return report;
}

export const clientIds = () => CLIENTS.map((c) => c.id);
