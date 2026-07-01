---
author: Aniket Maurya
pubDatetime: 2026-07-01T11:00:00Z
modDatetime: 2026-07-01T11:00:00Z
title: "Petabyte-scale storage for AI agent sandboxes"
description: "CelestoFS gives AI agent sandboxes a durable petabyte-scale workspace filesystem for repositories, build artifacts, datasets, and workspace state."
featured: true
draft: false
tags:
  - Sandbox
  - Storage
---


# Petabyte-scale storage for AI agent sandboxes

Most conversations about AI sandboxes start with isolation. Can the agent run untrusted code safely? How quickly does the machine boot? Can it execute commands, install packages, and stream logs back to the user?

Those questions matter, but they miss what happens after the sandbox starts doing real work.

An agent does not just run a command and disappear. It turns a fresh machine into a workspace. It clones a repo, installs dependencies, downloads browsers, creates build directories, writes logs, saves screenshots, leaves traces, and comes back later with more context than it had at the start. The files are not incidental. They are the working memory of the task.

That is the storage problem.

A small coding task can become a large filesystem surprisingly quickly. A Next.js repo brings `node_modules`, `.next`, Playwright browser binaries, package caches, test reports, screenshots, and preview output. A Python project brings virtualenvs, wheels, pip caches, notebooks, datasets, model files, and reports. A Rust, Go, or C++ project brings toolchains, target directories, object files, debug symbols, binaries, benchmark results, and traces.

None of this is strange. It is what productive software work looks like on a real computer. The problem is that many sandboxes still treat storage as if the agent is running a tiny temporary script.

When the root disk fills up, the failure is rarely clean. The install breaks halfway through. The build emits an unrelated error. A browser test stops saving screenshots. A cache corrupts. A task that should resume instead starts over. The user sees "the agent failed," but the actual problem is simpler: the computer ran out of workspace.

Celesto sandboxes now include **CelestoFS**, a petabyte-scale durable workspace filesystem for AI agent sandboxes.

The root disk is for the computer. CelestoFS is for the work.

---

## The boot disk should not be the workspace

A VM root disk has an important job. It holds the operating system, package manager internals, runtime files, system services, and low-level machine state. It should be predictable, bounded, and easy to reason about.

Agent workspace data has a different shape. It grows while the agent works. The agent does not know at boot time whether a repo will need a few megabytes of dependencies or tens of gigabytes of browser binaries, compiled artifacts, generated datasets, and traces. Even the user often does not know that ahead of time.

You can make the root disk larger, but that only pushes the problem around. It couples system storage to workspace storage and forces a sizing decision before the task has revealed what it needs. If the root disk is too small, the task fails in confusing ways. If it is too large, the machine carries capacity it may never use.

That is the wrong abstraction for autonomous work.

Celesto splits the model into two durable storage surfaces:

| Storage             | Purpose                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| Root disk           | Operating system, runtime, package manager internals, and system-level state      |
| CelestoFS workspace | Repositories, generated files, datasets, build artifacts, logs, and project state |

Both survive normal `stop` and `start`. They just have different responsibilities.

This split matters because agents discover the size of the job by doing the job. A "small bug fix" becomes a full application environment. A "quick data task" becomes raw inputs, transformed tables, charts, notebooks, and audit files. A "simple benchmark" becomes compilers, binaries, traces, and repeated runs. The workspace should grow with that process without turning the boot disk into the bottleneck.

---

## CelestoFS behaves like a normal filesystem

CelestoFS is mounted inside the sandbox as a large durable workspace filesystem. The agent does not need a special storage API, a separate object store client, or a new persistence model. It uses normal file operations.

In Celesto Linux sandboxes, the default workspace path is:

```bash
/home/ohm
```

That path is where agents should keep repositories, generated files, build output, datasets, logs, reports, screenshots, and other task state. From inside the machine, it looks like a filesystem. From the platform's point of view, it is managed as durable workspace storage outside the root disk.

You can see the two surfaces directly:

```bash
celesto computer create --template coding-agent --disk-size-mb 10240
celesto computer run einstein "df -h / /home/ohm"
```

Example output:

```text
Filesystem      Size  Used Avail Use% Mounted on
/dev/root        10G  2.2G  7.8G  22% /
celestofs       1.0P  161M  1.0P   1% /home/ohm
```

`/dev/root` is the VM root disk. `celestofs` is the workspace filesystem. The root disk can stay small because the workspace no longer has to fit inside it.

---

## A 10 GiB sandbox can hold a 100 GiB workspace file

The easiest way to see the separation is to create a sandbox with a small root disk and then write something larger than that root disk into the workspace.

Create a sandbox with a 10 GiB root disk:

```bash
celesto computer create --template coding-agent --disk-size-mb 10240
```

Then write a 100 GiB file into `/home/ohm`:

```bash
celesto computer run einstein "python3 - <<'PY'
from pathlib import Path
import hashlib
import os

target_dir = Path('/home/ohm/storage-proof')
target_dir.mkdir(parents=True, exist_ok=True)
target = target_dir / 'hundred-gib.bin'

with target.open('wb') as f:
    for gib in range(100):
        for block_index in range(1024):
            seed = f'{gib}:{block_index}'.encode()
            block = hashlib.sha256(seed).digest() * 32768
            f.write(block)
        f.flush()
        os.fsync(f.fileno())
        print(f'wrote {gib + 1} GiB', flush=True)

print('final size bytes:', target.stat().st_size)
PY"
```

Verify the file size and compare both filesystems:

```bash
celesto computer run einstein "du -h /home/ohm/storage-proof/hundred-gib.bin && df -h / /home/ohm"
```

The result is the point of the design: a 100 GiB file lives in `/home/ohm` even though the VM root disk is 10 GiB. The root disk is still durable; it simply is not responsible for carrying the workspace.

Clean up the test data:

```bash
celesto computer run einstein "rm -rf /home/ohm/storage-proof"
celesto computer delete einstein
```

---

## Durable state changes how agents work

Large capacity is useful, but durability is just as important.

Write a file into the workspace:

```bash
celesto computer run einstein "echo saved > /home/ohm/state.txt"
```

Stop the computer:

```bash
celesto computer stop einstein
```

Start it again:

```bash
celesto computer start einstein
```

Read the file:

```bash
celesto computer run einstein "cat /home/ohm/state.txt"
```

Output:

```text
saved
```

That small example is doing more than proving persistence. It changes the contract between the user and the agent computer.

Stop means resume later. Delete means remove the saved state.

That distinction is essential for serious agent work. If an agent spends ten minutes installing dependencies, the next session should not repeat the same work. If it captures a browser trace that explains a failing test, the trace should still be there when the agent investigates the fix. If a data task creates intermediate tables that make a report reproducible, those files should not disappear because the machine paused.

Without durable workspace state, every interruption becomes a reset. With durable workspace state, an agent can work more like a developer: return to the same directory, reuse the same context, and continue from the evidence it already produced.

---

## The workspace is the evidence trail

For a frontend agent, progress is visible in files. The repo is only the starting point. The agent installs npm packages, downloads browser binaries, builds the app, runs Playwright, captures screenshots, saves traces, and produces a preview. When something breaks, the useful evidence is spread across those artifacts.

For a backend agent, the workspace includes the monorepo, dependency caches, migrations, test databases, logs, Docker context files, generated clients, and coverage reports. The files are not clutter; they explain what changed and why the change passed or failed.

For a systems agent, the workspace holds compilers, object files, debug symbols, binaries, benchmark output, crash dumps, and traces. Rebuilding that world from scratch on every run wastes time and destroys useful debugging context.

For a data agent, the workspace is often the product. Raw inputs, transformed Parquet files, notebooks, charts, reports, and intermediate audit files are how the final answer becomes reproducible. Throwing away the workspace throws away the chain of reasoning.

This is why "just give the sandbox a small temporary disk" breaks down. Temporary execution is fine for demos. Agent computers need room for the history of the task.

---

## How CelestoFS is implemented

CelestoFS uses JuiceFS internally.

JuiceFS gives us a filesystem layer that mounts inside the sandbox, while Celesto manages the storage lifecycle outside the guest. For metadata, our current setup uses SQLite. We use Litestream to replicate the SQLite state so filesystem metadata has durable backing.

The user does not need to mount JuiceFS, configure SQLite, or manage Litestream. The important boundary is simple: Celesto owns the storage plumbing, and the sandbox sees a filesystem.

That boundary keeps the agent interface boring in the right way. Tools that expect files can keep using files. Build systems can write where they already write. Test runners can emit reports. Browser tools can save traces. Data tools can create local datasets. The platform handles the durability and capacity behind the mount.

---

## How to use it

Use `/home/ohm` for agent workspace files.

Keep repositories, generated artifacts, datasets, build output, screenshots, logs, and reports in the workspace. Avoid `/tmp` for files the agent needs to keep.

Use this command when you need to inspect disk usage:

```bash
df -h / /home/ohm
```

Increase root disk size when the operating system, package manager internals, or system-level tools need more room. Use CelestoFS when the agent needs large durable workspace state.

Stop a computer when you plan to resume it later. Delete a computer when you no longer need its saved state.

---

## Petabyte-scale does not mean careless storage

Petabyte-scale workspace capacity is not an invitation to dump files forever. It means workspace capacity no longer has to be tied to VM root disk sizing.

That separation is the real feature. The root disk can stay focused on the system. The workspace can grow with the task. Agents can keep the files that make work resumable, inspectable, and reproducible without turning every sandbox into an oversized boot disk.

The first wave of agents worked mostly in prompts. The next wave works in computers. Those computers need more than command execution and isolation. They need durable filesystems that can hold real codebases, real builds, real artifacts, and real task history.

CelestoFS is the workspace layer for that model.

The root disk is for the computer. CelestoFS is for the work.
