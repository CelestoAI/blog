---
author: Aniket Maurya
authorUrl: "https://www.linkedin.com/in/aniketmaurya"
pubDatetime: 2026-09-13T21:00:00Z
modDatetime: 2026-09-14T00:00:00Z
title: "Can Docker Safely Run AI Agents? Containers vs. MicroVMs"
description: "Docker isolates AI agents, but containers share the host kernel. See where the boundary weakens and when a microVM provides safer isolation."
featured: true
draft: false
tags:
  - docker
  - security
  - sandboxing
---

Docker can isolate an AI agent, but every container still shares the host Linux kernel.

That tradeoff can suit code you trust. It is less attractive when an agent may execute code from an unknown repository, package, webpage, or document.

A microVM adds a separate guest kernel and a hardware virtualization boundary. An attacker must cross both the guest boundary and the hypervisor boundary to reach the host.

The practical answer is:

- Use Docker for trusted workloads with strict container policy.
- Prefer a microVM for hostile or unknown code.
- Never expose the host Docker socket, broad host mounts, or privileged mode to an untrusted agent.

This distinction does not mean that a normal Docker container can execute commands on its host merely because it shares the host kernel. A container still has a real security boundary. The concern is the value of a kernel or runtime flaw when the workload has both the motive and time to probe that boundary.

## Why AI agents need a stronger boundary

An AI agent may receive a repository and this task:

> Fix the test failures and open a pull request.

The agent may execute:

```bash
npm install
npm test
pip install -r requirements.txt
make
cargo build
```

Each command can execute code that the agent operator did not author. An `npm` package can contain install scripts. A `Makefile` can execute arbitrary shell commands. A dependency can be compromised upstream. A repository or webpage can also contain instructions that alter the agent's behavior.

The agent does not need malicious intent. It only needs to act on malicious input.

A traditional application container often follows this path:

```text
source code -> review -> CI -> image build -> production
```

An agent workload can follow a much shorter path:

```text
unknown input -> agent -> shell command -> immediate execution
```

An autonomous workload may also get thousands of attempts to inspect its environment, vary parameters, observe errors, and try another path. The isolation boundary therefore becomes part of the attack surface.

## What a Docker container actually is

A Docker container is not a small virtual machine.

At the Linux level, it is a set of processes on the host kernel with several isolation controls around them.

![Docker containers isolate user space but share the host Linux kernel](./images/docker-shared-host-kernel.png)
_Each container has an isolated user space, but its system calls still reach the host's shared Linux kernel._

The main controls are:

- **Namespaces** isolate processes, mounts, the network, IPC, and hostnames.
- **cgroups** account for and restrict CPU, memory, and other resources.
- **Linux capabilities** divide root privileges into smaller permissions.
- **seccomp** restricts the system calls that a process can make.
- **AppArmor or SELinux** adds policy around resource access.
- **Filesystem isolation** gives the container its own root filesystem unless the operator shares a host path.

The kernel remains shared. If a container calls `open()`, `mount()`, `clone()`, `ioctl()`, or another system call, that request reaches the same Linux kernel that serves host processes. Namespaces and policy controls decide what the process can see and what the kernel will permit.

> **A shared kernel increases the value of a kernel exploit. It does not automatically give a container access to the host.**

On macOS and Windows, Docker Desktop puts Linux containers inside a Linux virtual machine. Those containers share the kernel of that virtual machine, not the macOS or Windows kernel.

## What Docker prevents by default

Start a normal container:

```bash
docker run --rm -it ubuntu:24.04 bash
```

The process inside it does not normally have access to the host root filesystem, every host process, every Linux capability, or arbitrary filesystem mounts.

Docker also applies a default seccomp profile unless the operator replaces or disables it. The current profile blocks about 44 system calls out of more than 300. The blocked set covers kernel module operations, several namespace operations, `mount`, `reboot`, `setns`, and other sensitive calls. See [Docker's seccomp documentation](https://docs.docker.com/engine/security/seccomp/).

For example, this command fails in a normal container:

```bash
mount -t tmpfs none /mnt
```

Docker drops `CAP_SYS_ADMIN` by default, so the kernel rejects the operation. This is real isolation.

The security model becomes weaker when an operator removes these controls or grants direct access to host resources.

## How the Docker boundary gets weaker

Two cases often appear under the label "container escape":

1. A vulnerability defeats a container boundary.
2. An operator connects the container to sensitive host resources.

The second case is easier to demonstrate and often easier to prevent.

### 1. Docker socket access

This mount exposes the host Docker API to the container:

```bash
-v /var/run/docker.sock:/var/run/docker.sock
```

A process with access to a rootful Docker daemon can ask it to create containers with host mounts, devices, extra capabilities, or privileged mode. That authority is close to host root access. Docker warns that anyone who can instruct the daemon can gain root access to its host. See [Protect the Docker daemon socket](https://docs.docker.com/engine/security/protect-access/).

The precise statement is:

> Docker socket access grants control over a service that can create containers with host-level access.

An agent sandbox must not expose that socket.

### 2. Writable host bind mounts

This command shares `/srv/project` with the container:

```bash
docker run --rm \
  --mount type=bind,src=/srv/project,dst=/workspace \
  agent
```

Docker bind mounts have write access by default. A container process can create, alter, or delete files in the shared host directory. The host granted that access, so this is not an escape.

Share only narrow paths and add `readonly` or `ro` when the workload does not need write access. See [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/).

### 3. Privileged mode

The `--privileged` flag changes the threat model. It grants all Linux capabilities, gives access to host devices, and relaxes the default AppArmor or SELinux policy. Docker warns that privileged containers can gain almost the same host access as processes outside a container. See [Docker container runtime options](https://docs.docker.com/engine/containers/run/#runtime-privilege-and-linux-capabilities).

If the workload is untrusted, `--privileged` removes the boundary that most people expect from a Docker sandbox.

### 4. Host namespaces

Docker can let a container join host namespaces:

```bash
--pid=host
--network=host
--userns=host
```

These flags have different effects:

- `--pid=host` lets the container see host process identifiers.
- `--network=host` removes the normal network namespace boundary.
- `--userns=host` disables the user-namespace remap for that container when the daemon has user remap enabled.

None of these flags grants instant host root access by itself. Each one removes a layer and exposes more host surface to the workload.

### 5. Extra capabilities

Linux capabilities divide root authority into smaller units. Docker removes many dangerous capabilities by default, but an operator can add them back:

```bash
docker run --cap-add=SYS_ADMIN ...
```

`CAP_SYS_ADMIN` gates a broad set of kernel operations. Namespaces and other controls still apply, but the workload can reach more kernel interfaces. An untrusted workload should receive only the capabilities that it needs.

### 6. Disabled seccomp or LSM policy

An operator can disable seccomp:

```bash
--security-opt seccomp=unconfined
```

The operator can also weaken AppArmor or SELinux policy. These changes do not grant an automatic escape. They remove defense layers that can block access to a vulnerable syscall, path, device, or kernel API.

Docker recommends its default seccomp profile instead of an unconfined container.

### 7. Unsafe control-plane parameters

A sandbox API may accept values such as:

```json
{
  "mounts": [...],
  "capabilities": [...],
  "network": "..."
}
```

If an attacker can control those values, the API may expose part of the Docker control plane even when the socket never enters the sandbox. A service must validate both the workload boundary and the parameters that create that workload. Docker calls out this risk in its [daemon attack-surface guidance](https://docs.docker.com/engine/security/#docker-daemon-attack-surface).

## A safe lab for the Docker boundary

This lab shows namespace separation, a deliberate host mount, and read-only Docker API calls. It does not attempt a container escape.

Use a Linux host with a rootful Docker Engine and the default socket path. Docker Desktop adds a virtual machine between the container and the native host. Rootless Docker uses a different socket path.

Create this project:

```text
docker-boundary-demo/
├── Dockerfile
├── package.json
├── tsconfig.json
└── src/
    ├── inspect-isolation.ts
    ├── probe-docker-socket.ts
    └── write-canary.ts
```

### Project files

Create `package.json`:

```json
{
  "name": "docker-boundary-demo",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^6.0.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true
  },
  "include": ["src/**/*.ts"]
}
```

Create `Dockerfile`:

```dockerfile
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
CMD ["node", "dist/inspect-isolation.js"]
```

For a production repository, commit a lockfile and replace `npm install` with `npm ci`.

Create `src/inspect-isolation.ts`:

```ts
import { existsSync, readFileSync, readlinkSync, readdirSync } from "node:fs";

const namespaces = Object.fromEntries(
  readdirSync("/proc/self/ns").map(name => [
    name,
    readlinkSync(`/proc/self/ns/${name}`),
  ])
);

const status = readFileSync("/proc/self/status", "utf8");

const security = Object.fromEntries(
  status
    .split("\n")
    .filter(line =>
      ["CapEff:", "CapBnd:", "NoNewPrivs:", "Seccomp:"].some(key =>
        line.startsWith(key)
      )
    )
    .map(line => {
      const [key, ...value] = line.trim().split(/\s+/);
      return [key.replace(":", ""), value.join(" ")];
    })
);

console.log({
  kernel: readFileSync("/proc/sys/kernel/osrelease", "utf8").trim(),
  namespaces,
  security,
  dockerSocketPresent: existsSync("/var/run/docker.sock"),
});
```

Create `src/write-canary.ts`:

```ts
import { appendFileSync, readFileSync } from "node:fs";

const path = "/demo/canary.txt";

console.log("before:");
console.log(readFileSync(path, "utf8"));

appendFileSync(path, "container-was-here\n");

console.log("after:");
console.log(readFileSync(path, "utf8"));
```

Create `src/probe-docker-socket.ts`:

```ts
import http from "node:http";

const socketPath = "/var/run/docker.sock";

function get(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath, path, method: "GET" }, res => {
      let body = "";
      res.on("data", chunk => {
        body += chunk;
      });
      res.on("end", () => resolve(body));
    });

    req.on("error", reject);
    req.end();
  });
}

const ping = await get("/_ping");
const version = JSON.parse(await get("/version")) as {
  Version: string;
  ApiVersion: string;
  Os: string;
  Arch: string;
};

console.log("Docker ping:", ping);
console.log({
  version: version.Version,
  apiVersion: version.ApiVersion,
  os: version.Os,
  arch: version.Arch,
});
```

### Step 1: inspect a normal container

Build the image:

```bash
docker build -t docker-boundary-demo .
```

Record the host kernel and selected namespace IDs, then start the container:

```bash
uname -r
readlink /proc/self/ns/{pid,mnt,net}
docker run --rm docker-boundary-demo
```

Compare the results:

- The container reports the same Linux kernel release as the host.
- The PID, mount, and network namespace IDs differ.
- The Docker socket does not exist inside the normal container.
- The capability masks have a restricted set.
- The `Seccomp` field reports the active seccomp state on the host.

This proves the shared-kernel model without a host-access attempt.

### Step 2: share one host directory

Create a temporary host file:

```bash
mkdir -p /tmp/docker-boundary-demo
printf 'host-original\n' > /tmp/docker-boundary-demo/canary.txt
```

Attach only that directory:

```bash
docker run --rm \
  --mount type=bind,src=/tmp/docker-boundary-demo,dst=/demo \
  docker-boundary-demo \
  node dist/write-canary.js
```

Inspect the file on the host:

```bash
cat /tmp/docker-boundary-demo/canary.txt
```

The output now contains:

```text
host-original
container-was-here
```

No escape occurred. The host granted write access to one path, and the container changed that path.

### Step 3: prove that the socket is a control-plane channel

> **Use only the image that you built from the source above. Never expose the host Docker socket to unknown code.**

Attach the rootful Docker socket and execute the read-only probe:

```bash
docker run --rm \
  --mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
  docker-boundary-demo \
  node dist/probe-docker-socket.js
```

The script reads `/_ping` and `/version`. It does not create a container, join a host namespace, or alter host state.

The result proves that the workload can talk to the host Docker daemon. Although this script makes read-only requests, the socket itself grants broader authority.

Clean up the lab:

```bash
docker image rm docker-boundary-demo
rm -r /tmp/docker-boundary-demo
```

## What recent runc flaws teach us

A shared kernel is not the only concern. A container also depends on the runtime that constructs its namespaces, mounts, devices, and process state. Recent `runc` advisories show how flaws in that setup path can defeat isolation.

- **[CVE-2025-31133](https://github.com/opencontainers/runc/security/advisories/GHSA-9493-h29p-rfm2), published November 5, 2025:** A race around masked paths could expose host data, crash the host, or lead to a container escape. Patched releases: `1.2.8`, `1.3.3`, and `1.4.0-rc.3`.
- **[CVE-2025-52881](https://github.com/opencontainers/runc/security/advisories/GHSA-cgrx-mc8f-2prm), published November 5, 2025:** Procfs write redirection and mount races could bypass an LSM, crash the host, or support an escape. Patched releases: `1.2.8`, `1.3.3`, and `1.4.0-rc.3`.
- **[CVE-2025-52565](https://github.com/opencontainers/runc/security/advisories/GHSA-qw9x-cqr3-wc7r), published November 5, 2025:** Races around the `/dev/console` mount could cause host denial of service or a container escape. Patched releases: `1.2.8`, `1.3.3`, and `1.4.0-rc.3`.
- **[CVE-2026-41579](https://github.com/opencontainers/runc/security/advisories/GHSA-xjvp-4fhw-gc47), published June 13, 2026:** A malicious image with a `/dev` symlink could cause limited host filesystem integrity violations in affected integrations. Patched releases: `1.3.6`, `1.4.3`, and `1.5.0-rc.3`. The upstream advisory states that this flaw is **not exploitable under Docker** because Docker masks the malicious `/dev` symlink with a top-level read-only layer.

The lesson is not that every container is unsafe. The lesson is that container security depends on the host kernel, the runtime, the daemon, and the configuration at the same time.

## A practical policy for agent workloads

Docker can suit an agent workload when all of these conditions hold:

- The operator trusts the code or reviews it before execution.
- The container has no Docker socket or broad host mount.
- The process has a non-root UID and the minimum capability set.
- The default seccomp and AppArmor or SELinux policies remain active.
- The root filesystem is read-only where practical.
- CPU, memory, process, and execution-time limits exist.
- Network access follows an explicit policy.
- The control plane validates mounts, devices, namespaces, capabilities, and security options.

For stronger Docker isolation, consider [rootless mode](https://docs.docker.com/engine/security/rootless/) or [user-namespace remap](https://docs.docker.com/engine/security/userns-remap/). These controls reduce host privilege, but they do not give the workload a separate kernel.

Prefer a microVM when the service accepts unknown repositories, package scripts, generated commands, or repeated requests from an attacker. A microVM gives each workload a guest kernel and puts a hypervisor boundary between that kernel and the host.

A microVM still needs strict policy. Do not expose host credentials, broad file shares, unsafe control-plane options, or unrestricted network access merely because a VM boundary exists.

## Bottom line

Docker is a useful isolation tool, not a complete hostile-code sandbox by default.

For trusted code, strict Docker policy may provide the right balance of speed, density, and isolation. For untrusted AI-agent workloads, a microVM provides a stronger default because the workload does not share the host kernel.

Choose the boundary based on the code you execute, the host access you grant, and the cost of a successful escape.

## Sources

- [Docker Engine security](https://docs.docker.com/engine/security/)
- [Docker default seccomp profile](https://docs.docker.com/engine/security/seccomp/)
- [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
- [Docker daemon socket protection](https://docs.docker.com/engine/security/protect-access/)
- [Docker rootless mode](https://docs.docker.com/engine/security/rootless/)
- [Docker user-namespace remap](https://docs.docker.com/engine/security/userns-remap/)
- [`runc` security advisories](https://github.com/opencontainers/runc/security/advisories)
