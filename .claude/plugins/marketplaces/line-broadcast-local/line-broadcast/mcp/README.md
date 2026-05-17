# line-broadcast MCP server

Stdio MCP server (JSON-RPC 2.0, **zero npm deps**) — exposes the broadcast workflow as 8 tools for any MCP-compatible client.

## Tools

| Tool | Purpose |
|---|---|
| `update_products` | Refresh CNY cache (~24s) |
| `cache_status` | Check cache age/totals without refetching |
| `list_tags` | Resolve tag names → numeric IDs |
| `pick_products` | Query cache (keyword/theme/limit) — <50ms |
| `estimate_recipients` | Count LINE users for given tag IDs |
| `build_flex_2up` | Generate Flex JSON (2 products/bubble) |
| `list_scheduled_broadcasts` | Check for scheduling conflicts |
| `submit_broadcast` | POST scheduled broadcast to inbox.re-ya.com |

## Prerequisites

1. **Node.js** 18+ (uses `node:https`, `node:fs`, `node:child_process` — all stdlib)
2. **Cookie file** (1 line: `__Secure-authjs.session-token=eyJ…`)
3. **Cache** built once via `update_products` tool (~24s)

## Install

Extract plugin zip:

```bash
mkdir -p ~/.claude/plugins/marketplaces/line-broadcast-local
unzip line-broadcast-plugin.zip -d ~/.claude/plugins/marketplaces/line-broadcast-local
```

ติด deps สำหรับ XLSX export (optional แต่แนะนำ — XLSX writer ใน `refresh-cache.cjs`):
```bash
cd ~/.claude/plugins/marketplaces/line-broadcast-local/line-broadcast
npm install
```

> MCP server เอง **ไม่ต้อง** npm install — ใช้ stdlib อย่างเดียว

## Client configuration

ทุก client ต้องการ 3 อย่าง:
- **command**: `node`
- **args**: absolute path → `mcp/server.cjs`
- **env.AUTH_COOKIE_PATH**: absolute path → `.auth-cookie` (1 บรรทัด)

### Claude Desktop

ที่อยู่ config:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "line-broadcast": {
      "command": "node",
      "args": ["/Users/you/.claude/plugins/marketplaces/line-broadcast-local/line-broadcast/mcp/server.cjs"],
      "env": {
        "AUTH_COOKIE_PATH": "/Users/you/projects/inboxreya/.auth-cookie"
      }
    }
  }
}
```

Windows ใช้ forward slashes ได้:
```json
"args": ["C:/Users/you/.claude/plugins/marketplaces/line-broadcast-local/line-broadcast/mcp/server.cjs"]
```

### Cursor (`~/.cursor/mcp.json` หรือ workspace `.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "line-broadcast": {
      "command": "node",
      "args": ["/path/to/.claude/plugins/marketplaces/line-broadcast-local/line-broadcast/mcp/server.cjs"],
      "env": { "AUTH_COOKIE_PATH": "/path/to/project/.auth-cookie" }
    }
  }
}
```

### Cline / Roo Code (VS Code)

แก้ `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "line-broadcast": {
      "command": "node",
      "args": ["/path/to/mcp/server.cjs"],
      "env": { "AUTH_COOKIE_PATH": "/path/to/.auth-cookie" },
      "disabled": false,
      "autoApprove": ["cache_status","list_tags","pick_products","list_scheduled_broadcasts","estimate_recipients","build_flex_2up"]
    }
  }
}
```

> `autoApprove` ให้ข้าม per-call confirm สำหรับ tool อ่านอย่างเดียว — แต่ `update_products` (network) และ `submit_broadcast` (irreversible) ยังต้องกด approve

### Claude Code (ใช้ควบกับ slash commands ได้)

เพิ่มใน `~/.claude.json` หรือ project `.mcp.json`:

```json
{
  "mcpServers": {
    "line-broadcast": {
      "command": "node",
      "args": ["/path/to/mcp/server.cjs"],
      "env": { "AUTH_COOKIE_PATH": "/path/to/.auth-cookie" }
    }
  }
}
```

### Custom client (Python / TS)

ใช้ `@modelcontextprotocol/sdk` (Python หรือ TS) แล้ว spawn server ด้วย stdio transport. Server พูด JSON-RPC 2.0 ปกติ ไม่มี extension แปลกๆ

## Typical agent workflow

```
1. cache_status                                              → check freshness
2. (if stale) update_products                                → ~24s refresh
3. list_tags                                                 → get tag IDs
4. pick_products({keyword:"วิตามินซี", limit:12})            → curate
5. estimate_recipients({targetTagIds:[36,31]})               → confirm audience
6. build_flex_2up({products, title:"…", ctaLabel:"ซื้อเลย"}) → build flex
7. → (human approval in chat) →
8. submit_broadcast({flexMessages, contentText, scheduledAt, targetTagIds})
```

## Smoke test manually

```bash
printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node /path/to/mcp/server.cjs
```

Expect 2 JSON-RPC responses (initialize + tools array of 8).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `cookie not found` | Set `AUTH_COOKIE_PATH` env or put `.auth-cookie` in cwd |
| `cache missing` | Call `update_products` first |
| `tags fetch failed: 401` | Cookie expired → re-login on inbox.re-ya.com → update file |
| `submit failed: 400` validation | inputs malformed — check `targetTagIds` are integers and `scheduledAt` parses to a valid Date |
| Tool listing works but call hangs | Network/timeout — script timeout is 25s; check VPN/firewall to inbox.re-ya.com |
| `xlsx skipped` warning during update_products | run `npm install` in plugin folder (xlsx is optional dep) |

## Architecture

```
MCP client (Claude Desktop / Cursor / Cline / custom)
        │  stdio JSON-RPC 2.0
        ▼
   mcp/server.cjs   ◀── this file (zero npm deps)
        │
        ├─ HTTPS → inbox.re-ya.com (cookie auth)
        ├─ spawn → scripts/refresh-cache.cjs   (update_products)
        ├─ spawn → scripts/build-flex-2up.cjs  (build_flex_2up)
        └─ read  → .cache/cny-products.json    (pick_products, cache_status)
```
