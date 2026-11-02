# How we work

Every change starts as a GitHub issue and ends as a released version.

## Flow
1. **Issue** - use a template (bug, feature, chore). Add `module:` and `priority:` labels and put it in the release milestone (for example `v3.1.0`).
2. **Branch** - `<type>/<issue#>-<slug>`, for example `feat/142-attendance-schema`. Types: feat, fix, perf, refactor, docs, test, chore.
3. **Pull request** - body starts with `Closes #142`. The title is a conventional commit, because the squash-merge uses it as the commit message:
   - `feat(sales): ...` raises the minor version
   - `fix(stock): ...` raises the patch version
   - `feat(sales)!: ...` or a `BREAKING CHANGE:` footer raises the major version
   - docs, test, chore, ci, build, refactor do not release on their own
4. **Checks** - CI builds the API and the frontend; the PR title is validated. Both must pass.
5. **Merge** - squash only. Delete the branch.
6. **Release** - release-please keeps an open "chore: release x.y.z" PR. Merging it updates `CHANGELOG.md`, bumps `version.txt`, `api-v2/package.json` and `frontend/package.json`, tags `vX.Y.Z` and publishes the GitHub Release.

## Versioning
One version for the whole repo (api, frontend and SQL together), following SemVer. Do not edit version numbers by hand.

## Database migrations
SQL goes in `sql/migrations/NNN-description.sql` with the next free number. List new migration numbers in the PR body so they reach the release notes. A migration that cannot be rolled back needs a note saying so.

## Hotfix
Branch `release/X.Y.x` from the tag, fix with a `fix:` PR into it, and release-please releases the patch from that branch.
