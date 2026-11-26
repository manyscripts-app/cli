import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { init, addToJson, addToToml } from "../src/init.js";

let home, oldHome, oldXdg, oldPlatform;
const noBins = () => false;
const p = (...s) => path.join(home, ...s);

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "ms-init-"));
  oldHome = process.env.HOME; oldXdg = process.env.XDG_CONFIG_HOME;
  process.env.HOME = home; delete process.env.XDG_CONFIG_HOME;
  oldPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: "linux" });
});
afterEach(() => {
  process.env.HOME = oldHome;
  if (oldXdg !== undefined) process.env.XDG_CONFIG_HOME = oldXdg;
  Object.defineProperty(process, "platform", oldPlatform);
  fs.rmSync(home, { recursive: true, force: true });
});

test("finds nothing on a clean machine", () => {
  assert.deepEqual(init({ onPath: noBins }), []);
});

test("adds to Cursor, keeps other servers, makes a backup", () => {
  fs.mkdirSync(p(".cursor"));
  const before = { mcpServers: { other: { url: "https://x" } }, keep: 1 };
  fs.writeFileSync(p(".cursor", "mcp.json"), JSON.stringify(before));
  const r = init({ onPath: noBins });
  assert.equal(r[0].id, "cursor");
  const after = JSON.parse(fs.readFileSync(p(".cursor", "mcp.json"), "utf8"));
  assert.deepEqual(after.mcpServers.other, { url: "https://x" });
  assert.equal(after.keep, 1);
  assert.equal(after.mcpServers.manyscripts.url, "https://www.manyscripts.com/api/mcp");
  assert.deepEqual(JSON.parse(fs.readFileSync(p(".cursor", "mcp.json.manyscripts-bak"), "utf8")), before);
});

test("second run says already and does not rewrite", () => {
  fs.mkdirSync(p(".cursor"));
  init({ onPath: noBins });
  const r = init({ onPath: noBins });
  assert.match(r[0].results[0], /^already/);
});

test("broken JSON is left unchanged", () => {
  fs.mkdirSync(p(".cursor"));
  fs.writeFileSync(p(".cursor", "mcp.json"), "{ // comment\n}");
  const r = init({ onPath: noBins });
  assert.match(r[0].results[0], /^skipped/);
  assert.equal(fs.readFileSync(p(".cursor", "mcp.json"), "utf8"), "{ // comment\n}");
  assert.equal(fs.existsSync(p(".cursor", "mcp.json.manyscripts-bak")), false);
});

test("dry run changes nothing", () => {
  fs.mkdirSync(p(".cursor"));
  const r = init({ onPath: noBins, dryRun: true });
  assert.match(r[0].results[0], /^would add/);
  assert.equal(fs.existsSync(p(".cursor", "mcp.json")), false);
});

test("Gemini uses httpUrl, and a bare ~/.gemini is not enough to detect it", () => {
  fs.mkdirSync(p(".gemini"));
  assert.deepEqual(init({ onPath: noBins }), []);
  fs.writeFileSync(p(".gemini", "settings.json"), "{}");
  init({ onPath: noBins });
  const s = JSON.parse(fs.readFileSync(p(".gemini", "settings.json"), "utf8"));
  assert.deepEqual(s.mcpServers.manyscripts, { httpUrl: "https://www.manyscripts.com/api/mcp" });
});

test("Windsurf writes serverUrl only where the app folder exists", () => {
  fs.mkdirSync(p(".config", "devin"), { recursive: true });
  const r = init({ onPath: noBins });
  assert.equal(r[0].id, "windsurf");
  const s = JSON.parse(fs.readFileSync(p(".config", "devin", "mcp_config.json"), "utf8"));
  assert.equal(s.mcpServers.manyscripts.serverUrl, "https://www.manyscripts.com/api/mcp");
  assert.equal(fs.existsSync(p(".codeium", "windsurf", "mcp_config.json")), false);
});

test("VS Code file uses the servers key with type http", () => {
  fs.mkdirSync(p(".config", "Code", "User"), { recursive: true });
  init({ onPath: noBins });
  const s = JSON.parse(fs.readFileSync(p(".config", "Code", "User", "mcp.json"), "utf8"));
  assert.deepEqual(s.servers.manyscripts, { type: "http", url: "https://www.manyscripts.com/api/mcp" });
});

test("Codex TOML: appends once, keeps the rest", () => {
  fs.mkdirSync(p(".codex"));
  fs.writeFileSync(p(".codex", "config.toml"), 'model = "x"\n');
  init({ onPath: noBins });
  init({ onPath: noBins });
  const t = fs.readFileSync(p(".codex", "config.toml"), "utf8");
  assert.ok(t.startsWith('model = "x"\n'));
  assert.equal(t.match(/\[mcp_servers\.manyscripts\]/g).length, 1);
  assert.match(t, /url = "https:\/\/www\.manyscripts\.com\/api\/mcp"/);
});

test("Claude Desktop only prints the connector link", () => {
  fs.mkdirSync(p(".config", "Claude"), { recursive: true });
  const r = init({ onPath: noBins });
  assert.equal(r[0].id, "claude-desktop");
  assert.match(r[0].manual, /claude\.ai\/directory\/manyscripts/);
  assert.deepEqual(fs.readdirSync(p(".config", "Claude")), []);
});

test("uses the app's own command when it is installed", () => {
  const calls = [];
  const r = init({ only: ["claude-code"], onPath: (b) => b === "claude", run: (bin, args) => { calls.push([bin, ...args]); return { status: 0 }; } });
  assert.deepEqual(calls[0], ["claude", "mcp", "add", "--transport", "http", "--scope", "user", "manyscripts", "https://www.manyscripts.com/api/mcp"]);
  assert.deepEqual(r[0].results, ["added"]);
  assert.equal(fs.existsSync(p(".claude.json")), false);
});

test("does not run the app's command when the server is already set up", () => {
  fs.mkdirSync(p(".codex"));
  fs.writeFileSync(p(".codex", "config.toml"), '[mcp_servers.manyscripts]\nurl = "https://www.manyscripts.com/api/mcp"\n');
  const calls = [];
  const r = init({ only: ["codex"], onPath: (b) => b === "codex", run: (...a) => { calls.push(a); return { status: 0 }; } });
  assert.equal(calls.length, 0);
  assert.deepEqual(r[0].results, ["already"]);
});

test("falls back to the file when the app's command fails", () => {
  const r = init({ only: ["claude-code"], onPath: (b) => b === "claude", run: () => ({ status: 1, stderr: "boom" }) });
  assert.match(r[0].results[0], /^added/);
  const s = JSON.parse(fs.readFileSync(p(".claude.json"), "utf8"));
  assert.deepEqual(s.mcpServers.manyscripts, { type: "http", url: "https://www.manyscripts.com/api/mcp" });
});

test("addToJson refuses a non-object servers key", () => {
  const f = p("x.json");
  fs.writeFileSync(f, JSON.stringify({ mcpServers: [] }));
  assert.match(addToJson({ file: f, key: "mcpServers", entry: { url: "u" } }), /^skipped/);
});

test("addToToml on a missing file creates it", () => {
  const f = p("new", "config.toml");
  assert.equal(addToToml({ file: f }), "added");
  assert.match(fs.readFileSync(f, "utf8"), /^\[mcp_servers\.manyscripts\]/);
});
