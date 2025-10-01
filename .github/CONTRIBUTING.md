# Contributing to the eldritch engine

first off, thank you for considering contributing to the eldritch engine! it's people like you that make open source such a great community.

this project adheres to the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). by participating, you are expected to uphold this code.

## ways to contribute

we welcome contributions in several forms:

*   **reporting bugs:** if you find a bug, please open an issue in our [issue tracker](https://github.com/desplmfao/eldritch/issues). be sure to include a clear title, a description of the issue, steps to reproduce, and any relevant logs or screenshots.
*   **suggesting enhancements:** have an idea for a new feature or an improvement to an existing one? open an issue to start a discussion.
*   **writing code:** if you'd like to contribute code, please follow the process outlined below.
*   **improving documentation:** good documentation is crucial. if you find typos, unclear explanations, or areas that need more detail, feel free to submit a pull request.
*   **proposing a request for comments (rfc):** for significant changes to the engine's architecture, apis, or core functionality, we use an rfc process. please use the [rfc proposal template](/.github/ISSUE_TEMPLATE/rfc.md) to open an issue and start the discussion.

## getting started with development

to get started with the code:

1.  **fork the repository:** create your own fork of the project on github.
2.  **clone your fork:**
   ```bash
   git clone https://github.com/your-username/eldritch.git
   cd eldritch
   ```
3.  **install dependencies:** we use pnpm as our package manager.
   ```bash
   pnpm install
   ```
4.  **run the development build watcher:** this step is crucial for a good developer experience. the build script compiles each package and generates the necessary typescript type definitions (`.d.ts` files) in their respective `dist/` directories. without these files, your code editor (like vs code) will not be able to correctly resolve imports between packages in the monorepo, resulting in type errors.

   for active development, it is **highly recommended** to run the build in **watch mode** in a separate terminal. this will automatically re-compile packages as you make changes:
   ```bash
   # recommended for development (run in a separate terminal)
   bun scripts/build.ts --watch
   ```
   alternatively, you can run a one-time build if you don't plan on making widespread changes:
   ```bash
   # for a single build
   bun scripts/build.ts
   ```
5.  **run tests:** ensure all existing tests pass before you start making changes. this command first compiles all test files into the `tests-dist/` directories and then runs the test suite. (esbuild sometimes puts useless noise on a build fail so there is stuff to remove it)
   ```bash
   set -o pipefail; (bun scripts/compile_tests.ts && find . -path "*/tests-dist/**/*.test.*" | xargs bun test) 2>&1 | awk '{print} /all goroutines are asleep - deadlock!/ {exit 1}'
   ```

## submitting a pull request

1.  **create a new branch:** create a descriptive branch name from `main`.
   ```bash
   git checkout -b feature/my-new-feature
   ```
2.  **make your changes:** write your code, add tests, and update documentation as needed.
3.  **ensure tests pass:** run the test suite again to make sure your changes haven't introduced any regressions.
4.  **commit your changes:** use a clear and descriptive commit message. we loosely follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.
5.  **push to your fork:**
   ```bash
   git push origin feature/my-new-feature
   ```
6.  **open a pull request:** go to the eldritch repository on github and open a pull request. provide a clear title and description of your changes. if your pr addresses an existing issue, be sure to link it (e.g., `closes #123`).

## rfc process for major changes

for any substantial change to the engine, we require an rfc. this process allows for community discussion and ensures that major architectural decisions are well-vetted.

1.  **propose:** open an issue using the [rfc proposal template](/.github/ISSUE_TEMPLATE/rfc.md).
2.  **discuss:** the proposal will be discussed by the community and engine maintainers.
3.  **approve:** once consensus is reached, the rfc will be approved and merged into the `/docs/architecture/rfcs` directory.
4.  **implement:** with an approved rfc, implementation can begin. the pull request for the implementation should reference the rfc issue.

thank you again for your interest in contributing!