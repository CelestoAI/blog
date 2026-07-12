---
author: Aniket Maurya
pubDatetime: 2026-07-12T12:00:00Z
modDatetime: 2026-07-12T12:00:00Z
title: "How to Run Pi Coding Agent on a Celesto Cloud Computer"
description: "Keep Pi and your model credentials local while its coding tools run in an isolated Celesto cloud workspace, then safely sync the changes back."
featured: true
draft: false
tags:
  - Pi
  - Coding Agents
  - Agent Security
  - Celesto
  - Developer Tools
---

Coding agents are useful because they can inspect a project, edit files, run commands, and test their own work. Those are also exactly the capabilities you may not want running directly on your laptop.

Celesto gives [Pi coding agent](https://pi.dev/) a separate cloud computer for that work. Pi's terminal interface, conversation history, and model credentials stay on your machine. Its `read`, `write`, `edit`, and `bash` tools run against an isolated Linux workspace in Celesto.

When the task is done, you choose when to synchronize the files back to your local project.

## Why run Pi this way?

A normal local Pi session runs coding tools where your source code—and often your SSH keys, browser sessions, and other credentials—already live. Celesto separates the agent's execution environment from your personal computer.

The split looks like this:

| Your machine                     | Celesto computer                               |
| -------------------------------- | ---------------------------------------------- |
| Pi terminal interface            | Project copy in `$HOME/workspace`              |
| Conversation and session history | `read`, `write`, `edit`, and `bash` operations |
| Model-provider credentials       | Shell commands and test processes              |
| Celesto authentication           | Files created during the session               |

Pi still calls your chosen model provider locally. Model credentials are not forwarded to the Celesto computer, and the Celesto API key remains in the local Pi process.

You keep the workflow you already know while giving the agent a computer of its own.

## What you need

Before starting, make sure you have:

- Node.js 22.19 or newer
- [Pi installed](https://pi.dev/) and connected to a model provider
- A free [Celesto account](https://celesto.ai/sign-up)
- A Celesto API key from **Settings → Security**
- A local project you want Pi to work on

Celesto Free does not require a credit card. Fair-use runtime and active-computer limits apply.

## 1. Install the Celesto extension

Install the extension through Pi:

```shell
pi install npm:@celestoai/pi
```

Confirm that Pi loaded it:

```shell
pi --help
```

You should see `--celesto` among the extension flags.

## 2. Authenticate locally

The easiest option is to install the Celesto CLI and save your API key:

```shell
pip install celesto
celesto auth login
celesto auth status
```

You can instead export the key in your current shell:

```shell
export CELESTO_API_KEY="your-celesto-api-key"
```

Or place it in the project's local `.env` file:

```dotenv
CELESTO_API_KEY="your-celesto-api-key"
```

Make sure `.env` is in `.gitignore`. The extension excludes local `.env` files from workspace uploads by default.

## 3. Start Pi on Celesto

Change into your project and launch Pi:

```shell
cd your-project
pi --celesto
```

The extension creates a Celesto computer, copies the project to `$HOME/workspace`, and routes Pi's coding tools there. Pi will report the computer name and active workspace when it is ready.

Inside Pi, check the connection with:

```text
/celesto status
```

This shows the active computer, workspace, synchronization revision, and cleanup policy.

## 4. Give Pi a normal coding task

You do not need a special prompt. Ask Pi to work as you normally would:

```text
Add a health-check endpoint, run its tests, and explain the changes.
```

Pi reads the remote project, edits it, and runs the tests on the Celesto computer. Your local working tree stays unchanged during this work.

Press `Esc` if you need to stop a long-running command. The extension terminates the remote process group without disconnecting the computer.

## 5. Sync the result back

When you are ready to bring the work to your machine, run this inside Pi:

```text
/celesto sync
```

Then inspect the result locally:

```shell
git diff
```

Synchronization works in both directions:

- A file changed only on Celesto is copied locally.
- A file changed only locally is pushed to Celesto.
- Identical files are left alone.
- Deletions are applied when the other copy is unchanged.
- If both copies changed differently, neither is silently overwritten.

For a conflict, the remote version is preserved under:

```text
.celesto-conflicts/<revision>/<path>.remote
```

Resolve the local file, remove the conflict copy when you no longer need it, and run `/celesto sync` again.

Git should remain your durable source of truth. Commit before a long session, sync regularly, and review `git diff` afterward.

## Keep or reuse a computer

By default, the extension performs a final sync and deletes a computer it created when Pi exits.

To keep it for another session, run:

```text
/celesto keep
```

You can also reuse an existing computer. List available computers:

```shell
celesto computer list
```

Then start Pi with its name or ID:

```shell
pi --celesto --celesto-computer curie
```

A computer selected this way belongs to you and is never automatically deleted by the extension.

## What gets uploaded?

The extension reads `.gitignore` and then applies any additional rules in `.celestoignore`. It also excludes common sensitive or generated content by default, including:

- `.env` and common credential files
- SSH, cloud-provider, Pi, and package-manager credentials
- `node_modules`, build output, coverage output, and `.next`
- symbolic links
- files larger than 25 MB
- synchronization metadata and `.celesto-conflicts`

The `.git` directory remains available so Pi can inspect branches, status, and diffs.

Add project-specific exclusions in `.celestoignore`:

```gitignore
fixtures/private/
*.large-test-data
```

Review both ignore files before your first session. A file intentionally included in the project can still be copied to Celesto even if it contains sensitive application data.

## Useful commands

| Command           | What it does                                                       |
| ----------------- | ------------------------------------------------------------------ |
| `/celesto status` | Shows the active computer, workspace, cleanup policy, and revision |
| `/celesto sync`   | Reconciles the local project with the remote workspace             |
| `/celesto keep`   | Keeps an extension-created computer after Pi exits                 |
| `!<command>`      | Runs a shell command on the Celesto computer                       |

Update the extension later with:

```shell
pi update npm:@celestoai/pi
```

## A local agent with a remote workspace

Celesto does not move your entire Pi session into the cloud. That distinction matters.

The interface and model connection remain local, where you control them. The operations that execute code and modify the project move to an isolated cloud computer. You get a disposable workspace without replacing Pi or changing how you talk to it.

Install the extension, run `pi --celesto`, and give your coding agent a computer separate from your own.

For complete setup and troubleshooting details, read the [Pi on Celesto guide](https://docs.celesto.ai/celesto-sdk/guides/pi-coding-agent) or view [`@celestoai/pi` in the Pi package catalog](https://pi.dev/packages/@celestoai/pi).
