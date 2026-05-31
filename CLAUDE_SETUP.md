# Claude setup

## Option 1: Claude.ai / remote MCP

Use this mode when the server is deployed to Railway, Render, VPS, or another public HTTPS host.

1. Create `.env` from `.env.example`.
2. Set:

```env
KIOTVIET_RETAILER=ducdiennhatrang
KIOTVIET_CLIENT_ID=your_client_id
KIOTVIET_CLIENT_SECRET=your_client_secret
TRANSPORT=http
PORT=3000
```

3. Build and start:

```bash
npm.cmd ci
npm.cmd run build
npm.cmd start
```

4. Add this MCP URL in Claude:

```text
https://your-domain.example/mcp
```

## Option 2: Claude Desktop local MCP

Use this mode when Claude Desktop runs the server directly on your computer.

1. Build the server:

```bash
npm.cmd ci
npm.cmd run build
```

2. Add a server entry to Claude Desktop config. Replace paths and keys with your real values:

```json
{
  "mcpServers": {
    "kiotviet-ducdiennhatrang": {
      "command": "node",
      "args": [
        "C:\\Users\\ADMIN\\Documents\\Codex\\2026-05-31\\ki-m-tra-file-v-code\\_claude_zip_review\\kiotviet-mcp-server\\dist\\index.js"
      ],
      "env": {
        "TRANSPORT": "stdio",
        "KIOTVIET_RETAILER": "ducdiennhatrang",
        "KIOTVIET_CLIENT_ID": "your_client_id",
        "KIOTVIET_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

## Quick checks

HTTP health check:

```bash
npm.cmd start
```

Then open:

```text
http://localhost:3000/health
```

The response should show `retailer: ducdiennhatrang`, `hasClientId: true`, and `hasClientSecret: true`.
