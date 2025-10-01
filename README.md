# eldritch engine

> thank you for your interest in the eldritch engine!
>
> before you dive in, please be aware of the current state of this repository:
>
> *   **this is a public mirror:** this repository is a periodically updated mirror of our primary, private development repository. as a result, updates here will lag behind our internal work
> *   **unstable git history:** to keep the public history clean and aligned with our internal development, we will be frequently using `git rebase` and `git push --force` (**this means the commit history is unstable and should not be relied upon for forks or ongoing pull requests.**)
> *   **proof of work, not a stable base:** the primary purpose of this repository in its current state is to serve as a public mirror for visibility and to showcase the engine's architecture and functionality as it develops. our goal is to be transparent about our process and manage expectations realistically, rather than generating hype for features that are still in early, active development
> *   **rapid development & api instability:** the engine is under heavy, rapid development. as a result, apis can and will change frequently, and some packages may temporarily lag behind the latest core features
> *   **incomplete packages:** to focus development, some packages may be placeholders, severely unimplemented, or missing entirely from this public mirror
> *   **internal rfcs are private:** our internal rfc documents, which outline future and highly ambitious features, are not included in this public repository. they are unfinalized, subject to significant change, and we prefer to avoid generating premature hype for work that is still in the deep design phase
> *   **contributions are not being accepted at this time:** consequently, we are **not accepting pull requests** or reviewing most issues on this public tracker
>
> the best place for discussion, questions, and to follow progress is our discord server

## community & support

have questions, want to show off what you've made, or just want to get involved with the community? join us on [discord](https://discord.gg/QUX93AANJk)!

## getting started: monorepo setup

to use the eldritch engine, your project must be configured as a `pnpm` workspace. this integrates the engine directly into your project's dependency graph, enabling seamless cross-package development (e.g., changes in the engine are instantly available to your game) and simplifying dependency management.

the setup is a two-step process:
1.  **choose a project structure:** arrange your engine and game directories using one of the three supported methods.
2.  **configure the pnpm workspace:** create a `pnpm-workspace.yaml` file in your game's root directory with the paths that match your chosen structure.

### step 1: choose a project structure

the build system can locate the engine in three ways. choose the one that best fits your workflow.

#### method 1: sibling directories (recommended)

this is the simplest and most common structure. your game project and the engine repository are located in the same parent directory.

**structure:**
```
my-dev-folder/
├── engine/                     <-- the eldritch engine git repository
└── my-awesome-game/            <-- your game project's monorepo
    ├── src/
    └── package.json
```

**workspace configuration (`my-awesome-game/pnpm-workspace.yaml`):**
```yaml
packages:
   - "src/**"
   - "!**/node_modules/**"
   # path to the sibling engine directory
   - "../engine/src/**"
   - "!../engine/src/**/node_modules/**"
onlyBuiltDependencies:
   - "@swc/core"
   - esbuild
```

#### method 2: git submodule

this method is ideal for versioning the engine directly within your game's monorepo.

**setup:**
```bash
# from your game's root directory
git submodule add https://github.com/desplmfao/eldritch.git engine
```

**structure:**
```
my-awesome-game/
├── .gitmodules
├── engine/                     <-- the eldritch engine submodule
├── src/
└── package.json
```

**workspace configuration (`my-awesome-game/pnpm-workspace.yaml`):**
```yaml
packages:
   - "src/**"
   - "!**/node_modules/**"
   # path to the submodule engine directory
   - "engine/src/**"
   - "!engine/src/**/node_modules/**"
onlyBuiltDependencies:
   - "@swc/core"
   - esbuild
```

#### method 3: explicit path

for non-standard project layouts, you can define an explicit path in your game's `package.json`. the build system will use this path to find the engine. you must still create a `pnpm-workspace.yaml` file with the correct relative path for `pnpm` to link the dependencies.

**structure:**
```
/home/user/
├── git/
│   └── eldritch-engine/        <-- the engine repository
└── projects/
    └── my-awesome-game/        <-- your game project's monorepo
        └── package.json
```

**build system configuration (`my-awesome-game/package.json`):**
```json
{
   "name": "my-awesome-game",
   "engine_path": "/home/user/git/eldritch-engine"
}
```

**workspace configuration (`my-awesome-game/pnpm-workspace.yaml`):**
you must calculate the relative path from your game project to the engine. for the example structure above, it would be:
```yaml
packages:
   - "src/**"
   - "!**/node_modules/**"
   - "/home/user/git/eldritch-engine/src/**"
   - "!/home/user/git/eldritch-engine/src/**/node_modules/**"
onlyBuiltDependencies:
   - "@swc/core"
   - esbuild
```

### step 2: initial setup

once your project is structured and your `pnpm-workspace.yaml` is in place, run the following commands:
```bash
# 1. navigate to the engine directory and install its dependencies
cd path/to/your/engine
pnpm install

# 2. navigate to your monorepo's root and install its dependencies
cd path/to/your/my-awesome-game
pnpm install