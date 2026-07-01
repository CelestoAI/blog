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

Most AI sandbox posts focus on isolation, boot speed, and command execution.

That misses a core part of the runtime: storage.

Real agents create state.

A code agent does not edit one file and exit. It clones repositories, installs dependencies, pulls package caches, runs test suites, builds apps, saves logs, writes traces, and leaves artifacts for the next step.

A small repo can turn into a huge workspace fast.

A Node.js task can create gigabytes of `node_modules`, `.next`, Playwright browser binaries, package caches, lockfiles, and build output.

A Python task can create virtualenvs, wheels, pip caches, model files, notebooks, test reports, and datasets.

A Rust, Go, or C++ task can create target directories, object files, debug symbols, compiled binaries, and cache folders that dwarf the source code.

That is before the agent touches screenshots, browser downloads, trace files, generated reports, user artifacts, or audit logs.

If the sandbox only has a small root disk, the agent hits a wall fast.

The failure rarely looks clean. It shows up as a broken install, a failed build, a half-written artifact, a corrupted cache, or a task that cannot resume.

That is the wrong failure mode for agent infrastructure.

Agents need durable computers.

Durable computers need durable filesystems.

That is why Celesto sandboxes now include **CelestoFS**: a petabyte-scale workspace filesystem for AI agent sandboxes.

The root disk is for the computer.

CelestoFS is for the work.

---

## Why root disk size is the wrong abstraction

A VM root disk has an important job.

It holds the operating system, runtime, package manager internals, system services, and low-level state.

But agent workspace data has a different shape.

Workspace data can include:

* cloned repositories
* `node_modules`
* Python virtualenvs
* package manager caches
* compiled binaries
* build artifacts
* screenshots
* browser downloads
* generated reports
* test logs
* datasets
* notebooks
* trace files
* project state

Those files should not have to compete with the OS for root disk space.

You can make the root disk bigger, but that is a blunt fix. It couples system storage to workspace storage. It also forces users to guess the right disk size before the agent does the work.

That does not fit autonomous tasks.

An agent may start with a small repo and then pull dependencies, compile code, run browser tests, create artifacts, and save debug traces. The workspace can grow far beyond the original plan.

So we split the storage model.

Celesto sandboxes have two durable storage surfaces:

| Storage             | Purpose                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| Root disk           | Operating system, runtime, package manager internals, and system-level state      |
| CelestoFS workspace | Repositories, generated files, datasets, build artifacts, logs, and project state |

Both survive normal `stop` and `start`.

They just have different jobs.

--- 

## Introducing CelestoFS

CelestoFS is a large durable workspace filesystem mounted inside the sandbox.

From inside the sandbox, it behaves like a normal filesystem. Your agent can use normal file operations: clone repos, write files, create folders, save artifacts, and resume work later.

In Celesto Linux sandboxes, the default workspace path is:

```bash
/home/ohm
```

Run `df -h / /home/ohm` inside a Celesto sandbox and you can see both storage surfaces:

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

`/dev/root` is the VM root disk.

`celestofs` is the large durable workspace filesystem.

The root disk can stay small even when the workspace becomes large.

---

## A 10 GiB sandbox can hold a 20 GiB workspace file

Here is the simplest proof.

Create a sandbox with a 10 GiB root disk:

```bash
celesto computer create --template coding-agent --disk-size-mb 10240
```

Then write a 20 GiB file into the workspace:

```bash
celesto computer run einstein "python3 - <<'PY'
from pathlib import Path
import hashlib
import os

target_dir = Path('/home/ohm/storage-proof')
target_dir.mkdir(parents=True, exist_ok=True)
target = target_dir / 'twenty-gib.bin'

with target.open('wb') as f:
    for gib in range(20):
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
celesto computer run einstein "du -h /home/ohm/storage-proof/twenty-gib.bin && df -h / /home/ohm"
```

You should see a 20 GiB file inside `/home/ohm`, even though the root disk is 10 GiB.

That does not mean the root disk is temporary.

It means root disk storage and workspace storage have different jobs.

Clean up the test data:

```bash
celesto computer run einstein "rm -rf /home/ohm/storage-proof"
celesto computer delete einstein
```

---

## Workspace state survives stop and start

CelestoFS is durable across normal sandbox lifecycle operations.

Write a file:

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

This is important for agent tasks.

A serious code agent needs to resume from the same workspace. It should not lose the repo, the cache, the test output, or the partial artifact just because the machine stopped.

Stop means resume later.

Delete means remove the saved state.

---

## Why this matters for code agents

Code agents produce a lot of files.

They also rely on those files across steps.

A frontend agent may:

* clone a Next.js app
* install npm packages
* pull Playwright browser binaries
* create `.next`
* run tests
* save screenshots
* produce a preview build

A backend agent may:

* clone a monorepo
* install Python or Go dependencies
* run migrations
* create test databases
* emit logs
* build Docker context files
* save coverage reports

A systems agent may:

* compile Rust or C++
* create object files
* save debug symbols
* cache toolchains
* run benchmarks
* write trace files

A data agent may:

* download datasets
* create Parquet files
* save notebooks
* produce charts
* export reports
* keep intermediate files for audit

These are not edge cases.

This is what real agent work looks like.

Tiny temporary disks make sense for toy execution.

They do not make sense for agent computers.

---

## How it works

CelestoFS uses JuiceFS internally.

JuiceFS gives us a filesystem layer that can mount inside the sandbox, while Celesto manages the storage lifecycle outside the guest.

For metadata, our current setup uses SQLite.

We use Litestream to replicate the SQLite state so filesystem metadata has durable backing.

The user does not need to mount JuiceFS, configure SQLite, or manage Litestream.

---

## Best practices

Use `/home/ohm` for agent workspace files.

Keep repositories, generated artifacts, datasets, and build output in the workspace.

Avoid `/tmp` for files you want to keep.

Use this command when you need to inspect disk usage:

```bash
df -h / /home/ohm
```

Increase root disk size when the operating system, package manager, or system-level tools need more room.

Use CelestoFS when the agent needs large durable workspace state.

Stop a computer when you plan to resume it later.

Delete a computer when you no longer need its saved state.

---

## Petabyte-scale does not mean careless storage

CelestoFS gives sandboxes petabyte-scale workspace capacity.

That does not mean every task should dump files forever.

It means workspace capacity no longer has to track the VM root disk.

The root disk can stay focused on the system.

The workspace can grow with the task.

That separation gives agents a much better runtime model.

---

## Agents need computers with real filesystems

The first wave of agents worked in prompts.

The next wave works in computers.

Those computers need more than command execution.

They need isolation.

They need durable state.

They need workspace storage that can handle real codebases, real builds, real artifacts, and real task history.

CelestoFS is the workspace layer for that model.

The root disk is for the computer.

CelestoFS is for the work.
