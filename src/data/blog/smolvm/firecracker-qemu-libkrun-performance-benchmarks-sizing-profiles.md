---
author: Aniket Maurya
authorUrl: "https://www.linkedin.com/in/aniketmaurya"
pubDatetime: 2026-07-11
modDatetime: 2026-07-11
title: "Firecracker, QEMU, and libkrun Performance Benchmarks and Sizing Profiles"
description: "Measured Firecracker and QEMU performance, an honest libkrun data gap, reproducible benchmark commands, and practical sizing profiles for AI sandboxes."
featured: true
draft: false
tags:
  - firecracker
  - libkrun
  - qemu
  - benchmarks
  - performance
  - microvm
  - smolvm
  - sandboxes
---

When an AI agent runs generated code, opens a browser, or installs packages, it should not do that directly on the host machine. A common solution is to give each task an isolated **sandbox**: a disposable virtual computer with its own kernel, memory, disk, and network boundary.

Firecracker, QEMU, and libkrun are three ways to create that virtual computer.

They are all virtual machine monitors, or **VMMs**. A VMM is the host-side software that creates and runs a guest virtual machine. They overlap, but they were designed with different priorities.

A performance benchmark asks how quickly and efficiently each option runs a workload. A **sizing profile** describes the CPU, memory, and disk allocation that workload should start with.

This article begins with those basic differences, then moves into measured results, reproducible commands, and host-capacity planning.

---

## First: what are Firecracker, QEMU, and libkrun?

### Firecracker

[Firecracker](https://github.com/firecracker-microvm/firecracker) is a minimal VMM built by AWS for short-lived, isolated workloads such as AWS Lambda and Fargate.

It runs on Linux and uses KVM, the Linux kernel's hardware virtualization interface. Firecracker exposes a deliberately small virtual hardware model. That reduces device emulation and attack surface, but it also makes Firecracker less general-purpose than QEMU.

A virtual machine with this reduced device model is often called a **microVM**. It still has its own guest kernel. “Micro” refers to the smaller VMM and virtual hardware surface, not to weaker isolation.

### QEMU

[QEMU](https://www.qemu.org/) is a general-purpose machine emulator and virtualizer. It supports many CPU architectures, guest operating systems, firmware modes, and virtual devices.

On Linux, QEMU can use KVM for hardware acceleration. On macOS, it can use Hypervisor.framework, Apple's hardware virtualization API.

QEMU's broader hardware model makes it useful for local development, Windows guests, firmware boot, and workloads that need devices or compatibility Firecracker does not provide. That flexibility can add boot work when the guest probes devices it does not need.

### libkrun

[libkrun](https://github.com/containers/libkrun) is a library for embedding lightweight virtual machines into an application. Instead of controlling a standalone VMM through a large external interface, a runtime can configure and enter a VM through the library API.

libkrun can use KVM on Linux and Hypervisor.framework on macOS. That makes it relevant for lightweight sandbox runtimes that want a native path on both platforms.

The architecture is attractive, but architecture alone does not establish performance. libkrun needs to be measured with the same host, guest, and workload as the other backends.

## Where SmolVM fits

[SmolVM](https://github.com/CelestoAI/SmolVM) is an open-source Python SDK and command-line runtime for creating disposable VM sandboxes.

It provides one sandbox interface over multiple VMM backends:

```text
Your Python code or CLI command
              |
              v
           SmolVM
       /       |       \
Firecracker   QEMU   libkrun
       \       |       /
        isolated guest VM
```

A developer can run QEMU on macOS, then select Firecracker on a Linux KVM host without rewriting the workload API. libkrun is available as an explicit backend.

This article uses SmolVM's benchmark data because it runs the same public sandbox API and guest workload across backends. The results measure the path an application experiences, not only how long a VMM process takes to appear.

You do not need to adopt SmolVM to use the methodology. The same rule applies to any runtime: keep the host, image, resources, control path, and workload constant before ranking VMMs.

## Results at a glance

The existing controlled SmolVM data covers Firecracker and QEMU on the same Linux KVM host. It does not yet contain a comparable libkrun result.

The historical end-to-end results ranged from roughly **1.34 to 1.94 seconds** until the first command completed, depending on backend, guest boot configuration, and control channel. The **control channel** is how the host sends commands into the guest; the measurements used SSH or vsock, a virtual-socket transport designed for host-to-guest communication.

The high-level conclusions are:

- Firecracker reached the first command faster than QEMU when both used SSH.
- QEMU with vsock nearly matched Firecracker's first interaction and reduced repeated-command latency from about 42 ms to 1 ms.
- Guest boot and command transport mattered more than VMM process launch.
- libkrun remains an unmeasured row in this controlled comparison.

Choose based on host and required operations before optimizing milliseconds:

| Requirement                | Firecracker                   | QEMU                            | libkrun                      |
| -------------------------- | ----------------------------- | ------------------------------- | ---------------------------- |
| Linux KVM production hosts | Strong fit                    | Supported with KVM              | Supported path               |
| Native macOS host          | Not supported                 | Uses Hypervisor.framework       | Uses Hypervisor.framework    |
| VMM shape                  | Purpose-built microVM process | General-purpose system emulator | Library-based interface      |
| SmolVM pause/resume        | Supported                     | Supported                       | Not yet supported            |
| SmolVM snapshots           | Supported                     | Supported                       | Not yet supported            |
| SmolVM automatic selection | Supported Linux default       | macOS default                   | Explicit `--backend libkrun` |

For a Linux production fleet that depends on snapshots or pause/resume, Firecracker and QEMU are operationally complete choices in SmolVM today.

For local macOS development, QEMU is the default and supports broader guest and firmware workflows. libkrun is worth measuring when you want a smaller library-oriented path and do not need the lifecycle operations it currently lacks.

Readers who only need the decision summary can stop here. The next sections explain the measurements, their limits, and how to produce a sizing profile for a real workload.

## What SmolVM measured for Firecracker and QEMU

SmolVM includes a historical same-host QEMU and Firecracker boot investigation. The setup was:

- one Linux KVM host with 16 CPUs
- Alpine Linux guest
- 1 vCPU
- 512 MiB memory
- cached image artifacts
- five timed runs after an untimed warm-up
- `echo hello` as the first command

The honest metric was **total time to interact**: wall-clock time from creating the sandbox until its first command returned.

| Configuration                 | Create | VMM launch | First command and readiness | **Total to interact** | Warm command |
| ----------------------------- | -----: | ---------: | --------------------------: | --------------------: | -----------: |
| Firecracker, SSH              | 135 ms |     121 ms |                    1,337 ms |          **1,594 ms** |        43 ms |
| QEMU, SSH                     |   9 ms |      53 ms |                    1,879 ms |          **1,940 ms** |        42 ms |
| QEMU, vsock                   |  11 ms |      53 ms |                    1,507 ms |          **1,571 ms** |         1 ms |
| QEMU, vsock with trimmed boot |  11 ms |      54 ms |                    1,278 ms |          **1,343 ms** |         1 ms |

These are historical measurements from one host, not performance guarantees. They are useful because Firecracker and QEMU ran on the same Linux/KVM machine with the same small Alpine workload.

They also show why a single “backend speed” number is incomplete:

- Firecracker over SSH reached the first command before QEMU over SSH.
- QEMU over vsock was close to Firecracker for first interaction and dramatically faster for repeated commands.
- Trimming the QEMU guest boot path moved the result more than VMM launch time did.

A later historical before/after run measured the then-current defaults at approximately **1,177 ms for QEMU** and **1,408 ms for Firecracker**. That was a product-default comparison, not a pure hypervisor comparison: QEMU used working vsock while Firecracker still used SSH in that run. Current SmolVM also has Firecracker vsock support.

The durable finding is more important than the exact ranking:

> Most time-to-interactive latency came from guest boot and the control channel, not from starting the VMM process.

Kernel boot, userspace initialization, SSH or vsock readiness, and host polling dominated the user-visible path. A benchmark that stops when the VMM process starts is misleading for agent infrastructure.

## libkrun benchmark status: no comparable result published yet

The checked-in SmolVM reports do not contain a same-host libkrun result alongside the Firecracker and QEMU table above.

That missing cell should remain empty until it can be measured correctly. Publishing a libkrun number from macOS next to Linux/KVM results would mix:

- different operating systems
- different CPUs
- different hardware virtualization APIs
- different host load
- possibly different guest architectures and images

The result would look precise and still be wrong.

This does not mean libkrun is slow. It means SmolVM does not yet have the controlled data required to rank it. The benchmark harness already accepts `--backend libkrun`, so the next valid result is a three-backend run on one Linux KVM host with the same SmolVM revision and guest workload.

## Run a same-host Firecracker, QEMU, and libkrun benchmark

SmolVM's lifecycle benchmark accepts all three backends. From a SmolVM repository checkout, run:

```bash
uv run python scripts/benchmarks/bench.py \
  --backend firecracker \
  --only cold-start,tti \
  --iterations 10 \
  --output /tmp/firecracker.json

uv run python scripts/benchmarks/bench.py \
  --backend qemu \
  --only cold-start,tti \
  --iterations 10 \
  --output /tmp/qemu.json

uv run python scripts/benchmarks/bench.py \
  --backend libkrun \
  --only cold-start,tti \
  --iterations 10 \
  --output /tmp/libkrun.json
```

Run all three commands on the same Linux KVM host and do not change the repository, image cache, host load, or instance type between runs.

Before benchmarking, verify each backend:

```bash
smolvm doctor --backend firecracker
smolvm doctor --backend qemu
smolvm doctor --backend libkrun
```

On Fedora, libkrun may be installed through the system package manager. On macOS, the project provides a Homebrew tap, but macOS results cannot form a controlled comparison with Firecracker because Firecracker does not run there.

### Record the environment

Save at least:

```bash
uname -a
lscpu
free -h
smolvm --version
firecracker --version
```

Also record the libkrun package version and the git commit under test.

A benchmark without environment metadata is difficult to reproduce and easy to misuse.

## Measure the metrics agents feel

The SmolVM benchmark reports raw values plus p50, p95, mean, minimum, and maximum.

Focus on these metrics:

### 1. Total fresh ready time

`total_fresh_ready_ms` measures host creation, VMM startup, and guest boot until the sandbox is ready.

This is useful when the platform starts a fresh sandbox before each task.

### 2. Total first command time

`total_first_command_ms` measures the complete path until useful work returns.

For agents, this is usually the best startup headline. It includes the readiness and control-channel costs that a user actually waits for.

### 3. Warm command latency

A coding or operations agent may execute hundreds of commands in one sandbox. A 30 ms difference repeated 500 times costs 15 seconds even when startup is identical.

Measure both startup and steady-state command execution.

### 4. p95 latency

The median describes a typical run. The p95 exposes tail behavior under image, filesystem, networking, and scheduler variance.

Capacity plans should be based on tail latency at target concurrency, not an idle-host minimum.

### 5. Host resource overhead

Guest memory allocation is not the same as total host cost.

Measure:

- VMM process resident memory
- host CPU during boot and steady state
- open file descriptors
- network setup cost
- disk overlay growth
- memory after many concurrent VMs

The lifecycle benchmark covers latency. Add host-level observation for density planning.

## Product-default benchmark versus hypervisor benchmark

There are two valid questions, and they need different benchmark designs.

### Question A: which backend is faster through the public product API?

Run each backend with its normal SmolVM defaults.

This includes differences in networking and control channels. It answers what an application experiences out of the box.

### Question B: which VMM has lower overhead?

Hold the guest image, control channel, network mode, memory, vCPU count, and command path constant.

This isolates more of the backend, but it may not reflect how users deploy it.

Publish which question you answered. Do not use a product-default benchmark to claim pure hypervisor superiority.

## Current SmolVM starting profiles

SmolVM's current defaults provide useful starting allocations:

| Workload                       |    Memory |      Disk | Source of profile          |
| ------------------------------ | --------: | --------: | -------------------------- |
| Minimal Alpine command sandbox |   512 MiB |   512 MiB | Alpine zero-config default |
| General Ubuntu shell sandbox   | 1,024 MiB | 2,048 MiB | Ubuntu zero-config default |
| Coding-agent preset            | 2,048 MiB | 8,192 MiB | Agent preset default       |
| Browser sandbox                | 2,048 MiB | 4,096 MiB | Browser CLI default        |

These are **configuration defaults**, not measured capacity guarantees.

They answer “what is a reasonable place to start?” They do not answer:

- how many browser tabs the guest can sustain
- whether a compiler will run without swapping
- how many sandboxes fit on one host
- what p95 latency looks like at production concurrency

Firecracker, QEMU, and libkrun should use the same guest allocation when you compare them. Otherwise a backend with a smaller guest will appear more efficient for the wrong reason.

## Recommended workload profiles

Use the current defaults as the floor, then load-test profiles based on the workload.

### Profile 1: command and validation sandbox

Good for short shell commands, package inspection, and lightweight generated-code checks.

```text
Guest: Alpine
vCPU: start with 1
Memory: 512 MiB
Disk: 512 MiB to 2 GiB
```

Watch for package installation and decompression spikes. A task that installs large Python or Node dependencies may outgrow the disk before it runs out of memory.

### Profile 2: general agent workspace

Good for Python or Node agents, repository edits, test execution, and several background processes.

```text
Guest: Ubuntu
vCPU: start with 1; test 2 for parallel builds
Memory: 2 GiB
Disk: 8 GiB
```

This aligns with SmolVM's coding-agent preset defaults for memory and disk.

### Profile 3: browser agent

Good for Chromium automation, screenshots, and a small number of tabs.

```text
Guest: Ubuntu/browser image
vCPU: benchmark 2
Memory: start at 2 GiB; test 4 GiB for heavier pages
Disk: 4–8 GiB
```

Browser workloads are bursty. Record memory after navigation, JavaScript execution, screenshots, and downloads rather than measuring an empty browser.

### Profile 4: build and test worker

Good for compilers, dependency installation, and parallel test suites.

```text
Guest: Ubuntu
vCPU: 2–4
Memory: 4–8 GiB
Disk: 16 GiB or more
```

Disk throughput and overlay growth may become limiting before VMM overhead does. Benchmark the actual repository and dependency cache policy.

These profiles are starting points. The production profile is the smallest allocation that meets your p95 latency and failure-rate target under realistic concurrency.

## Convert a guest profile into host capacity

Do not divide host memory by guest memory and call the result capacity.

Reserve memory for the host OS, filesystem cache, networking, monitoring, the application control plane, and the VMM processes.

A simple first-pass model is:

```text
usable memory = host memory - host reserve

memory limit = floor(
  usable memory /
  (guest memory + measured per-VM host overhead)
)

cpu limit = floor(
  host vCPUs * allowed oversubscription /
  guest vCPUs
)

initial capacity = min(memory limit, cpu limit, operational limits)
```

Operational limits include file descriptors, network devices, IP allocation, disk IOPS, and startup burst rate.

Then apply headroom. If a benchmark host becomes unstable at 100 concurrent sandboxes, do not schedule 100 in production. Start around 60–70 and validate p95 latency, memory pressure, and failure recovery.

The exact headroom depends on workload variance and how quickly your scheduler can shed load.

## A useful benchmark matrix

Run more than one guest size:

| Cell | Backend     |  Memory | Workload         | Concurrency |
| ---- | ----------- | ------: | ---------------- | ----------: |
| A1   | Firecracker | 512 MiB | `echo hello`     |           1 |
| A2   | QEMU        | 512 MiB | `echo hello`     |           1 |
| A3   | libkrun     | 512 MiB | `echo hello`     |           1 |
| B1   | Firecracker |   2 GiB | agent test suite |           1 |
| B2   | QEMU        |   2 GiB | agent test suite |           1 |
| B3   | libkrun     |   2 GiB | agent test suite |           1 |
| C1   | Firecracker |   2 GiB | agent test suite | target load |
| C2   | QEMU        |   2 GiB | agent test suite | target load |
| C3   | libkrun     |   2 GiB | agent test suite | target load |
| D1   | Firecracker | 2–4 GiB | browser workflow | target load |
| D2   | QEMU        | 2–4 GiB | browser workflow | target load |
| D3   | libkrun     | 2–4 GiB | browser workflow | target load |

The single-VM cells expose baseline latency. The concurrent cells expose scheduler, memory, disk, and networking behavior.

A backend that wins an idle `echo hello` benchmark may lose under 50 concurrent browser starts.

## Common benchmark mistakes

### Comparing macOS QEMU or libkrun with Linux Firecracker

This compares complete systems, not only backends. It is useful for environment expectations but not a backend ranking.

### Timing only process launch

The guest may not be ready. Measure until the first useful command completes.

### Mixing SSH and vsock without saying so

Control-channel latency can dominate warm commands. Record the channel and either keep it constant or label the comparison as product defaults.

### Including image download in only one backend

Warm the image cache before timed runs. Preserve a separate cold-artifact benchmark if image distribution is part of the question.

### Reporting only the mean

Keep raw runs and publish p50 and p95. Means hide tails and small sample outliers.

### Treating memory allocation as memory consumption

Measure host resident memory at concurrency. Guest allocation is only one term in the density model.

### Calling defaults “recommended production sizing”

Defaults optimize first use. Production sizing must come from the real workload and service-level objective.

## Operational differences matter

Even if libkrun matches or beats Firecracker and QEMU in a startup test, SmolVM's current libkrun backend does not yet implement:

- pause
- resume
- snapshots
- snapshot restore

Firecracker and QEMU support those lifecycle paths in SmolVM.

If your platform keeps sandboxes warm, suspends idle sessions, or restores snapshots, benchmark the complete lifecycle rather than only fresh boot. A backend without a required operation is not a viable winner.

The SmolVM benchmark reports unsupported operations explicitly instead of replacing them with zeroes. Preserve that distinction in dashboards.

## What we can say today

We can make five defensible statements:

1. Firecracker does not run natively on macOS; QEMU and libkrun can use macOS virtualization APIs.
2. In one historical same-host SmolVM measurement, Firecracker over SSH reached the first completed command in **1,594 ms**, compared with **1,940 ms** for QEMU over SSH.
3. QEMU over vsock reached the first command in **1,571 ms** and reduced warm commands from roughly **42 ms to 1 ms**, showing that transport can matter more than VMM launch time.
4. SmolVM does not yet have a published same-host libkrun result for that matrix, so no evidence-based libkrun ranking is possible yet.
5. The correct sizing profile depends more on the guest workload and concurrency target than on the backend name.

Anything more specific should come with same-host raw results.

## Bottom line

Do not choose Firecracker, QEMU, or libkrun from an isolated headline benchmark.

Use this order:

1. Eliminate backends that lack your required host or lifecycle support.
2. Use the existing same-host Firecracker and QEMU data as a reference, not a promise.
3. Run all viable backends on the same host and guest image before ranking them.
4. Measure total first command, warm commands, p95 latency, and host overhead.
5. Start from a workload-appropriate memory and disk profile.
6. Increase concurrency until latency or reliability crosses your target.
7. Schedule production below that saturation point with explicit headroom.

For now, the honest comparison has measured Firecracker and QEMU rows and an explicitly pending libkrun row. That is more useful than filling a table with numbers collected on incompatible machines.

The benchmark should tell you how your agent platform behaves. It should not merely tell you how quickly a VMM process can start.

## Sources and reproducibility

- [SmolVM lifecycle benchmark](https://github.com/CelestoAI/SmolVM/tree/main/scripts/benchmarks)
- [SmolVM boot-latency investigation](https://github.com/CelestoAI/SmolVM/blob/main/docs/benchmarks/boot-latency-learnings.md)
- [SmolVM historical before/after report](https://github.com/CelestoAI/SmolVM/blob/main/docs/benchmarks/final-report.md)
- [SmolVM backend resolver](https://github.com/CelestoAI/SmolVM/blob/main/src/smolvm/runtime/backends.py)
- [SmolVM QEMU lifecycle adapter](https://github.com/CelestoAI/SmolVM/blob/main/src/smolvm/runtime/qemu.py)
- [SmolVM libkrun lifecycle adapter](https://github.com/CelestoAI/SmolVM/blob/main/src/smolvm/runtime/libkrun.py)
- [Firecracker](https://github.com/firecracker-microvm/firecracker)
- [libkrun](https://github.com/containers/libkrun)
- [Firecracker on macOS: develop with QEMU, deploy with Firecracker](/blog/posts/smolvm/firecracker-macos/)
