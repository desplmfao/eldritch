/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/scripts/test_pkg.ts
 */

import { $ } from 'bun';
import { default as path } from 'node:path';

import { find_git_root, find_package_root_and_name } from '@eldritch-engine/utils/misc';

async function main() {
   try {
      const current_dir = process.cwd();
      const project_root = await find_git_root(current_dir);
      const package_info = await find_package_root_and_name(current_dir);

      if (
         !project_root
         || !package_info
      ) {
         console.error('fatal: could not determine project or package root. ensure script is run from a valid package directory');

         process.exit(1);
      }

      console.info(`--- preparing to test package: ${package_info.package_name} ---`);

      const compile_script_path = path.join(project_root, 'scripts', 'compile_tests.ts');

      console.info(`1. invoking main compiler for package '${package_info.package_name}'...`);

      const compile_proc = Bun.spawnSync(
         [
            'bun',
            compile_script_path,
            '-c',
            package_info.package_name
         ],
         {
            stdio: ['inherit', 'inherit', 'inherit'],
            env: {
               ...process.env
            }
         }
      );

      if (compile_proc.exitCode !== 0) {
         console.error(`\n--- compilation failed for ${package_info.package_name} ---`);

         process.exit(1);
      }

      console.info(`\n2. compilation successful. running tests for ${package_info.package_name}...`);

      const test_proc = await $`find . -path "*/tests-dist/**/*.test.*" | xargs bun test`.cwd(package_info.package_root);

      if (test_proc.exitCode !== 0) {
         console.error(`\n--- tests failed for ${package_info.package_name} ---`);

         process.exit(1);
      }

      console.info(`\n--- tests passed for ${package_info.package_name} ---`);

   } catch (error) {
      let err = error;

      if (
         error
         && typeof error === 'object'
         && ('stdout' in error || 'stderr' in error)
      ) {
         const { stdout, stderr, ...sanitized_error } = error as { stdout: string, stderr: string };

         err = sanitized_error;
      }

      console.error(`an unexpected error occurred while testing package in ${process.cwd()}:`, err);

      process.exit(1);
   }
}

main();