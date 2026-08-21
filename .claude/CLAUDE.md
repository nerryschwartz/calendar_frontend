# Repo-Local Claude Instructions

These instructions apply when Claude works in this repository.

## Pre-Commit Workflow

Before committing repository changes, use this workflow:

1. Run a commit-readiness audit of the current working diff, following the intent of the corresponding repo audit guidance when available.
2. Run an abstraction review. This is part of this repo's pre-commit checks.
3. Run the local validation commands. This is also part of this repo's pre-commit checks:
   - `npm run format`
   - `npm test`

For this repository, the pre-commit checks are steps 2 and 3: the abstraction review and the local validation command sequence.
