# wait-for-status-checks
[![test](https://github.com/poseidon/wait-for-status-checks/actions/workflows/test.yaml/badge.svg)](https://github.com/poseidon/wait-for-status-checks/actions/workflows/test.yaml)

`wait-for-status-checks` is a GitHub Action that polls the GitHub Check Runs on a Pull Request and waits until all runs succeed (or are skipped) or one of them fails. It provides a way to enforce "require _triggered_ checks pass" vs. GitHub's naive "require checks to pass".

## Features

* Monitor all GitHub Check Runs (except itself) on a Pull Request
* Configure the poll `interval` and `timeout`
* Use as a "required check" to monitor other check runs

## Overview

GitHub Actions Workflows can be [triggered](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows) conditionally based on [`paths`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#onpushpull_requestpull_request_targetpathspaths-ignore), [`branches`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#onpull_requestpull_request_targetbranchesbranches-ignore), or [commit message](https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs) modifiers. This feature allows workflows (and their jobs) to run (or not) on a Pull Request based on what files changed, what branch was targeted, or whether a commit message skips checks (break glass).

```yaml
name: workflow
on:
  pull_request:
    paths:
      - 'go/**'
    branches:
      - main
```

However, [only GitHub jobs that _always_ run](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/troubleshooting-required-status-checks#handling-skipped-but-required-checks) can be made a "required check" in a branch protection rule or ruleset (see [discussion](https://github.com/orgs/community/discussions/13690)). If a job is skipped because it's workflow wasn't triggered, making the job status "required" will block merges.

This arises frequently in large repos. For example, a workflow that runs a `go fmt` job only needs to run if `*.go` files were changed, but adding the `paths` filter means the status can't be marked as a "required check". Otherwise, PRs that don't modify Go files would be blocked from merging.

## Usage

`wait-for-status-checks` polls the check runs for the head commit of a Pull Request until they all succeed or one fails. The action monitors check runs at some `interval` until a `timeout` is reached, which makes it a suitable way to enforce that all triggered checks succeeded.

* `success` - All check runs completed as either `success` or `skipped`
* `failure` - One or more check runs completed as with a non-successful conclusion (e.g. `failure`, `stale`, `timed_out`, `cancelled`)

```yaml
name: github-summary
on:
  pull_request:
jobs:
  enforce-all-checks:
    runs-on: ubuntu-latest
    permissions:
      checks: read
    steps:
      - name: GitHub Checks
        uses: poseidon/wait-for-status-checks@v0.1.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

The action knows to exclude its own check run (i.e. the GitHub Actions job that runs `wait-for-status-check`)

### Inputs

| Input | Example | Default | Description |
|-------|---------|---------|-------------|
| token | ${{ secrets.GITHUB_TOKEN }} | | GitHub token with `checks: read` |
| interval | 10s | 10s | Interval in seconds to poll GitHub Check runs |
| timeout | 300s | 3600s | Timeout in seconds to poll GitHub Check runs |
| ignore  | foo,bar | | GitHub checks that should be ignored |

## Alternatives

Many alternatives have been tried:

* GitHub used to suggest that for each conditional workflow you wish to make required, create a dummy workflow job of the same name, that runs in the inverse case and passes to satisfy the required check. This is messy and was removed from their docs.
* Mixpanel [built](https://engineering.mixpanel.com/enforcing-required-checks-on-conditional-ci-jobs-in-a-github-monorepo-8d4949694340) an internal GitHub App using GCP Pub/Sub
* Instead of using conditional GitHub Workflows, try to make each job conditional since skipped jobs are considered successes. This is obviously a workaround and 3rd party actions are needed to support `paths` filtering at the job level (e.g. [dorny/paths-filter](https://github.com/dorny/paths-filter))
