/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/scripts/build.ts
 */

import { find_git_root } from '@eldritch-engine/utils/misc';
import { run_build_orchestrator, type RunOrderedBuildsOptions } from '@eldritch-engine/builder/build_orchestrator';

async function main() {
   const args = process.argv.slice(2);

   const watch_mode = args.includes('--watch') || args.includes('-w');
   const skip_initial_build = args.includes('--skip-initial-build') || args.includes('-s');

   const options: RunOrderedBuildsOptions = {
      watch: watch_mode,
      orchestrator_name: 'eldritch monorepo build',
      skip_initial_build_on_watch: skip_initial_build,
   };

   const project_root = await find_git_root(process.cwd()) || process.cwd();

   console.info(`[build script] project root identified as: ${project_root}`);

   await run_build_orchestrator(project_root, options);

   if (watch_mode) {
      console.info('[build script] initial build complete. watching for changes... (press ctrl+c to exit)');
   }
}

main();