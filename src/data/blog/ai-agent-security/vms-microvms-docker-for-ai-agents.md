---
title: "VMs vs microVMs vs Docker for AI Agents"
description: "Not all isolation is equal. Here's how to pick the right one for your AI agents."
featured: true
draft: false
author: Aniket Maurya
authorUrl: "https://www.linkedin.com/in/aniketmaurya"
pubDatetime: 2026-04-10
modDatetime: 2026-04-10
tags:
  - Agent Security
  - Security
  - Docker
  - microVM
---

When people hear "AI agent," most think of coding assistants or desktop apps like Claude or Cursor. That is one kind of agent. But it is not the whole picture.

Companies are building agents into their own platforms — customer support bots that take actions, internal tools that process documents, services that browse the web on behalf of users. These agents are not someone typing in a chat window. They are code running inside a product, often handling untrusted input at scale.

The environment you run these agents in matters a lot. This post compares three options — Docker containers, traditional VMs, and microVMs — and helps you decide which one fits your use case.

---

## Two kinds of agents, two kinds of risk

Before comparing isolation technologies, it helps to understand what the agent is actually doing. That determines how much risk you are taking on.

### Coding agents

These are the agents most developers know. You give them a task — "fix this bug," "write a test," "refactor this module" — and they generate and run code on your behalf. Tools like Claude Code, Cursor, and Copilot fall into this category.

The risk profile here is **local and developer-facing**:

- The agent runs commands on your machine (or a machine you control).
- It may install packages, modify files, or execute shell scripts.
- If something goes wrong, **you** are the one affected — your files, your environment, your credentials.

The blast radius is limited to one developer's workspace. That is still worth protecting, but the exposure is contained.

### External-facing agents

This is where the risk changes completely.

Many companies integrate agents directly into their products. A B2B platform might build an agent that:

- Processes customer-uploaded documents
- Executes user-provided workflows
- Browses websites or calls APIs on behalf of end users
- Runs code that users submit or configure

These agents handle **untrusted input from external users**, often at scale, often without a human watching each action.

The risk profile here is **production and multi-tenant**:

- A prompt injection from one user could affect another user's data.
- A malicious file could trick the agent into leaking secrets or making unauthorized API calls.
- A compromised agent could become a way into your internal systems.
- Every agent session is an attack surface.

This is not a developer tool anymore. This is infrastructure. And infrastructure needs real isolation.

---

## The three options

### Docker containers

Docker is the most popular way to package and run software today. It is fast, lightweight, and familiar to most engineering teams.

A Docker container wraps your application and its dependencies into a portable unit. You can start one in under a second. You can run hundreds on a single machine. The tooling is mature and well-documented.

But Docker was designed for **packaging and deployment**, not for **security isolation** — and not for behaving like a full computer.

A Docker container is not a full operating system. It is a single process (or a small group of processes) running in isolation. That means many things an AI agent needs to do simply do not work well in a container:

- **Installing system packages** — agents often need to `apt install` tools, compilers, or libraries. Containers can do this, but the result is fragile. There is no proper init system managing services, no systemd, no clean way to start and stop background processes.
- **Running multiple services** — an agent might need a database, a web server, and a browser running at the same time. Containers are designed to run one process. You can work around this, but you are fighting the design.
- **Using the system like a real computer** — agents want to run shell commands, manage files, start and stop programs, and generally behave as if they have a full machine. A container looks like a stripped-down filesystem with a single entrypoint. It is not a computer — it is a process in a box.

On top of that, containers share the host machine's kernel — the core part of the operating system that manages everything. If an attacker finds a way to break out of the container, they land directly on the host. And container escapes are not theoretical. They have happened, and they continue to be discovered.

For a web server or a background job, these tradeoffs are usually fine. You control the code, you trust the input, and you have other defenses in place.

For an AI agent that needs to install software, run commands, and operate like it has a real machine — while also handling untrusted input — Docker is the wrong abstraction. It was not built for that use case.

### Traditional VMs (virtual machines)

A virtual machine is a software-created computer. It has its own kernel, its own filesystem, its own network — completely separate from the host. A bug inside the VM cannot reach the host without breaking through the hypervisor, which is a much harder target than a container boundary.

VMs offer strong isolation. They have decades of battle-testing behind them. Cloud providers run their entire businesses on them.

The downside is overhead. A traditional VM takes seconds to minutes to boot. It uses more memory and CPU than a container. Spinning up a fresh VM for every agent task is expensive and slow.

For long-running workloads, that overhead is fine. For agents that need a fresh environment every few seconds, it is a bottleneck.

### MicroVMs

MicroVMs sit between containers and traditional VMs. They provide **VM-level isolation** with **near-container speed**.

A microVM is a minimal virtual machine — stripped down to just what is needed to boot a kernel and run a workload. No desktop environment, no extra services, no bloat. Technologies like Firecracker (built by AWS for Lambda and Fargate) can launch a microVM in about 125 milliseconds.

You get:

- A separate kernel (not shared with the host)
- Hardware-level isolation via the hypervisor
- Fast startup (hundreds of milliseconds, not minutes)
- Low memory overhead (as little as 5 MB per VM)

That combination — real isolation, fast enough for per-task sandboxing — is why microVMs are gaining traction for AI agent workloads.

---

## Side-by-side comparison

| | Docker | Traditional VM | MicroVM |
|---|---|---|---|
| **Startup time** | < 1 second | Seconds to minutes | ~200 ms |
| **Isolation level** | Process-level (shared kernel) | Hardware-level (separate kernel) | Hardware-level (separate kernel) |
| **Full OS environment** | No — single process, no init system | Yes — full operating system | Yes — minimal but complete OS |
| **Install & run software** | Limited — no systemd, fragile packages | Full support | Full support |
| **Memory overhead** | Very low | High (hundreds of MB+) | Low (~5 MB) |
| **Container escape risk** | Higher — shared kernel | Very low | Very low |
| **Best for** | Trusted workloads, packaging | Long-running, high-security workloads | Per-task agent sandboxing |

---

## So which one should you use?

It depends on your agent and your threat model.

**Docker** works when you fully control the code the agent runs, the input is trusted, and you have other layers of defense (network policies, read-only filesystems, seccomp profiles). Many internal tools and pipelines fit this description.

**Traditional VMs** work when you need strong isolation but the workload is long-running — a persistent dev environment, a CI runner, or a dedicated agent that stays up for hours.

**MicroVMs** are the right default when the agent handles untrusted input, runs untrusted code, or needs a fresh isolated environment for every task. That covers most external-facing agent deployments and many coding agent use cases too.

If you are building a product where agents run on behalf of your users — processing their files, executing their workflows, browsing on their behalf — microVMs give you the isolation of a VM without the overhead that makes per-task sandboxing impractical.

---

## Advanced: why Docker's isolation model falls short for agents

> If you are not interested in the technical details of container security, feel free to skip this section. The takeaway is simple: Docker's isolation boundaries were not designed for adversarial workloads, and agents processing untrusted input are adversarial workloads.

### The shared kernel problem

Every Docker container on a machine shares the same Linux kernel. The container boundary is enforced by kernel features — namespaces, cgroups, and seccomp filters. These are useful tools, but they are not a security boundary in the same way a hypervisor is.

The kernel has a massive attack surface. It exposes hundreds of system calls, many of which have had privilege escalation vulnerabilities over the years. A container escape typically works by exploiting a kernel bug to break out of the namespace and gain host-level access.

With a VM or microVM, the guest has its **own** kernel. Even if an attacker compromises that kernel, they are still inside the VM. To reach the host, they would need to break through the hypervisor — a much smaller and more hardened interface.

### Container escapes are real

Container breakouts are not theoretical. CVEs for container escapes appear regularly. Some well-known examples:

- **CVE-2019-5736** — a vulnerability in runc (the container runtime) that allowed a malicious container to overwrite the host binary and gain root access on the host.
- **CVE-2020-15257** — a flaw in containerd that let containers with host networking access the containerd API and escape.
- **CVE-2024-21626** — another runc vulnerability allowing container escape through leaked file descriptors.

Each of these allowed code inside a container to reach the host machine. For a workload you trust, this risk may be acceptable because the code inside is not trying to escape. For an AI agent running untrusted input, the code inside might be **actively trying to escape** — because a prompt injection told it to.

### The privileges problem

Docker containers often run with more privileges than they need. By default, containers run as root inside the container. Many real-world deployments mount the Docker socket, use `--privileged` mode, or bind-mount host directories for convenience.

Each of these shortcuts widens the blast radius if the container is compromised. And in practice, production Docker setups rarely have every security option locked down perfectly.

MicroVMs sidestep this entirely. The guest environment is fully separated. There is no shared socket, no shared filesystem, no shared kernel. The isolation is structural, not configuration-dependent.

---

## The bottom line

Docker is great for what it was built for — packaging, shipping, and running trusted applications. It is not the right default for running AI agents that handle untrusted input.

Traditional VMs offer strong isolation but are too slow and heavy for per-task sandboxing.

MicroVMs give you the best of both: **real isolation at sandbox-friendly speed**. If you are deploying agents that process untrusted input, execute generated code, or run on behalf of your users, microVMs are the right foundation.

The pattern to adopt is simple: **give every agent task its own machine, and make that machine disposable.**