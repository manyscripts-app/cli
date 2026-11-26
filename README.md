# manyscripts

Add the [ManyScripts](https://www.manyscripts.com) MCP server to your AI apps in one command. Your agent can then get transcripts of TikTok, YouTube, Instagram, X, Facebook, Xiaohongshu (RedNote), Bluesky and LinkedIn videos.

```bash
npx -y manyscripts init
```

It finds the AI apps on your computer and adds `https://www.manyscripts.com/api/mcp` to each one. Restart the apps afterwards. You sign in to ManyScripts the first time the server runs. It works on the Free plan.

```bash
npx -y manyscripts init --dry-run           # show what would change
npx -y manyscripts init --only cursor,codex # pick apps
```

## What it changes

| App | How |
|---|---|
| Claude Code | `claude mcp add --transport http --scope user` if `claude` is installed, else `~/.claude.json` |
| Claude Desktop | Nothing. It prints the link to add ManyScripts as a connector (the config file only takes local servers) |
| Cursor | `~/.cursor/mcp.json` |
| Windsurf | `~/.config/devin/mcp_config.json` and `~/.codeium/windsurf/mcp_config.json`, where the folder exists |
| VS Code | `code --add-mcp` if `code` is installed, else the user `mcp.json` |
| Codex | `codex mcp add` if `codex` is installed (it opens the sign-in page), else `~/.codex/config.toml` |
| Gemini CLI | `~/.gemini/settings.json` (`httpUrl`) |

Before a file changes, it is copied to `<file>.manyscripts-bak`. Other servers and settings stay as they are. A file that is not plain JSON (for example with comments) is left alone. Running it twice does nothing the second time.

## Sources

Checked 2026-11-26: code.claude.com/docs/en/mcp, support.claude.com/en/articles/11175166, cursor.com/docs/context/mcp, docs.devin.ai/windsurf/plugins/cascade/mcp, code.visualstudio.com/docs/agents/reference/mcp-configuration, learn.chatgpt.com/docs/extend/mcp, geminicli.com/docs/tools/mcp-server.

## License

MIT
