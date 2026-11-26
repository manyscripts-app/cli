// Where each AI app keeps its MCP settings, and how a remote server looks there.
// Sources (checked 2026-11-26) are in README.md under "Sources".
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export const SERVER_NAME = "manyscripts";
export const SERVER_URL = "https://www.manyscripts.com/api/mcp";
export const CLAUDE_CONNECTOR_URL = "https://claude.ai/directory/manyscripts";

const home = () => os.homedir();
const isWin = () => process.platform === "win32";
const isMac = () => process.platform === "darwin";
const appData = () => process.env.APPDATA || path.join(home(), "AppData", "Roaming");
const xdgConfig = () => process.env.XDG_CONFIG_HOME || path.join(home(), ".config");
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };

/** Per-user app settings folder: macOS Application Support, Windows %APPDATA%, Linux ~/.config. */
const appSupport = () =>
  isMac() ? path.join(home(), "Library", "Application Support") : isWin() ? appData() : xdgConfig();

/**
 * Each client has:
 * - id, name
 * - detect(onPath): true when the app looks installed
 * - cli (optional): { bin, args } run instead of editing files when `bin` is on PATH
 * - files (optional): () => [{ file, key, entry, toml? }] edited when the CLI is not available
 * - manual (optional): text to print instead of changing anything
 */
export const CLIENTS = [
  {
    id: "claude-code",
    name: "Claude Code",
    detect: (onPath) => onPath("claude") || exists(path.join(home(), ".claude")),
    cli: { bin: "claude", args: ["mcp", "add", "--transport", "http", "--scope", "user", SERVER_NAME, SERVER_URL] },
    files: () => [{ file: path.join(home(), ".claude.json"), key: "mcpServers", entry: { type: "http", url: SERVER_URL } }],
    after: "In Claude Code, run /mcp and pick manyscripts to sign in.",
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    detect: () => exists(path.join(appSupport(), "Claude")),
    // Claude Desktop only reads local (stdio) servers from its config file.
    // Remote servers are added as a connector in the app.
    manual: `Open ${CLAUDE_CONNECTOR_URL} and press Connect.`,
  },
  {
    id: "cursor",
    name: "Cursor",
    detect: () => exists(path.join(home(), ".cursor")),
    files: () => [{ file: path.join(home(), ".cursor", "mcp.json"), key: "mcpServers", entry: { url: SERVER_URL } }],
    after: "Cursor asks you to sign in the first time it uses ManyScripts.",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    detect: () =>
      exists(isWin() ? path.join(appData(), "devin") : path.join(xdgConfig(), "devin")) ||
      exists(path.join(home(), ".codeium", "windsurf")),
    files: () => {
      // Cascade now reads the Devin path. Older builds read ~/.codeium/windsurf.
      const out = [{
        file: isWin() ? path.join(appData(), "devin", "mcp_config.json") : path.join(xdgConfig(), "devin", "mcp_config.json"),
        key: "mcpServers",
        entry: { serverUrl: SERVER_URL },
        onlyIfDirExists: true,
      }];
      out.push({ file: path.join(home(), ".codeium", "windsurf", "mcp_config.json"), key: "mcpServers", entry: { serverUrl: SERVER_URL }, onlyIfDirExists: true });
      return out;
    },
    after: "Windsurf asks you to sign in the first time it uses ManyScripts.",
  },
  {
    id: "vscode",
    name: "VS Code",
    detect: (onPath) => onPath("code") || exists(path.join(appSupport(), "Code", "User")),
    cli: { bin: "code", args: ["--add-mcp", JSON.stringify({ name: SERVER_NAME, type: "http", url: SERVER_URL })] },
    files: () => [{ file: path.join(appSupport(), "Code", "User", "mcp.json"), key: "servers", entry: { type: "http", url: SERVER_URL } }],
    after: "VS Code asks you to sign in the first time Copilot uses ManyScripts.",
  },
  {
    id: "codex",
    name: "Codex",
    detect: (onPath) => onPath("codex") || exists(path.join(home(), ".codex")),
    cli: { bin: "codex", args: ["mcp", "add", SERVER_NAME, "--url", SERVER_URL] },
    files: () => [{ file: path.join(home(), ".codex", "config.toml"), toml: true }],
    after: "If Codex did not open a sign-in page, run: codex mcp login manyscripts",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    // ~/.gemini alone is not enough: other Google tools create it too.
    detect: (onPath) => onPath("gemini") || exists(path.join(home(), ".gemini", "settings.json")),
    // Gemini: httpUrl = Streamable HTTP. Plain url would mean SSE.
    files: () => [{ file: path.join(home(), ".gemini", "settings.json"), key: "mcpServers", entry: { httpUrl: SERVER_URL } }],
    after: "In Gemini CLI, run: /mcp auth manyscripts",
  },
];
