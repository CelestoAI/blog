---
author: Celesto AI
pubDatetime: 2026-10-28T21:00:00Z
title: "5 Tips to Reduce CI Time When You Code with AI Agents"
slug: reduce-ci-time-with-ai-agents
featured: true
draft: false
tags:
  - GitHub Actions
  - AI Agents
  - CI
  - Developer Tools
description: "Cut CI waste from agent PRs with labels, cancel-in-progress, precise triggers, dependency caches, and local checks before each push."
---

Keep fast checks on each pull request, cancel tests for obsolete commits, and reserve expensive suites for changes that need them. These five changes help Claude Code, Codex, and other agents deliver feedback sooner with fewer CI runner minutes.

An agent can push a fix, read a failure, and push another fix before the first test suite finishes. If each push starts the entire pipeline, your CI queue fills with work whose results no longer matter.

Separate two goals: **less time until useful feedback** and **fewer total runner minutes**. Four parallel ten-minute jobs can return results in about ten minutes, yet consume about forty runner minutes. More parallel jobs may help the first goal without any benefit to the second.

Cost also depends on your repository and runner. Standard GitHub-hosted runners are free for public repositories; private repositories have plan-specific allowances. A universal “2,000 free minutes” rule does not apply to every account. See [GitHub Actions usage and charges](https://docs.github.com/en/actions/concepts/billing-and-usage).

## 1. Use a label to opt into expensive tests

Keep lint, type checks, and unit tests automatic. Put a long browser or integration suite behind a label such as `ci:full` while an agent refines a PR.

Create that label in your repository, then add a separate workflow such as `.github/workflows/full-tests.yml`:

```yaml
name: Full tests

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review, labeled]

permissions:
  contents: read

jobs:
  integration:
    if: >-
      !github.event.pull_request.draft &&
      contains(github.event.pull_request.labels.*.name, 'ci:full') &&
      (github.event.action != 'labeled' || github.event.label.name == 'ci:full')
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v7
        with:
          node-version: "24"
          cache: npm
      - run: npm ci
      - run: npm run test:integration
```

This example assumes a Node.js project with `package-lock.json` and a `test:integration` script. Replace that command with your actual suite. Use reviewed action commit pins under your repository's policy.

The workflow starts full tests when a non-draft PR receives `ci:full`. Later commits also run the suite while the label remains. The final condition prevents an unrelated label from triggering another full run. The `ready_for_review` event covers a draft PR that already has the label. These event types are explicit because `labeled` and `ready_for_review` are outside the [default PR event set](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request).

Treat this as a cost control, not proof that tests passed. A [job skipped by an `if` condition reports success](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions), even if it is required. If the suite must pass before merge, use a separate required gate that verifies an actual successful run for the current PR revision. Keep required fast checks in an unconditional PR workflow.

## 2. Cancel obsolete runs with `cancel-in-progress`

Once an agent pushes a new commit, results from the previous revision often lose their value. Add this at the top level of the PR workflow, alongside `on` and `jobs`:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

The group separates each workflow and PR. A new run for the same PR cancels its predecessor; runs for other PRs remain independent. The condition limits active cancellation to PR events. GitHub documents this behavior in its [concurrency reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency).

Add this to the label-gated workflow too. Avoid a repository-wide constant such as `group: ci`, which would make unrelated PRs compete for the same group. Keep release and deployment workflows separate if every run must complete.

Cancellation stops future work; it does not refund runner time already consumed.

## 3. Remove duplicate triggers and narrow optional workflows

A workflow with `on: [push, pull_request]` can run twice for one update to a branch with an open PR. Restrict push runs to the default branch:

```yaml
on:
  pull_request:
  push:
    branches: [main]
```

This preserves PR feedback and a check after merge without a second push-triggered run on every feature branch. Replace `main` if your default branch differs.

For an optional frontend suite, add path filters so backend-only changes do not start it:

```yaml
on:
  pull_request:
    paths:
      - "apps/web/**"
      - "packages/ui/**"
      - "package.json"
      - "package-lock.json"
      - ".github/workflows/web-tests.yml"
```

Include shared dependencies, root config files, and the workflow itself. Adapt this list to your dependency graph; a narrow but incomplete list can miss a real regression.

Use workflow-level path filters for optional checks. GitHub warns that a [workflow skipped by a path filter can leave a required check pending](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow). For required checks, keep the workflow active and use change detection plus a final required job that validates the relevant results. Repositories with a merge queue must also support the `merge_group` event in their required-check workflows.

## 4. Cache dependencies across agent revisions

An agent may change application code ten times without any dependency change. Reuse the package cache across those revisions.

For an npm job, use these steps:

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-node@v7
    with:
      node-version: "24"
      cache: npm
      cache-dependency-path: package-lock.json
  - run: npm ci
  - run: npm test
```

The [setup-node cache](https://github.com/actions/setup-node#caching-global-packages-data) uses the lockfile hash as part of its key. It retains npm package data, not `node_modules`, so keep `npm ci` on both hits and misses. In a monorepo, point `cache-dependency-path` at the appropriate lockfile.

Compare cache restore plus install time against a cold install. A large archive can cost more to transfer than it saves. For more detail, see our [CI dependency-cache guide](/blog/posts/celesto-ci-dependency-cache/).

## 5. Make the agent pass fast checks before each push

CI should confirm a change that has already passed the checks available in the agent's environment. Give the agent a concrete contract in `AGENTS.md`:

```text
Before each push:
- Run npm run lint and npm run typecheck.
- Run the unit tests relevant to the change.
- Fix failures caused by your changes before you push.
- Report any check you could not run and its reason.
- Keep the PR as a draft until the change is ready for review.
- Leave the ci:full label for a maintainer to apply.
```

Use your project's real commands. If browser tests require services absent from the agent's environment, state that constraint explicitly and run those tests in CI.

In CI, put cheap checks before expensive tests within a job, or make the expensive job depend on a fast-check job through `needs`. That prevents a known lint failure from consuming a full integration run. The tradeoff is a longer success path than parallel execution, so choose based on whether feedback latency or total runner minutes matters more.

Track total runner minutes per merged PR and the time to the first useful result before and after these changes. Those measurements show whether fewer duplicate runs, earlier failures, and cache reuse actually help your agent workflow.
