---
author: Anurag Yadav
authorUrl: "https://www.linkedin.com/in/yadavanurag13"
pubDatetime: 2026-10-09T12:00:00Z
modDatetime: 2026-10-09T12:00:00Z
title: "Cloud computer for every personal bot -- Muse, Claude, Codex, Hermes, Instinct, et al."
description: "Connect Claude Code, Codex, Hermes Agent, or any MCP client to the Celesto hosted MCP server, then list, start, stop, and run commands on your cloud computers."
featured: false
draft: true
tags:
  - MCP
  - Claude Code
  - Codex
  - Hermes Agent
---

<!-- TODO(author): confirm author name/authorUrl (copied from recent posts), publish date, and set draft: false when ready. -->
<!-- TODO(author): add an ogImage (see src/data/blog/smolvm/firecracker-macos.md for the `ogImage: ./images/...` convention). No cover image has been created. -->

Celesto now has a hosted MCP server. Once your coding tool is connected, you can ask it to work with your Celesto cloud computers in plain language: see which ones you have, start or stop them, and run a command on one.

You sign in with your Celesto account in the browser. There is no API key to copy into a config file.

## What you need

A Celesto account, and one of Claude Code, Codex, or Hermes Agent installed on your machine. Other MCP clients work too; see the generic steps below.

The server URL is the same for every client:

```text
https://mcp.celesto.ai/mcp
```

## What the tools can do

The server exposes ten tools, all named `cloud_computer_*`:

| Tool                            | What it does                                        |
| ------------------------------- | --------------------------------------------------- |
| `cloud_computer_list`           | Lists the cloud computers visible to your account   |
| `cloud_computer_info`           | Shows a computer's state and resource configuration |
| `cloud_computer_create`         | Creates a persistent cloud computer                 |
| `cloud_computer_start`          | Resumes a stopped computer                          |
| `cloud_computer_stop`           | Stops a computer and keeps its files                |
| `cloud_computer_delete`         | Permanently deletes a computer and its files        |
| `cloud_computer_exec`           | Runs a command and returns its output and exit code |
| `cloud_computer_port_publish`   | Publishes an HTTP port and returns its public URL   |
| `cloud_computer_port_list`      | Lists the public ports of a computer                |
| `cloud_computer_port_unpublish` | Removes a public port                               |

Your coding tool picks the right tool from your request. You do not need to call them by name.

<!-- TODO(author): confirm what the consent page shows. The server checks a read, exec, or admin scope per tool (list/info/port list need read; create/start/stop/exec/port publish/unpublish need exec; delete needs admin), but this draft does not claim a scope picker on the consent screen. -->

## Claude Code

Add the server:

```shell
claude mcp add --transport http celesto https://mcp.celesto.ai/mcp
```

Then start Claude Code, run `/mcp`, choose `celesto`, and log in. Your browser opens a Celesto consent page. Approve it and return to Claude Code.

## Codex

Add the server:

```shell
codex mcp add celesto --url https://mcp.celesto.ai/mcp
```

Then sign in:

```shell
codex mcp login celesto
```

Codex opens the browser for the OAuth login. Approve the request on the Celesto page.

## Hermes Agent

Add the server to `~/.hermes/config.yaml`. If the file already has an `mcp_servers` section, add only the `celesto` entry to it.

```yaml
mcp_servers:
  celesto:
    url: "https://mcp.celesto.ai/mcp"
    auth: oauth
```

Reload the MCP servers in Hermes (`/reload-mcp`) and sign in with `hermes mcp login celesto`. Approve the request on the Celesto page in your browser.

<!-- TODO(author): the Hermes steps come from the Hermes MCP docs and have not been run against mcp.celesto.ai. Test them (including `hermes mcp test celesto`) before publishing. -->

## Any other MCP client

Any client that supports remote MCP servers over Streamable HTTP and the standard MCP browser login (OAuth) can connect. You need two things:

1. The server URL: `https://mcp.celesto.ai/mcp`
2. A way to sign in through the browser. The client finds the login endpoints from the server, so you do not enter any client ID or secret.

Most clients take the same shape of config, in their own file:

```json
{
  "mcpServers": {
    "celesto": {
      "url": "https://mcp.celesto.ai/mcp"
    }
  }
}
```

Check your client's MCP documentation for where that file lives and for the login command. The server does not support the older SSE transport or local stdio, so a client that only offers those cannot connect.

<!-- TODO(author): the generic requirements above come from how the server works (Streamable HTTP, OAuth with PKCE). Only Claude Code, Codex, and Cursor were tested against it. Hermes was NOT tested. -->

## Try it

Once connected, try these prompts:

1. `List my Celesto cloud computers.`
2. `Start the computer named <name> and tell me when it is running.`
3. `On <name>, run uname -a and df -h and show me the output.`

Replace `<name>` with a name from the first prompt. Command output and the exit code come back in the conversation.

## Get help

If something here does not work for you, contact us at <!-- TODO(author): support channel / email / Discord link -->.

<!-- TODO(author): add a link to the official MCP docs page once it exists. None was confirmed when this draft was written. -->
