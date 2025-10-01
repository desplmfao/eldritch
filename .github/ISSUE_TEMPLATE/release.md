---
name: release checklist
about: a checklist for creating and publishing a new release
title: "[release] version vX.Y.Z"
labels: release
assignees: desplmfao

---

## release version: vX.Y.Z

this issue tracks the process for publishing version X.Y.Z of the eldritch engine packages.

### pre-release

- [ ] ensure all pull requests for this milestone are merged.
- [ ] run a final `pnpm install` and `bun scripts/build.ts` to confirm a clean build.
- [ ] run the full test suite and ensure all tests are passing: `bun scripts/compile_tests.ts && bun test`.
- [ ] update the changelog to reflect all significant changes since the last release.
- [ ] review and update all relevant documentation pages.
- [ ] create a new release branch: `git checkout -b release/vX.Y.Z`.
- [ ] commit any final changes (like the changelog).

### release

- [ ] create and push the git tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
- [ ] run the publish script (once created).
- [ ] create a new release on github from the pushed tag. copy the changelog notes into the release description.

### post-release

- [ ] verify that all packages have been successfully published to the npm registry.
- [ ] announce the new release in the appropriate channels.
- [ ] merge the release branch back into `main`.