/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/scripts/sort_package_deps.ts
 */

import { Glob } from 'bun';

import { promises as fs } from 'node:fs';
import path from 'node:path';

const project_root = process.cwd();
const glob_pattern = '**/package.json';

const exclude_patterns = [
   '**/node_modules/**',
   '**/dist/**',
   '**/tests-dist/**',
   '**/__generated__/**'
];

function sort_dependencies(
   deps: Record<string, string> | undefined
): Record<string, string> | undefined {
   if (
      !deps
      || Object.keys(deps).length === 0
   ) {
      return deps;
   }

   const sorted_keys = Object.keys(deps).sort((a, b) => a.localeCompare(b));

   return sorted_keys.reduce(
      (acc, key) => {
         acc[key] = deps[key]!;

         return acc;
      },
      {} as Record<string, string>
   );
}

async function main() {
   console.info('--- starting package.json dependency sorter ---');

   const glob = new Glob(glob_pattern);
   const exclude_globs = exclude_patterns.map((pattern) => new Glob(pattern));
   const all_files = await Array.fromAsync(glob.scan({ cwd: project_root, absolute: true }));

   const files_to_process = all_files.filter(
      (file_path) => !exclude_globs.some((exclude_glob) => exclude_glob.match(file_path))
   );

   if (files_to_process.length === 0) {
      console.info('no package.json files found to process');

      return;
   }

   console.info(`found ${files_to_process.length} package.json files to process...`);

   let modified_count = 0;

   for (const file_path of files_to_process) {
      const relative_path = path.relative(project_root, file_path);

      try {
         const original_content = await fs.readFile(file_path, 'utf-8');
         const package_json = JSON.parse(original_content);

         let was_modified = false;

         if (package_json.dependencies) {
            const sorted_deps = sort_dependencies(package_json.dependencies);

            if (JSON.stringify(Object.keys(package_json.dependencies)) !== JSON.stringify(Object.keys(sorted_deps!))) {
               package_json.dependencies = sorted_deps;

               was_modified = true;
            }
         }

         if (package_json.devDependencies) {
            const sorted_dev_deps = sort_dependencies(package_json.devDependencies);

            if (JSON.stringify(Object.keys(package_json.devDependencies)) !== JSON.stringify(Object.keys(sorted_dev_deps!))) {
               package_json.devDependencies = sorted_dev_deps;

               was_modified = true;
            }
         }

         if (was_modified) {
            const new_content = JSON.stringify(package_json, null, 3) + '\n';

            await fs.writeFile(file_path, new_content, 'utf-8');

            console.info(`[SORTED] ${relative_path}`);

            modified_count++;
         } else {
            console.info(`[OK]     ${relative_path}`);
         }
      } catch (error) {
         console.error(`[ERROR]  failed to process ${relative_path}:`, error);
      }
   }

   console.info('\n--- finished ---');
   console.info(`total files checked: ${files_to_process.length}`);
   console.info(`files modified:      ${modified_count}`);
}

await main();