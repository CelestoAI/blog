---
author: Celesto AI
pubDatetime: 2026-10-16T20:00:00Z
title: "Celesto CI vs. GitHub: Faster Cache-Hit Jobs on Half the CPUs"
featured: true
draft: false
tags:
  - CI
  - GitHub Actions
  - Developer Tools
  - Celesto
description: "A faster GitHub Actions runner for cache-hit jobs: Celesto CI took 24 seconds on 1 vCPU versus GitHub-hosted's 31 seconds on 2 vCPUs in our benchmark."
---

We ran the same job on Celesto CI and a GitHub-hosted runner, both with a cached set of browser tools. Celesto finished in **24 seconds**. GitHub took **31 seconds**. Celesto used **1 vCPU**; GitHub used **2**. For this job, Celesto took **23% less time with half the CPUs**.

Celesto CI runs your GitHub Actions workflows on fresh cloud computers, with dependency caches that survive between jobs. Without a cache, npm or pip must fetch the same packages again even when those dependencies have not changed. Cache reuse reduces that repeated work before your tests can start.

Use standard GitHub Actions cache steps or your setup action's cache option. Your workflow, logs, test results, and artifacts stay in GitHub.

## A 2.3 GB browser-tool cache: 24-second job on a hit

The comparison used the same browser-tool job with 2.3 GB of cache files, about 730 MB after compression. Each runner completed a cache-miss run to create the archive, then a cache-hit run to restore it.

| Measurement             | Celesto CI (1 vCPU) | GitHub-hosted (2 vCPUs) |
| ----------------------- | ------------------: | ----------------------: |
| Cache restore on a hit  |            **13 s** |                    15 s |
| Complete job on a hit   |            **24 s** |                    31 s |
| Cache save after a miss |                27 s |                **12 s** |
| Complete job on a miss  |                65 s |                **47 s** |

Celesto restored the cache in 13 seconds and completed the job 7 seconds sooner in this comparison. Its cache-hit job also took 41 seconds less than its own cache-miss job: 24 seconds versus 65 seconds. That difference includes the work to create and save the initial archive.

The tradeoff is the first save: Celesto took 27 seconds versus 12 seconds. The benefit in this workload came on later cache hits. A hit depends on compatible keys, access scope, and cache retention; an unchanged key alone does not guarantee reuse.

The phase breakdown explains where the time went:

| Phase                        | Celesto CI | GitHub-hosted |
| ---------------------------- | ---------: | ------------: |
| Compress archive for save    |      ~19 s |         ~10 s |
| Upload archive               |       ~6 s |          ~2 s |
| Download archive for restore |       ~5 s |        ~4.4 s |
| Extract restored archive     |       ~7 s |         ~10 s |

Phase values are approximate; complete step times include other overhead. Celesto used one download stream; GitHub used eight parallel streams. The CPU allocations differ, so these results compare the two runner configurations rather than isolate the cache service's performance. They describe this workload and implementation, before further optimization.

## Start with a Node.js workflow

First, [install the Celesto CI GitHub App](https://github.com/apps/celesto-ci), select your repository, and connect the installation to a Celesto workspace with usable credit. Then add this workflow to a Node.js project with a committed `package-lock.json` and an `npm test` script:

```yaml
name: Node.js tests

on: [push, pull_request, workflow_dispatch]

permissions:
  contents: read

jobs:
  test:
    runs-on: [self-hosted, celesto-micro]
    timeout-minutes: 90
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: package-lock.json

      - run: npm ci
      - run: npm test
```

The `cache: npm` option selects npm's package cache. It does not retain `node_modules`. After a hit, `npm ci` still creates the dependency tree from the lockfile, but it can reuse package files from the restored cache. See the [setup-node cache reference](https://github.com/actions/setup-node#caching-global-packages-data).

On the first successful run, the action can save npm's package cache. On the next run with unchanged dependencies, it can restore those files before `npm ci`. If the lockfile changes, the setup action derives a new key; the install step fetches any packages absent from the restored archive.

Keep the install step on both hits and misses. A cache accelerates dependency setup; the lockfile defines the dependency tree.

If your workflow already runs on Celesto with a compatible cache action, keep its cache steps. Celesto stores the archives outside the job computer so later jobs can restore them. Caches from GitHub-hosted runners stay in GitHub's separate store, so expect an initial miss after a move to Celesto.

## Use an explicit cache for Python

An explicit `actions/cache` step gives you control over the path, primary key, and fallback keys. This example assumes a Python project with a committed `requirements.txt` that includes pytest:

```yaml
name: Python tests

on: [push, pull_request, workflow_dispatch]

permissions:
  contents: read

jobs:
  test:
    runs-on: [self-hosted, celesto-micro]
    timeout-minutes: 90
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Restore pip cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: pip-v1-${{ runner.os }}-${{ runner.arch }}-py312-${{ hashFiles('requirements.txt') }}
          restore-keys: |
            pip-v1-${{ runner.os }}-${{ runner.arch }}-py312-

      - run: python -m pip install -r requirements.txt
      - run: python -m pytest
```

The primary key includes the OS, architecture, Python version, and dependency-file hash. A fallback key allows reuse of an older package archive for the same environment after the dependency file changes. pip still resolves and installs the requested packages.

Use fallback keys for data your package manager can validate and supplement. A compiled binary or environment directory may need a stricter key that also captures the compiler, system libraries, build flags, and other inputs.

Keep action versions or commit pins aligned with your repository's update policy.

## Choose keys that describe compatibility

A useful cache key answers two questions: which environments can reuse these files, and which input change should create a new entry?

For package caches, include the runtime and dependency manifest or lockfile. For compiled output, include all inputs that affect binary compatibility. Use a prefix such as `pip-v1` as a manual reset: change it to `pip-v2` if you need a fresh cache namespace.

Avoid a commit SHA as the only key. It creates a distinct entry for each commit and prevents reuse across unchanged dependencies. Also avoid a broad key such as `dependencies` for every runtime and platform; that makes compatibility implicit.

## Check whether the cache saves time

A package cache can reduce repeated network transfers and, for some package formats, repeated build work. Its value depends on the package manager and the files you retain.

A hit still has a cost: the runner must download and extract an archive. The install command may still validate packages, create an environment, execute lifecycle scripts, or compile dependencies. Your application tests still consume their normal compute time.

Compare complete job durations on the same runner size. Inspect the cache-step outcome, restore duration, dependency-install duration, and archive size. A large archive with little reusable content can cost more to transfer and extract than it saves.

## Storage limits and cache lifetime

The first cache release has no separate cache charge. These configurable defaults determine how much cache data each tier can retain:

| Limit                 | Trial and promotional tier | Paid tier |
| --------------------- | -------------------------: | --------: |
| Per repository        |                      5 GiB |    25 GiB |
| Per Celesto workspace |                     10 GiB |   100 GiB |
| Per entry             |                     10 GiB |    10 GiB |
| Idle expiry           |                     7 days |    7 days |

These are defaults that Celesto can adjust. Job compute still consumes workspace credit under the normal CI runtime rules.

An hourly cleanup task removes idle entries and then the least recently used entries until repository and workspace usage fit their limits. It also clears abandoned uploads. A restore updates the entry's last-access timestamp.

Treat caches as disposable acceleration data. Use artifacts or another durable store for output you must retain.

## Handle a miss or reset a cache

A cache miss should leave your job able to install dependencies and run its tests. If the cache API is unavailable or a repository exceeds a cache request limit, Celesto returns a miss or refuses the save. Your install command can fetch dependencies through its usual source.

If you explicitly set `fail-on-cache-miss: true`, a miss can still fail your workflow by design. Leave that option off when your job can build from source dependencies.

Use cache-step logs to check hits, misses, and saves. GitHub's cache page and `gh cache` manage GitHub's store; they do not list or delete Celesto entries. Celesto's first release has no customer cache list or delete interface. Change your key prefix to bypass an unwanted entry, or contact support if you need it deleted before normal expiry.

The current CI image supports Ubuntu Linux x64 shell steps and compatible JavaScript actions. Docker actions, job containers, and service containers are outside its supported workflow set. This release provides archive caches; persistent cache disks, package mirrors, and Docker/BuildKit layer caches are outside its scope.

For setup, runner labels, installed tools, and compatibility limits, use the [Celesto CI guide](https://docs.celesto.ai/docs/ci).

## How Celesto CI speeds up GitHub Actions with dependency caches

A cache restore has two parts: a lookup that selects an authorized archive, then a download that supplies its files to the action. Celesto implements GitHub's cache-service v2 protocol so compatible actions can use that path without a custom client.

Four components handle the request:

| Component                        | Responsibility                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| Celesto-patched GitHub runner    | Routes supported action steps through the local results proxy                      |
| Rust proxy inside the job VM     | Separates cache requests from other results-service traffic and translates uploads |
| Celesto cache API and PostgreSQL | Verify access, select entries, reserve saves, enforce limits, and track state      |
| Object storage                   | Retains archives and temporary upload blocks                                       |

### Cache requests and artifacts take different routes

The proxy recognizes the cache-service v2 calls for lookup, reservation, and finalization. It forwards those calls to Celesto's cache API with the job's runtime token.

Other results-service requests, including artifact requests, pass through to GitHub. This matters because cache and artifact APIs share the results endpoint. A cache override that captures the entire endpoint without passthrough would disrupt artifact operations.

On a cache hit, the API returns a short-lived object-storage download URL. The action downloads the archive directly from object storage; neither the local proxy nor the control plane relays the archive bytes on that path.

Downloads use a single stream. This release does not provide a host-local NVMe cache or parallel ranged downloads. Network location, archive size, and extraction cost affect restore duration.

Once a job uses Celesto's cache, a service error does not redirect that operation to GitHub's cache. This avoids a run that restores from one store and saves to another. Jobs whose runner starts with Celesto's cache disabled or excluded by provider policy keep GitHub's cache route.

### Why the runner needs a patch

GitHub's runner supplies `ACTIONS_RESULTS_URL` to JavaScript action steps from the job message. A normal environment-variable override is insufficient because the runner supplies its value after those environment settings.

Celesto applies a small source patch to the runner in the CI image. For supported steps on the VM, it can supply the local proxy address while it preserves GitHub's original results URL for passthrough requests. Celesto builds the runner from a pinned source commit and includes it in the versioned image.

Self-update is disabled so an upstream binary cannot silently replace the patch. Celesto owns the runner update cycle and checks upstream releases daily to track the upgrade window.

## How a restore selects an entry

The key is only part of cache identity. Celesto also records the workspace, repository, Git ref scope, and cache version. The client derives the cache version from details such as the cached paths and compression method. Two jobs with the same text key can still have incompatible cache versions.

The CI image includes `zstd`, which the cache toolkit can use for archive compression. A compression-method change can cause a miss even when the key text stays the same. The [actions/cache reference](https://github.com/actions/cache#cache-version) explains this version boundary.

Celesto checks the Git ref scopes granted by the job's verified runtime token. Within each permitted scope, it checks:

1. The exact primary key and cache version.
2. A prefix match for the primary key.
3. Each fallback key in the order supplied by `restore-keys`.

For a prefix match, the most recently committed compatible entry wins. Celesto exhausts those key choices in one scope before it checks the next permitted scope.

This allows a pull request to reuse an authorized base-branch or default-branch cache without a custom branch lookup in your workflow. Access depends on the token's grants. A cache from a pull request's merge ref does not become a default-branch cache just because the keys match. GitHub documents the general scope model in its [dependency cache reference](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache).

## Access follows the job that actually runs

A Celesto runner can receive a different eligible job from the one whose webhook caused its computer to start. Cache access therefore cannot rely on that initial webhook's repository or branch.

The cache API derives repository identity and Git ref grants from the job's GitHub runtime token. It verifies the token against GitHub's public keys and requires that repository to belong to an active Celesto CI installation. The installation determines the Celesto workspace and its quota.

A read-only grant cannot reserve a save. An invalid, expired, or unrecognized token produces an unavailable cache rather than broader access. The token's cache-scope claim is undocumented, so the implementation refuses formats it does not understand.

Cache access also includes the Celesto workspace in its identity. If a repository moves to another workspace, it cannot restore entries from the previous workspace through that new connection.

Cache scope controls reuse, but a dependency archive is still accessible to jobs that hold the relevant read grant. Keep credentials out of cached paths.

## How uploads become reusable archives

The GitHub cache toolkit uses Azure Blob upload semantics even when a third-party service supplies the destination URL. Celesto's proxy translates those requests into object-storage operations.

For a small archive, the proxy streams the upload to a signed object-storage upload URL. For a large archive, blocks arrive as separate temporary objects. The final block-list request supplies their correct order.

Arrival order cannot define file order: parallel transfers can complete out of sequence. Celesto assembles the archive server-side in block-list order, then removes the temporary objects. The control plane coordinates the operation without a full archive download and re-upload.

### Concurrent saves and cleanup

A save first reserves an identity. If two jobs try to reserve the same workspace, repository, scope, key, and version, one reservation succeeds. The other job continues without a duplicate save. A reservation that never completes expires after 30 minutes.

PostgreSQL tracks each entry through reserved, committed, and deleted states. A restore only selects committed entries. Cleanup retains deleted-entry records long enough to remove late uploads too, so an upload that arrives after an initial delete does not escape cleanup.

The entry's actual size is checked after upload. Repository and workspace totals can temporarily exceed their limits when several saves overlap; hourly cleanup brings those totals back under the limits.

## Put dependency reuse to work

Start with your package manager's cache and a key tied to the dependency lockfile. Run the workflow twice with unchanged dependencies, then inspect the second run's cache outcome and total duration. Keep the dependency install and test steps active on every run.

Connect a repository through the [Celesto CI App](https://github.com/apps/celesto-ci), select a runner size, and reuse dependency archives across fresh job computers.
