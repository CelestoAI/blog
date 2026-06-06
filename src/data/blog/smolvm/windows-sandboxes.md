---
pubDatetime: 2026-05-26
modDatetime: 2026-05-26
title: "Open Source Windows Sandbox in Python: Run Windows 11 on Linux with SmolVM"
published: true
featured: true
description: "SmolVM now supports Windows 11 sandboxes. Boot disposable Windows VMs from Python, run PowerShell, upload files, pass environment variables, and tear the VM down after the task."
tags:
  - windows
  - python
  - opensource
  - ai
---

<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin-bottom:2rem;">
  <iframe src="https://www.youtube.com/embed/iqoWK22Vx_g" style="position:absolute;top:0;left:0;width:100%;height:100%;" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>

Linux-only sandboxes will not automate the world.

A lot of business software does not live inside a clean Linux container.

It lives on Windows.

Desktop apps. Legacy ERPs. Transport systems. Insurance tools. Back-office workflows. Internal software with no API, no docs, and no clean path for integration.

That is the awkward truth for computer-use agents.

If agents need to do real work, they need to run where the work already happens. For many companies, that means Windows.

That is why we added **Windows sandboxes** to **[SmolVM](https://github.com/CelestoAI/SmolVM)**.

SmolVM can now boot an isolated Windows 11 VM from Python, run PowerShell commands over SSH, upload files into Windows paths, pass environment variables, and discard the VM after the task.

This is V1. It is not magic. It is the foundation for a more realistic agent runtime.

Agents need computers.

Some of those computers need to run Windows.

## What do we mean by “Windows sandbox”?

First, a clarification.

Microsoft already has a product called **Windows Sandbox**. It is a built-in Windows feature that gives users a temporary isolated desktop environment for safe app test and file inspection on supported Windows editions.

SmolVM solves a different problem.

In this post, “Windows sandbox” means a disposable Windows 11 virtual machine controlled by SmolVM from Python on a Linux host.

The difference is important:

- Microsoft Windows Sandbox is a local desktop feature for Windows users.
- SmolVM Windows sandboxes are programmable Windows VMs for developers, agents, test systems, and automation pipelines.

With SmolVM, you can start a Windows VM from Python, run commands, upload files, pass config, and delete the machine when the task ends.

## Why Windows support matters

The first wave of AI agents wrote code.

The next wave needs computers.

Not just terminals. Not just containers. Real computers.

Agents will need to:

- open business software
- inspect files
- read screens
- click buttons
- run scripts
- use desktop apps
- complete workflows across messy systems

A Linux sandbox works well for code execution. But it does not cover the full automation surface.

A logistics agent may need a transport management system.

An insurance agent may need a claims desktop app.

A finance agent may need an internal Windows-only tool.

A support agent may need back-office software that never had an API.

A serious agent infrastructure stack cannot pretend every workflow happens inside Ubuntu.

## Run a Windows sandbox from Python

SmolVM gives Windows guests the same core Python API used for Linux guests.

```python
from smolvm import SmolVM

with SmolVM(
    os="windows",
    image="~/.smolvm/images/win11.qcow2",
    ssh_user="smolvm",
    ssh_password="smolvm",
) as vm:
    print(vm.run("Write-Output 'hello from windows'").stdout)
```

This starts a Windows 11 VM, waits for SSH, runs a PowerShell command, and exits.

On context exit, SmolVM stops and deletes the VM.

That is the core primitive: a disposable Windows computer from Python.

## Run a Windows sandbox on Linux or Ubuntu

SmolVM Windows guests run on Linux hosts with QEMU and KVM.

On Debian or Ubuntu, install the host prerequisites:

```bash
sudo apt-get install qemu-system-x86 ovmf swtpm
```

Windows 11 needs UEFI and TPM 2.0. SmolVM handles the OVMF firmware state, starts a per-VM software TPM process, wires QEMU, and sets up SSH access.

You still need a Windows disk image. SmolVM does not ship a Windows image.

You can either bring your own Windows 11 `.qcow2` image or create one with the SmolVM CLI.

## Build a Windows 11 sandbox image

If you do not already have a Windows `.qcow2`, use:

```bash
smolvm windows build-image \
  --iso ./Win11.iso \
  --virtio-win-iso ./virtio-win.iso \
  --output ~/.smolvm/images/win11.qcow2
```

You provide:

- a Windows 11 ISO
- the virtio-win driver ISO
- an output path for the `.qcow2`

The build command creates a Windows image with OpenSSH Server, virtio-win drivers, and a local admin account.

Once the image exists, you can boot it like any other SmolVM guest:

```python
from smolvm import SmolVM

with SmolVM(
    os="windows",
    image="~/.smolvm/images/win11.qcow2",
    ssh_user="smolvm",
    ssh_password="smolvm",
) as vm:
    print(vm.run("hostname").stdout)
```

## Run PowerShell inside the Windows sandbox

On Linux guests, `vm.run(...)` executes shell commands.

On Windows guests, `vm.run(...)` executes PowerShell.

```python
result = vm.run("Write-Output 'hello from windows'")
print(result.stdout)
print(result.exit_code)

result = vm.run("(Get-Item C:\\Windows).Name")
print(result.stdout.strip())
```

SmolVM runs the command through PowerShell over SSH.

That means your automation code can treat the Windows sandbox as a programmable runtime, not just a manually operated VM.

## Upload files into Windows paths

A useful Windows sandbox needs file transfer.

SmolVM supports Windows-style paths:

```python
vm.upload_file("./hello.ps1", "C:\\Users\\smolvm\\scripts\\hello.ps1")

result = vm.run(
    "powershell.exe -File C:\\Users\\smolvm\\scripts\\hello.ps1"
)

print(result.stdout)
```

This is useful for scripts, test data, config files, installers, and agent artifacts.

SmolVM also creates missing parent directories on the Windows side.

## Pass environment variables into Windows

Agents need config.

Sometimes they need runtime flags. Sometimes they need temporary credentials. Sometimes they need a mode switch.

SmolVM supports environment variables for Windows guests:

```python
from smolvm import SmolVM

with SmolVM(
    os="windows",
    image="~/.smolvm/images/win11.qcow2",
    ssh_user="smolvm",
    ssh_password="smolvm",
    env_vars={
        "APP_MODE": "production",
    },
) as vm:
    print(vm.run("$env:APP_MODE").stdout.strip())
```

On Windows, SmolVM writes variables into the per-user environment store.

Each `vm.run(...)` call opens a fresh SSH session, so new commands can read the updated variables.

## The baseline image stays clean

A sandbox should be safe to destroy.

SmolVM keeps your baseline Windows image read-only. Each VM gets its own thin `qcow2` overlay.

That gives you a clean model:

- the golden Windows image stays unchanged
- each sandbox gets separate disk state
- multiple sandboxes can share the same baseline
- crashes do not corrupt the base image
- task state can vanish when the VM is deleted

This matters for agents.

Agents make mistakes. They can run unsafe commands. They can install bad packages. They can touch files they should not touch. They can get prompt-injected.

The answer is not “trust the agent.”

The answer is: give the agent a disposable computer.

## SmolVM vs Microsoft Windows Sandbox

Microsoft Windows Sandbox is great when you want a temporary Windows desktop on a Windows machine.

SmolVM is for a different use case.

Use Microsoft Windows Sandbox when:

- you are on a Windows host
- you want a local temporary desktop
- you want to manually test an app or file
- you do not need a Python API

Use SmolVM when:

- you are on a Linux host
- you want to control Windows from Python
- you need command execution
- you need file upload
- you need env vars
- you want disposable VMs for agents, tests, or automation

That is the distinction.

SmolVM is not a replacement for every Windows Sandbox use case.

It is an open-source runtime for programmable Windows sandboxes.

## What works today

Windows support in SmolVM is V1.

Today, it supports:

- Windows 11 guests
- Python API via `SmolVM(...)`
- PowerShell commands via `vm.run(...)`
- file upload into Windows paths
- environment variables
- Windows image creation via CLI
- QEMU + KVM on Linux hosts
- per-VM disk overlays

That is enough for command-level Windows automation, test systems, and the base layer for agent workflows.

## Current limitations

The first version is deliberately narrow.

Today, Windows guests do not support:

- macOS hosts
- host folder mounts
- network allowlists and egress controls
- snapshots

Those features raise clear errors instead of silent failures.

Also, SmolVM does not currently ship a published Windows image. You need to bring or create a Windows 11 `.qcow2` image.

This is important. Windows support is useful today, but it is still V1.

## Why this matters for computer-use agents

A lot of agent infrastructure still assumes the world is Linux.

That assumption breaks as soon as agents leave code tasks and enter real business workflows.

Real work happens in:

- browsers
- terminals
- file systems
- desktop apps
- old ERPs
- customer portals
- internal tools
- Windows-only software

Computer-use agents need runtime environments that match that world.

Linux containers are part of the answer.

They are not the whole answer.

If an agent needs to operate Windows software, it needs a Windows computer. That computer should be isolated, disposable, programmable, and easy to start from code.

That is the direction SmolVM is moving toward.

## FAQ

### Is SmolVM the same as Microsoft Windows Sandbox?

No.

Microsoft Windows Sandbox is a built-in Windows feature for a temporary desktop environment on supported Windows editions.

SmolVM Windows sandboxes are Windows 11 VMs that run on a Linux host and can be controlled from Python.

### Can I run a Windows sandbox from Python?

Yes.

With SmolVM, you can start a Windows 11 sandbox from Python, wait for SSH, run PowerShell commands, upload files, pass environment variables, and delete the VM after the task.

### Can I run a Windows sandbox on Ubuntu?

Yes.

SmolVM Windows guests run on Linux hosts with QEMU and KVM. On Ubuntu or Debian, install:

```bash
sudo apt-get install qemu-system-x86 ovmf swtpm
```

### Does SmolVM provide a Windows image?

No.

You need to bring a Windows 11 `.qcow2` image or create one from a Windows ISO and the virtio-win driver ISO with:

```bash
smolvm windows build-image \
  --iso ./Win11.iso \
  --virtio-win-iso ./virtio-win.iso \
  --output ~/.smolvm/images/win11.qcow2
```

### Does SmolVM support GUI automation on Windows?

Windows support is V1.

Today, the documented Windows support covers boot, PowerShell command execution, file upload, environment variables, and image creation.

That gives the base runtime for Windows automation. GUI-level agent control is the next layer on top.

### Why not just use Docker?

Docker is excellent for Linux workloads.

But Docker is not a Windows desktop. It is not the right abstraction for Windows-only apps, desktop state, PowerShell-heavy workflows, Windows services, or legacy software that expects a real Windows OS.

For those tasks, agents need a real Windows runtime.

## Conclusion

Linux-only sandboxes will not automate the world.

The next wave of agents will not just write code. They will use computers.

Some of those computers need to run Windows.

With SmolVM, developers can now boot a disposable Windows 11 VM from Python, run PowerShell, upload files, pass environment variables, and throw the machine away after the task.

It is early.

But the direction is clear:

Agents need computers.

Those computers need to be isolated, disposable, programmable, and close to the operating systems businesses actually use.

That is why Windows sandboxes are now part of SmolVM.

---

## Sources

- [Windows sandboxes in SmolVM](https://docs.celesto.ai/smolvm/guides/windows-guests) — Linux host + QEMU/KVM, pre-installed `.qcow2`, OVMF, `swtpm`, PowerShell via `vm.run`, file upload, env vars, overlays, and current V1 limits.
- [Windows Sandbox overview](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-overview) — Microsoft's built-in temporary desktop feature on supported Windows editions.
- [Windows Sandbox community projects](https://github.com/microsoft/Windows-Sandbox) — community tools for Microsoft's Windows Sandbox, including Python utilities such as [PyWinSandbox](https://github.com/karkason/pywinsandbox).
