/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/scripts/add_license_headers.ts
 */

// this file assumes that you will make license headers start with `/*!`. if you don't, then oh well i guess, it's a standard i'm pretty sure

import { Glob } from 'bun';

import { promises as fs } from 'node:fs';
import path from 'node:path';

function generate_license_header(relative_path_posix: string): string {
   return `\
/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/${relative_path_posix}
 */`;
}

const HEADER_SIGNATURE = '/*!\n * Copyright (c) 2025-present, eldritch engine contributors';

const LOG_UNCHANGED_FILES = false;
const SCAN_DIRECTORY = 'src/';

async function process_file(
   file_path: string,
   project_root: string
): Promise<{
   status: 'added' | 'replaced' | 'unchanged';
}> {
   const relative_path = path.relative(project_root, file_path);
   const relative_path_posix = relative_path.replace(/\\/g, '/');
   const new_header = generate_license_header(relative_path_posix);

   try {
      const original_content = await fs.readFile(file_path, 'utf-8');

      if (original_content.trimStart().startsWith(HEADER_SIGNATURE)) {
         const end_of_header_index = original_content.indexOf('*/');

         if (end_of_header_index === -1) {
            console.warn(`[WARNING]   malformed header in ${relative_path}. skipping file`);

            return {
               status: 'unchanged'
            };
         }

         const existing_header = original_content.substring(0, end_of_header_index + 2);

         if (existing_header === new_header) {
            if (LOG_UNCHANGED_FILES) {
               console.info(`[UNCHANGED] ${relative_path}`);
            }

            return {
               status: 'unchanged'
            };
         }

         const code_after_header = original_content.slice(end_of_header_index + 2);

         await fs.writeFile(file_path, `${new_header}\n\n${code_after_header.trimStart()}`, 'utf-8');

         console.info(`[REPLACED]  ${relative_path}`);

         return {
            status: 'replaced'
         };
      }

      await fs.writeFile(file_path, `${new_header}\n\n${original_content}`, 'utf-8');

      console.info(`[ADDED]     ${relative_path}`);

      return {
         status: 'added'
      };
   } catch (error) {
      console.error(`[ERROR]     failed to process ${relative_path}:`, error);

      throw error;
   }
}

async function main() {
   const project_root = process.cwd();
   const glob_pattern = `${SCAN_DIRECTORY}/**/*.ts`;
   const exclude_patterns = ['**/node_modules/**', '**/dist/**', '**/tests-dist/**', '**/__generated__/**'];

   const glob = new Glob(glob_pattern);
   const exclude_globs = exclude_patterns.map((pattern) => new Glob(pattern));

   const all_files = await Array.fromAsync(glob.scan({ cwd: project_root, absolute: true }));

   const files_to_process = all_files.filter(
      (file_path) => {
         return !exclude_globs.some((exclude_glob) => exclude_glob.match(file_path));
      }
   );

   if (files_to_process.length === 0) {
      console.info(`no files found in '${SCAN_DIRECTORY}'`);

      return;
   }

   console.info(`found ${files_to_process.length} files to process`);

   let added_count = 0;
   let replaced_count = 0;
   let unchanged_count = 0;

   for (const file_path of files_to_process) {
      const result = await process_file(file_path, project_root);

      switch (result.status) {
         case 'added': {
            added_count++;

            break;
         }

         case 'replaced': {
            replaced_count++;

            break;
         }

         case 'unchanged': {
            unchanged_count++;

            break;
         }
      }
   }

   console.info('\n');
   console.info(`total files processed: ${files_to_process.length}`);
   console.info(`headers added:         ${added_count}`);
   console.info(`headers replaced:      ${replaced_count}`);
   console.info(`files unchanged:       ${unchanged_count}`);
}

await main();