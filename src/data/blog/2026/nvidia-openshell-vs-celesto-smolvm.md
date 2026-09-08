---
author: Aniket Maurya
authorUrl: "https://www.linkedin.com/in/aniketmaurya"
pubDatetime: 2026-09-07T21:00:00Z
modDatetime: 2026-09-07T21:00:00Z
timezone: Asia/Kolkata
title: "NVIDIA OpenShell vs SmolVM: Two Approaches to Secure AI Agent Sandboxes"
description: "Compare NVIDIA OpenShell and Celesto SmolVM across isolation, security policies, microVMs, Windows support, browser automation, snapshots, and agent workloads."
featured: true
draft: false
tags:
  - microvm
  - smolvm
  - sandboxes
---


AI agents need more access than traditional applications.

A coding agent needs a shell, filesystem, package manager, Git credentials, and network access. A computer-use agent may also need a browser, desktop environment, or Windows application.

That access creates risk.

An agent can execute bad code, leak source files, expose credentials, call an unauthorized API, or damage the host machine.

Both **NVIDIA OpenShell** and **Celesto SmolVM** address this problem with isolated execution environments. But they approach it from different layers of the stack.

**OpenShell focuses on policy: what an agent can access inside its environment.**

**SmolVM focuses on the computer: what environment the agent gets in the first place.**

That difference affects almost every design choice.

## TL;DR

|                       | NVIDIA OpenShell                                              | Celesto SmolVM                                          |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| Primary abstraction   | Policy-enforced agent runtime                                 | Disposable computer for an agent                        |
| Isolation             | Docker, Podman, Kubernetes, or MicroVM                        | VM-first isolation                                      |
| MicroVM backend       | libkrun/KVM, with QEMU for some GPU paths                     | Firecracker, QEMU, libkrun                              |
| Network policy        | Deny by default, per binary, host, port, HTTP method and path | Domain-level egress restrictions                        |
| Filesystem policy     | Landlock-based read/write restrictions                        | VM filesystem boundary and optional host mounts         |
| Process restrictions  | Privilege drop + seccomp                                      | Guest isolated behind VM boundary                       |
| Credential protection | Built-in credential and inference proxy                       | Credentials can be passed into the VM                   |
| Linux                 | Yes                                                           | Yes                                                     |
| Windows guest         | No documented Windows guest runtime                           | Windows 11                                              |
| macOS guest           | No documented macOS guest runtime                             | macOS desktop preview                                   |
| Browser environment   | General sandbox can host services                             | Dedicated browser sandbox with CDP, VNC and live viewer |
| VM snapshots          | Stop/start retains workspace state                            | Memory + disk snapshots                                 |
| Best fit              | Least-privilege policy for agents                             | Full computers for code and computer-use agents         |

The simple version:

> **OpenShell asks: what should this agent be allowed to do?**
>
> **SmolVM asks: what computer should this agent receive?**

The two questions overlap, but they are not the same.

## What is NVIDIA OpenShell?

NVIDIA describes OpenShell as a safe and private runtime for autonomous AI agents.

Its architecture has three core pieces:

```text
Developer / Agent
       │
       ▼
OpenShell CLI / SDK
       │
       ▼
    Gateway
       │
       ▼
Compute Driver
Docker / Podman / Kubernetes / MicroVM
       │
       ▼
   Supervisor
       │
       ▼
Restricted Agent Process
```

The **Gateway** acts as the control plane. It owns sandbox lifecycle, policies, providers, inference configuration, credentials, and access control.

Inside each sandbox, an OpenShell **Supervisor** starts the agent as a restricted process and applies the security policy.

The actual compute environment sits behind a driver. OpenShell currently supports Docker, Podman, Kubernetes, and a MicroVM driver. Its MicroVM path uses host virtualization with libkrun and KVM, with QEMU for GPU-backed Linux sandboxes.

That makes OpenShell more than a VM launcher.

Its main abstraction is the security policy around the agent.

## OpenShell's strongest feature: policy enforcement

OpenShell has a much more granular policy model than SmolVM today.

A policy can control:

* filesystem paths
* process identity
* network destinations
* which binary may access each destination
* HTTP methods
* HTTP paths
* WebSocket access
* credential injection
* model inference routes

For example, an agent could receive permission for:

```yaml
network_policies:
  github_api:
    endpoints:
      - host: api.github.com
        port: 443
        protocol: rest
        access: read-only

    binaries:
      - path: /usr/bin/curl
```

OpenShell can then allow the specified binary to reach GitHub while other processes stay blocked.

For REST endpoints, OpenShell can inspect requests at the application layer and enforce HTTP method and path rules. Network policy can also change while the sandbox stays active.

The default security posture also matters.

OpenShell uses **deny-by-default egress**. A sandbox cannot access arbitrary internet destinations unless its policy grants access.

SmolVM currently takes the opposite default: a sandbox has internet access unless the developer supplies network restrictions.

For environments where an agent handles sensitive source code or credentials, OpenShell's model has a clear advantage.

## Filesystem and process isolation

OpenShell also adds controls inside the sandbox.

Filesystem policy uses Linux Landlock. A policy can declare paths as read-only or read-write, while undeclared paths stay inaccessible.

Process isolation adds:

* an unprivileged agent user
* capability removal
* seccomp syscall filters
* privilege escalation restrictions

These controls remain useful even when OpenShell uses a MicroVM driver. The VM provides one security boundary, while OpenShell restricts the agent process inside that VM.

This is defense in depth.

SmolVM starts from a different assumption.

Instead of treating the process as the primary sandbox boundary, **the VM itself is the sandbox boundary**.

## What is SmolVM?

SmolVM gives an agent its own disposable computer.

The API looks deliberately small:

```python
from smolvm import SmolVM

with SmolVM() as vm:
    result = vm.run("python app.py")
    print(result.stdout)
```

On Linux, SmolVM can use Firecracker-backed microVMs. It also provides QEMU and libkrun paths for other host and guest combinations.

Each sandbox gets its own kernel rather than a shared host kernel.

The abstraction looks more like this:

```text
Agent
  │
  ▼
SmolVM API
  │
  ▼
Disposable computer
  │
  ├── CPU
  ├── Memory
  ├── Root filesystem
  ├── Network
  ├── Processes
  └── Operating system
```

This difference becomes important once agents need more than Bash.

## Containers versus computers

OpenShell lets the operator choose the isolation backend.

A developer can start with Docker:

```text
Agent
  │
  ▼
OpenShell
  │
  ▼
Container
```

and later choose its MicroVM driver:

```text
Agent
  │
  ▼
OpenShell
  │
  ▼
MicroVM
```

SmolVM puts the VM abstraction at the center:

```text
Agent
  │
  ▼
SmolVM
  │
  ▼
MicroVM
```

This makes SmolVM closer to infrastructure such as Firecracker than to a policy engine.

SmolVM abstracts the parts developers normally need to assemble around a VMM:

* VM lifecycle
* images
* networking
* command execution
* environment variables
* file transfer
* port exposure
* host mounts
* snapshots
* browser sessions
* desktop access

The goal is not only to isolate a process.

The goal is to give the agent a computer.

## Windows changes the comparison

This is where the distinction becomes much larger.

A Linux sandbox works well for coding agents.

It does not cover every computer-use agent.

A lot of business software still requires Windows:

* transport management systems
* accounting software
* insurance applications
* ERP clients
* desktop applications
* internal enterprise tools
* old software with no useful API

SmolVM can boot a Windows 11 guest:

```python
from smolvm import SmolVM

with SmolVM(
    os="windows",
    image="~/.smolvm/images/win11.qcow2",
    ssh_user="smolvm",
    ssh_password="smolvm",
) as vm:
    print(
        vm.run(
            "Write-Output 'hello from windows'"
        ).stdout
    )
```

The same API can execute PowerShell, upload files, and pass environment variables into the Windows machine.
OpenShell supports Windows as a **host path through WSL 2**, but its published sandbox model and security controls depend on Linux workloads and Linux kernel primitives such as Landlock and seccomp. Its current documentation does not describe Windows guest sandboxes.

That makes SmolVM a better fit when the agent must interact with the operating system itself rather than only execute code.

## The same applies to macOS

SmolVM also has a macOS desktop sandbox preview on Apple Silicon.

A temporary macOS environment can launch through:

```bash
smolvm sandbox create \
  --os macos \
  --name test-mac

smolvm sandbox desktop test-mac
```

This matters for tasks such as:

* macOS app tests
* installer tests
* desktop automation
* software that depends on macOS state

Again, the core abstraction is a computer rather than only a restricted process.

## Browser and computer-use agents

Computer-use agents add another requirement: a screen.

A shell is no longer enough.

SmolVM has a dedicated browser sandbox:

```python
from smolvm import SmolVM

with SmolVM.browser(
    headless=False
) as browser:
    print(browser.cdp_url)
    print(browser.viewer_url)
    print(browser.display_url)
```

One sandbox can expose:

* a CDP endpoint for Playwright
* a viewer URL for humans
* a VNC endpoint for computer-use agents

That gives both deterministic browser automation and pixel-level computer use against the same isolated machine.

OpenShell can expose services from its sandboxes and can host software that serves browser-accessible interfaces. But a browser or desktop computer is not its primary runtime abstraction.

This represents another difference in product direction.

OpenShell focuses on **agent permissions**.

SmolVM focuses on **agent computers**.

## Persistence also means different things

Agents often need state across multiple turns.

Suppose a coding agent:

1. clones a repository
2. installs Node.js packages
3. compiles the project
4. starts a database
5. edits several files
6. waits for another user message

Recreating the entire environment for each turn wastes time.

Both projects support retained state, but at different levels.

OpenShell can stop a sandbox and later start the same sandbox again. Driver-owned workspace state remains available. Its MicroVM driver retains the writable overlay across stop/start operations. Delete removes that state.

SmolVM also supports persistent VM state, but adds explicit VM snapshots:

```bash
smolvm snapshot create my-vm \
  --snapshot-id checkpoint

smolvm snapshot restore checkpoint \
  --resume
```

A Firecracker snapshot can preserve memory and disk state, which means the agent can return to a machine with its processes and runtime state intact.

For long-lived agent computers, that distinction can matter.

## Where OpenShell is stronger

OpenShell has the better answer today when the primary question is:

> How do I give an agent the minimum permissions necessary for a task?

Its policy engine provides controls that SmolVM does not currently match:

### Per-process network policy

OpenShell can distinguish:

```text
curl → api.github.com → allowed

unknown_binary → api.github.com → denied
```

SmolVM's current network controls operate closer to the VM boundary and support domain restrictions, rather than policy per executable.

### Layer 7 network rules

OpenShell can reason about HTTP methods and paths.

For example:

```text
GET /repos/*       → allowed
POST /repos/*      → denied
```

A domain allowlist alone cannot express this.

### Filesystem policy inside the guest

OpenShell can define exactly which paths an agent process can read or modify.

### Credential isolation

OpenShell can keep provider credentials outside the agent sandbox.

Its `inference.local` route receives model requests, removes sandbox-supplied authorization, injects credentials outside the sandbox, and forwards the request to the configured model provider.

An agent therefore does not need direct access to the actual API key.

This is a strong design for autonomous agents.

## Where SmolVM is stronger

SmolVM has the better answer when the primary question is:

> What computer does this agent need?

### VM-first isolation

SmolVM treats hardware virtualization as the default security boundary instead of an optional compute driver.

### Multiple operating systems

The same project targets:

```text
Linux
Windows 11
macOS
```

This matters for computer-use agents.

### Browser and desktop environments

SmolVM exposes browser automation, live screen access, and VNC as first-class agent primitives.

### Firecracker snapshots

Agents can checkpoint full VM state rather than only preserve workspace files.

### Host filesystem mounts

A coding agent can receive a project directory without a separate copy step:

```bash
smolvm sandbox create \
  --mount ~/Projects/my-app
```

Read-only mounts keep host files protected by default, while an explicit option can grant write access.

### Simple VM API

For applications that only need an isolated computer, there is no separate gateway, policy file, supervisor configuration, or provider layer to understand first.

```python
with SmolVM() as vm:
    vm.run(...)
```

is enough to start.

## They could eventually fit together

The interesting part of this comparison is that the architectures do not fundamentally conflict.

OpenShell already separates its policy system from its compute drivers:

```text
                 OpenShell
          policy + credentials
                  │
                  ▼
             Compute Driver
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
    Container            MicroVM
```

SmolVM is itself a microVM runtime abstraction:

```text
                 SmolVM
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
  Firecracker     QEMU      libkrun
```

Conceptually, a stack could look like:

```text
Agent
  │
  ▼
Policy layer
  │
  ▼
SmolVM
  │
  ▼
Disposable computer
```

That is not a documented OpenShell + SmolVM integration today.

But architecturally, it highlights the main point: **policy enforcement and computer isolation are separate problems**.

A mature agent runtime may need both.

## Which one should you use?

Use **OpenShell** when:

* least-privilege network access matters
* credentials must stay outside the agent environment
* you need per-binary network rules
* you need HTTP method or path restrictions
* Linux containers or Linux MicroVMs cover your workload
* you already have Kubernetes or container infrastructure
* centralized policy matters more than the guest OS

Use **SmolVM** when:

* every agent should receive a hardware-isolated VM
* you want Firecracker as the Linux sandbox primitive
* you need Windows agents
* you need macOS desktop environments
* you build browser or computer-use agents
* you need VNC or CDP access
* you need VM snapshots
* you want a small Python API around the computer lifecycle

For many coding agents, either project can provide a useful isolated runtime.

For security policy, OpenShell currently goes further.

For full computer environments, SmolVM covers a broader surface.

## The larger shift

The most interesting part of NVIDIA's OpenShell release is not that NVIDIA created another sandbox project.

It validates a larger architecture shift.

Agents cannot safely execute arbitrary code on the application host.

The runtime must become a first-class part of the agent stack.

We think that stack will eventually contain several distinct layers:

```text
┌────────────────────────────┐
│           Agent            │
├────────────────────────────┤
│ Policies and credentials   │
├────────────────────────────┤
│ Computer lifecycle         │
├────────────────────────────┤
│ VM isolation               │
├────────────────────────────┤
│ CPU / Memory / Storage     │
└────────────────────────────┘
```

OpenShell currently puts most of its effort into the upper security layers.

SmolVM puts most of its effort into the computer and VM layers.

Both approaches point toward the same conclusion:

**Agents need their own computers.**

The next question is no longer only how to isolate them.

It is how much control we can give agents without giving them control over everything else.
