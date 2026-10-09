---
author: Anurag Yadav
authorUrl: "https://www.linkedin.com/in/yadavanurag13"
pubDatetime: 2026-10-09T20:22:53Z
modDatetime: 2026-10-09T20:22:53Z
title: "Give Claude Code, Codex, and Hermes a Celesto Cloud Computer"
description: "Connect Claude Code, Codex, Hermes Agent, or another MCP client to Celesto. List, create, start, stop, and use cloud computers from your agent."
featured: false
draft: false
tags:
  - MCP
  - Claude Code
  - Codex
  - Hermes Agent
---

AI agents often need a real computer to inspect files, run a command, or expose a service. Without one, you must switch between your coding tool and a cloud console. That interrupts the task and removes context from the agent.

Celesto's hosted MCP server gives Claude Code, Codex, Hermes Agent, and other compatible clients direct access to your Celesto cloud computers. After browser sign-in, ask your agent to inspect your computers, create one, start or stop one, run commands, or publish an HTTP port. No API key or local secret is required.

## Before you connect

You need a Celesto account and an MCP client. Claude Code, Codex, and Hermes Agent have instructions below. Other clients must support remote MCP over Streamable HTTP and browser-based OAuth.

Every client uses this server URL:

```text
https://mcp.celesto.ai/mcp
```

## What your agent can do

The server provides ten `cloud_computer_*` tools. Your agent selects the appropriate tool from your request.

| Tool                            | Result                                              |
| ------------------------------- | --------------------------------------------------- |
| `cloud_computer_list`           | Lists the cloud computers in your account           |
| `cloud_computer_info`           | Shows a computer's state and resource configuration |
| `cloud_computer_create`         | Creates a persistent cloud computer                 |
| `cloud_computer_start`          | Starts a stopped computer                           |
| `cloud_computer_stop`           | Stops a computer and preserves its files            |
| `cloud_computer_delete`         | Deletes a computer and its files permanently        |
| `cloud_computer_exec`           | Runs a command and returns output and exit code     |
| `cloud_computer_port_publish`   | Publishes an HTTP port and returns its public URL   |
| `cloud_computer_port_list`      | Lists a computer's public ports                     |
| `cloud_computer_port_unpublish` | Removes a public port                               |

## Connect your client

Choose your client and add the Celesto MCP server. The browser opens a Celesto consent page when the client needs authorization.

### Claude Code

Add the server:

```shell
claude mcp add --transport http celesto https://mcp.celesto.ai/mcp
```

Start Claude Code, run `/mcp`, select `celesto`, and sign in through the browser.

### Codex

Add the server:

```shell
codex mcp add celesto --url https://mcp.celesto.ai/mcp
```

Then authorize it:

```shell
codex mcp login celesto
```

Codex opens the Celesto consent page in your browser.

### Hermes Agent

Add Celesto to `~/.hermes/config.yaml`. If `mcp_servers` already exists, add only the `celesto` entry.

```yaml
mcp_servers:
  celesto:
    url: "https://mcp.celesto.ai/mcp"
    auth: oauth
```

Reload MCP servers with `/reload-mcp`, then authorize Celesto:

```shell
hermes mcp login celesto
```

### Another MCP client

Configure a remote MCP server with this URL:

```json
{
  "mcpServers": {
    "celesto": {
      "url": "https://mcp.celesto.ai/mcp"
    }
  }
}
```

Use your client's browser-login command to authorize Celesto. You do not need a client ID or client secret. Clients that only support SSE or local stdio cannot connect.

## Try it

After authorization, ask your agent:

1. `List my Celesto cloud computers.`
2. `Start the computer named <name> and tell me when it is ready.`
3. `On <name>, run uname -a and df -h. Show me the output.`

Replace `<name>` with a name from the first response. The command result and exit code appear in the conversation.
