---
author: Aniket Maurya
pubDatetime: 2026-10-18T01:35:00Z
title: "Run Docker and Compose CI from Your Personal GitHub Account"
featured: true
draft: false
tags:
  - CI
  - Docker
  - PostgreSQL
  - GitHub Actions
  - Celesto
description: "Run Docker builds, PostgreSQL services, and Azurite tests on Celesto CI from a personal GitHub account. Use tested examples and compare the cost of your actual jobs."
---

Run Docker builds, PostgreSQL, and Azurite tests on Celesto CI without a GitHub organization or an always-on PC. Install the GitHub App on your personal account, connect a Celesto workspace, and move one Docker job first. Your workflow, logs, and artifacts stay in GitHub.

A Python-only job and a Docker integration job do not need the same runner size. Keep them separate so you can test compatibility and cost before you move the rest of your CI.

## Use a personal account for image builds, Compose, and Postgres services

| Question                                                      | Answer                                                                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Do I need a GitHub organization?                              | No. You can install the Celesto CI App on a personal GitHub account and select repositories you administer. |
| Can the runner build and run Docker images?                   | Yes, on the Docker-enabled Linux CI image. The public smoke run built, loaded, and executed an image.       |
| Can Compose run PostgreSQL and Azurite?                       | Yes. The repeated suite checked real SQL and Azure Blob roundtrips through a Python API.                    |
| Can I keep native GitHub `services:` for PostgreSQL?          | Yes, the native PostgreSQL service passed a separate functional smoke test.                                 |
| Does this prove Celesto is the cheapest option for every job? | No. Compare actual billed runtime, runner size, and any applicable free allowance.                          |

The image-build, Compose, and native-service checks have [public functional evidence](https://github.com/CelestoAI/ci-benchmarks/actions/runs/39071944026). The [five-repeat comparison](https://github.com/CelestoAI/ci-benchmarks/blob/e4461a43c193d56560c7df56ceff7fb3170cee78/results/docker-2026-10-17/README.md) adds the full Python/PostgreSQL/Azurite assertions. These are representative fixtures, not your private application.

Direct BuildKit `type=gha,version=2` export and Docker's explicit `--cpus` flag failed preflight. The examples avoid those paths; Docker support is not a promise that every flag or cache protocol works.

## Keep your personal repositories; connect a Celesto workspace for payment

1. [Install the Celesto CI GitHub App](https://github.com/apps/celesto-ci).
2. Select your personal GitHub account and the repositories you want Celesto to run.
3. Sign in to Celesto, connect your GitHub account, and link the installation to a workspace with eligible credit.
4. Select a runner size in the job's `runs-on` field.

A Celesto workspace can appear as a **Celesto organization** in account setup. That is the workspace that owns and pays for the jobs, not a requirement to create a GitHub organization. Your repositories can remain under your personal GitHub account.

The image and Compose examples below use `celesto-large`, the **4-vCPU / 16-GiB** size from the repeated comparison. The native PostgreSQL example uses `celesto-small`, as its functional smoke test did. These choices establish what the examples tested, not the minimum size for every application.

## Catch image failures before you add service tests

The example uses a [public Python API fixture](https://github.com/CelestoAI/ci-benchmarks/tree/e4461a43c193d56560c7df56ceff7fb3170cee78/docker-bench/python), so you do not need a private application or a new test project. Its image has hash-locked Python dependencies and a self-test that imports the database and Azure clients. That self-test does not connect to either service yet.

Add `.github/workflows/docker.yml` to your repository:

```yaml
name: Docker on Celesto

on: workflow_dispatch

permissions:
  contents: read

jobs:
  test:
    runs-on: [self-hosted, celesto-large]
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - name: Fetch the public API fixture
        uses: actions/checkout@v4
        with:
          repository: CelestoAI/ci-benchmarks
          ref: e4461a43c193d56560c7df56ceff7fb3170cee78
          path: ci-fixture

      - name: Build the API image
        run: |
          BASE=$(python3 -c 'import json; print(json.load(open("ci-fixture/docker-bench/images.json"))["python"])')
          docker build --build-arg "BASE=$BASE" \
            -t app:ci ci-fixture/docker-bench/python

      - name: Check the image
        run: |
          test "$(docker run --rm app:ci python app.py --self-test)" = 42
```

Open **Actions → Docker on Celesto → Run workflow**. The last step must exit successfully. A missing dependency or a failed image build fails the job.

Docker is already present on the Docker-enabled runner image. The base image digest comes from the fixture's `images.json`; it is not a mutable Python tag. The checkout action uses a short version reference for readability; use a reviewed commit pin under your repository's action policy.

For your own application, replace the fixture checkout, build context, and self-test with your project's image and test command. Do not expect pytest to exist in a production image unless your Dockerfile includes it.

<details>
<summary><strong>Prove SQL and blob operations work, not just service health</strong></summary>

## Fail the job when SQL or blob results are wrong

The job’s test step calls the Python API on the Celesto runner. The API sends SQL queries to PostgreSQL and blob requests to Azurite over the Compose network.

![GitHub Actions starts a job on a Celesto CI runner. Its test step calls the Python API over HTTP; the API sends SQL queries to PostgreSQL and blob requests to Azurite inside Docker Compose.](./images/docker-compose-ci-flow.svg)

Keep the workflow through **Build the API image**. Add this `compose.yaml` to your repository root. The first checkout supplies this file; the second supplies the API fixture.

```yaml
services:
  postgres:
    image: ${POSTGRES_IMAGE:?Set POSTGRES_IMAGE}
    environment:
      POSTGRES_PASSWORD: benchmark-only
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 1s
      timeout: 3s
      retries: 60

  azurite:
    image: ${AZURITE_IMAGE:?Set AZURITE_IMAGE}
    environment:
      # Disposable emulator account, not an Azure credential.
      AZURITE_ACCOUNTS: benchmark:YmVuY2htYXJrLXNtb2tlLWtleS1ub3QtYS1zZWNyZXQ=
    command: >-
      azurite --blobHost 0.0.0.0 --queueHost 0.0.0.0
      --tableHost 0.0.0.0 --skipApiVersionCheck
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - >-
          require('http').get('http://127.0.0.1:10000/',
          r => process.exit(r.statusCode === 400 ? 0 : 1))
          .on('error', () => process.exit(1))
      interval: 1s
      timeout: 3s
      retries: 60

  api:
    image: app:ci
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      DATABASE_URL: postgresql://postgres:benchmark-only@postgres/postgres
      AZURITE_KEY: YmVuY2htYXJrLXNtb2tlLWtleS1ub3QtYS1zZWNyZXQ=
    depends_on:
      postgres:
        condition: service_healthy
      azurite:
        condition: service_healthy
    healthcheck:
      test:
        - CMD
        - python
        - -c
        - >-
          import urllib.request;
          urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=2)
      interval: 1s
      timeout: 3s
      retries: 60
```

Azurite returns HTTP 400 for the unsigned root request in its health check. That response proves the HTTP endpoint responds. It does not prove that a blob operation succeeds; the API test below checks that separately.

Replace **Check the image** with these workflow steps:

```yaml
- name: Resolve pinned service images
  run: |
    python3 - <<'PY' >> "$GITHUB_ENV"
    import json
    from pathlib import Path

    images = json.loads(Path("ci-fixture/docker-bench/images.json").read_text())
    for name in ("postgres", "azurite"):
        print(f"{name.upper()}_IMAGE={images[name]}")
    PY

- name: Start services
  run: docker compose -p ci up -d --wait --wait-timeout 120

- name: Test SQL and Azure Blob roundtrips through the API
  run: |
    python3 - <<'PY'
    import json
    import urllib.request

    expected = {"rows": 1000, "sum": 499500, "blob_bytes": 1048576}
    for _ in range(5):
        with urllib.request.urlopen("http://127.0.0.1:8080/exercise", timeout=30) as response:
            actual = json.load(response)
        assert actual == expected, actual
    print("SQL and blob assertions passed in all five rounds")
    PY

- name: Show service logs
  if: always()
  run: docker compose -p ci logs --no-color

- name: Remove this job's services and volumes
  if: always()
  run: docker compose -p ci down --volumes
```

Each API request creates a test table, inserts 1,000 rows, checks the count and sum, uploads a 1-MiB blob, downloads it, and checks its bytes. An API error or an incorrect result fails the job. The [API source](https://github.com/CelestoAI/ci-benchmarks/blob/e4461a43c193d56560c7df56ceff7fb3170cee78/docker-bench/python/app.py) contains those assertions.

The database and emulator credentials belong only to these disposable CI services. Do not point this fixture at a production database: it truncates its test table. The final step removes the Compose project's volumes even after a test failure.

These examples adapt the tested fixture. The workflow and Compose file below have syntax checks, but they are not an additional measured benchmark cohort.

</details>

<details>
<summary><strong>Keep PostgreSQL in GitHub's native services syntax</strong></summary>

## Test a Postgres service without a Compose file

If your workflow already declares PostgreSQL under `services:`, you do not need to convert that job to Compose just to test Celesto.

Add this as a separate workflow, such as `.github/workflows/postgres-service.yml`:

```yaml
name: Verify a PostgreSQL service

on: workflow_dispatch

permissions:
  contents: read

jobs:
  postgres:
    runs-on: [self-hosted, celesto-small]
    timeout-minutes: 10
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: smoke-only-password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 2s
          --health-timeout 5s
          --health-retries 30
    steps:
      - name: Assert a real SQL result
        run: |
          result=$(docker exec '${{ job.services.postgres.id }}' \
            psql -U postgres -tAc 'SELECT 6 * 7')
          test "$result" = 42
```

The SQL assertion uses the service container that GitHub created. It checks an actual database response, not only a successful container start. Use your own database assertions after this check; if the test runs on the job host, the mapped PostgreSQL port is `localhost:5432`.

The [native-service smoke run](https://github.com/CelestoAI/ci-benchmarks/actions/runs/39071944026) passed on Celesto Small. It is a functional result, not a five-repeat service-container speed comparison. This example uses the same PostgreSQL tag as that smoke run; pin a reviewed digest under your repository's image policy.

</details>

<details>
<summary><strong>Authenticate image pulls before daily job volume grows</strong></summary>

## Give service containers credentials before their first pull

Many fresh jobs can exhaust an anonymous Docker Hub pull allowance. Store a Docker Hub username and a read token as repository secrets. Public-image read access is enough for these fixtures; private images require the appropriate access.

```sh
gh secret set DOCKERHUB_USERNAME --repo YOUR_ACCOUNT/YOUR_REPO
gh secret set DOCKERHUB_TOKEN --repo YOUR_ACCOUNT/YOUR_REPO
```

For image builds and Compose, add this step before the first Docker pull or build:

```yaml
- name: Authenticate Docker Hub pulls
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}
```

Native GitHub services start before job steps. A later login step cannot authenticate their initial pull. For the PostgreSQL service example, add credentials under `services.postgres`:

```yaml
credentials:
  username: ${{ secrets.DOCKERHUB_USERNAME }}
  password: ${{ secrets.DOCKERHUB_TOKEN }}
```

Keep tokens out of Compose files and image layers. Authentication does not remove account quotas; inspect the registry response if a pull returns HTTP 429.

</details>

## Budget 600 daily minutes by job type, not one headline rate

For a workload with 600 runner-minutes per day, one third Python-only and two thirds Docker, a 30-day baseline is:

| Job class                           | Baseline minutes per day | Baseline minutes per 30 days |
| ----------------------------------- | -----------------------: | ---------------------------: |
| Python without Docker               |                      200 |                        6,000 |
| Docker builds and integration tests |                      400 |                       12,000 |
| Total                               |                      600 |                       18,000 |

Those are workload-volume estimates from the assumed split, not a Celesto bill. Runner-minutes need not stay constant after a provider or machine-size change.

Use this estimate for each job class:

```text
monthly compute cost =
  runs per month × measured billed minutes per run × selected runner rate
```

Then account for applicable free allowances and any charges outside compute. Check the [current rates](https://celesto.ai/pricing) before you budget. Do not apply a Micro rate to a Large job, or treat 600 minutes of test commands as 600 billed runner-minutes: runner preparation and cleanup can consume runtime too.

Test Python-only jobs on a smaller eligible size if their CPU and memory needs fit. Qualify Docker jobs separately, with the database, emulator, image-build peak memory, and disk use included. Leave local runners or GitHub jobs in place until one representative Celesto job passes.

In the matched experiment, the Python API/PostgreSQL/Azurite workload took **42.39 seconds on Celesto versus 40.44 seconds on GitHub**, at the median of five repetitions per provider. That is a functional success, not evidence of a Docker-wide speed advantage or a lower total bill. Setup and post-job cleanup are outside those workload times.

## Check two limits before you move a Docker job

- **Direct BuildKit GHA cache export:** `type=gha,version=2` crashed on Celesto in both preflight attempts. Shared-registry caches and portable archives through `actions/cache` are separate tested paths, not fixes for that failure.
- **Explicit Docker CPU limits:** `docker run --cpus=4` failed because a nested cgroup control file was absent. The repeated suite relied on the VM's existing CPU allocation on both providers, without that flag.

The successful Docker and Compose tests do not certify every Docker action, job-container configuration, resource-limit flag, or image architecture. Check the [compatibility notes and failed-run links](https://github.com/CelestoAI/ci-benchmarks/blob/e4461a43c193d56560c7df56ceff7fb3170cee78/docker-bench/compatibility.md) if your workflow depends on one of those paths.

The earlier [dependency-cache release post](/blog/posts/celesto-ci-dependency-cache/) described an image without Docker workflow support. This post covers the later Docker-enabled CI image used in the linked runs; it does not expand the older release's qualification.

## Move one Docker job before you move all your CI

Start with an image build and its self-test. Add the Compose SQL/blob assertions or your existing PostgreSQL service. Compare the complete job's billed runtime and resource use with your current provider, then choose which job class to move next.

Your PC does not need to stay on for that cloud job. Your personal GitHub repositories do not need to move into a GitHub organization.
