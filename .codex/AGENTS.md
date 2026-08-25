# Repo-Local Codex Instructions

These instructions apply when Codex works in this repository.

## Pre-Commit Workflow

Before committing repository changes, use this workflow:

1. Run a commit-readiness audit of the current working diff, following the intent of the corresponding repo audit guidance when available.
2. Run an abstraction review. This is part of this repo's pre-commit checks.
3. Run the local validation commands. This is also part of this repo's pre-commit checks:
   - `npm run format`
   - `npm run test:default`

For this repository, the pre-commit checks are steps 2 and 3: the abstraction review and the local validation command sequence.

## Test Markers

- Mark frontend tests that take more than one second with `[slow]` in the test title.
- Mark tests as `[failure_expected]` only when a change makes them fail temporarily by design and they are expected to pass again before the PR is complete.
- Remove `[failure_expected]` before the PR is complete.
- `npm run test:default` excludes `[slow]` and `[failure_expected]` tests. Run targeted tests, including slow-tagged tests, when they are relevant to the current change.
- In branch-loop workflows, non-final passes should run only targeted tests/checks relevant to the pass. The final pass should run the full default validation sequence.
