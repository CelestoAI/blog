---
author: Celesto AI
pubDatetime: 2026-10-19T12:00:00Z
title: "Deploy a React app on cloud"
slug: deploy-a-react-app-on-cloud
featured: true
draft: false
tags:
  - React
  - Celesto
  - Cloud
  - MCP
description: "Deploy a React app to a Celesto cloud computer, build it with Vite, and share a public HTTPS preview through your AI assistant."
---

A React app on your laptop is hard to share: teammates cannot open your `localhost` URL, and a demo depends on your laptop's availability. Celesto gives the app a cloud computer and a public HTTPS link. Your AI assistant can set it up, build the app, and publish the link so teammates can try it in their browsers while your laptop is offline.

This guide takes you from a React project to a public preview. It uses Vite to turn your source code into files a browser can load. Celesto's [public ports](https://celesto.ai/docs/cloud/features/publish-ports) support short-lived previews and development workflows. The cloud computer and app process must stay active for the link to work.

## What you need

- A [Celesto account](https://celesto.ai/sign-up) with access to cloud computers.
- An AI assistant that supports remote MCP, such as Claude Code or Codex.
- A React project in a Git repository, or the starter app below.

MCP, the Model Context Protocol, lets your assistant call Celesto tools from your conversation. All app commands run on the cloud computer, so you do not need Node.js on your laptop.

## 1. Connect your assistant to Celesto

Add a remote MCP server in your assistant with this URL:

```text
https://mcp.celesto.ai/mcp
```

Select Streamable HTTP as the connection type and OAuth for authentication, then complete the browser sign-in flow. For client-specific commands, follow our [Celesto MCP setup guide](/blog/posts/platform/connect-claude-code-codex-hermes-to-celesto-mcp/).

Check the connection with this prompt:

```text
Use Celesto to list my cloud computers.
```

An empty list is fine if this is your first computer.

## 2. Create a cloud computer

Ask your assistant:

```text
Create a Celesto cloud computer with the coding-agent template.
Show me the available sizes and ask me which size to use.
After I choose, create the computer and save its ID for this task.
Run node --version, npm --version, and git --version on it.
```

The `coding-agent` template includes Node.js, Git, and common build tools. Keep the computer ID so your assistant can use the same computer throughout the tutorial.

Check the Node.js version against [Vite's requirements](https://vite.dev/guide/). Use a supported version such as Node.js 22.12 or later in the 22.x series. If the template has an older version, ask your assistant to install a compatible version before the next step.

## 3. Put the React app on the computer

Ask your assistant to run each command block below **inside the Celesto computer**, through `cloud_computer_exec`. Each block selects the project directory because separate tool calls do not retain the previous shell's directory. Allow up to 300 seconds for installs and builds. Continue only after each command succeeds.

For a new app, use [Vite's React template](https://vite.dev/guide/):

```shell
cd "$HOME" &&
npm create vite@latest react-app -- --template react --no-interactive &&
cd react-app &&
npm install
```

For an existing Vite React app, use this block instead. Replace the repository URL with yours; this example assumes a public repository with a committed `package-lock.json`:

```shell
cd "$HOME" &&
git clone https://github.com/YOUR_ORG/YOUR_REPO.git react-app &&
cd react-app &&
npm ci
```

A private repository requires Git credentials on the cloud computer. Set up repository access before the clone, and keep tokens out of repository URLs and chat messages.

## 4. Build and serve the app

Build the app and install a static file server:

```shell
cd "$HOME/react-app" &&
npm run build &&
npm install --save-dev --save-exact serve@14.2.4
```

Vite writes the compiled HTML, JavaScript, and CSS to `dist` by default. Serve that directory with [`serve`](https://github.com/vercel/serve). Vite's own [deployment guide](https://vite.dev/guide/static-deploy.html) explains that `vite preview` is a local preview command, not a production server.

```shell
cd "$HOME/react-app" &&
setsid -f sh -c 'exec ./node_modules/.bin/serve -s dist -l tcp://0.0.0.0:3000 > "$HOME/react-app-server.log" 2>&1 < /dev/null'
```

Port 3000 is the address number Celesto uses to reach the app. The server binds to `0.0.0.0` so it accepts traffic from outside its own computer. The `-s` option serves `index.html` for unmatched paths, so React can handle routes such as `/dashboard` after a page refresh. `setsid -f` keeps the server active after the command session ends, but does not restart it after a crash or computer restart.

In a separate tool call, verify that the server responds:

```shell
curl --fail --show-error --silent http://127.0.0.1:3000/ > /dev/null
```

Exit code `0` confirms a successful HTTP response. If the server has not started yet, inspect its log and retry the check:

```shell
tail -n 50 "$HOME/react-app-server.log"
```

## 5. Publish the app and open its URL

Ask your assistant:

```text
Publish port 3000 on the Celesto computer for this task.
Use cloud_computer_port_list to confirm the route status is published.
Return the public URL and the computer ID.
```

The assistant calls `cloud_computer_port_publish` with the computer ID as `name` and `3000` as `port`. Celesto returns the public URL. See the [MCP reference](https://celesto.ai/docs/cloud/mcp-server) for the tool arguments.

Open the URL in your browser. Confirm that the page loads, its buttons work, and its JavaScript and CSS requests succeed. If your app has client-side routes, open one directly and refresh it too.

Anyone with the URL can send requests to the app. Add app-level authentication if it exposes private data. Keep API secrets on a backend; values bundled into a React app are visible to visitors.

## Update the app

For a project cloned from Git, first commit the `serve` dependency and lockfile changes from step 4 to your repository. Push your app changes, then ask your assistant to run:

```shell
cd "$HOME/react-app" &&
git pull --ff-only &&
npm ci &&
npm run build
```

For the starter app, edit the source on the computer and run `npm run build` from the project directory.

The static server reads the new files from `dist`. Refresh the public URL and verify the result. An in-place build can briefly interrupt requests, so use this simple update flow for previews.

## Fix common errors

| Symptom                                      | What to check                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Build fails                                  | Read the build output. Confirm the Node.js version and dependency install succeeded.                               |
| Local curl fails                             | Read `~/react-app-server.log`. Confirm the build produced `dist` and the server uses port 3000.                    |
| Local curl succeeds but the public URL fails | Check that the computer is active, the route status is `published`, and the server uses `0.0.0.0:3000`.            |
| HTML loads but the page is blank             | Inspect the browser console and asset requests. A root-level deployment normally needs Vite's default `base: '/'`. |
| API calls fail in the browser                | Use a browser-accessible HTTPS API URL. `localhost` in frontend code refers to the visitor's computer.             |

## Remove public access or stop the computer

To remove the URL, ask your assistant to unpublish port 3000 on this computer. That removes public access but leaves the app process active.

Stop the computer when you want to preserve its files for later. A stop interrupts processes and suspends public ports. After a restart, start the static server again and check the route status before you reuse the URL.

Delete the computer only when you no longer need its files. Save your source code in Git first.
