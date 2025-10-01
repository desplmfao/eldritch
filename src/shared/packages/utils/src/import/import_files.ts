/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/import/import_files.ts
 */

/// #if PLATFORM_SUPPORT === 'bun'
import { default as fs } from 'node:fs/promises';
import { default as path } from 'node:path';
/// #endif

import type { MaybePromise, ObjK } from '@eldritch-engine/type-utils';

export const SUPPORTED_FILE_EXT_IMPORT_NODE = [
   '.js',
   '.cjs',
   '.mjs',
   '.json',
   '.wasm',
   '.node'
] as const;

export const SUPPORTED_FILE_EXT_IMPORT_BUN = [
   '.mts',
   '.cts',
   '.ts',
   '.tsx',
   '.jsx',
   '.toml',
   '.txt'
] as const;

const SUPPORTED_FILE_EXT_IMPORT_EVERY = [
   ...SUPPORTED_FILE_EXT_IMPORT_BUN,
   ...SUPPORTED_FILE_EXT_IMPORT_NODE
] as const;

export type CallbackHandlersOut =
   | {
      [name: ObjK]: unknown;
   }
   | Buffer;

/**
 * recursively import modules from a directory and invoke a callback for each module
 *
 * @returns a Promise that resolves when all modules are imported
 */
export async function import_files(options: {
   dir_path: string;
   ends_with: string;
   callback: (module_path: string, handlers: CallbackHandlersOut) => MaybePromise<unknown>;
}): Promise<unknown[]> {
   const files = await fs.readdir(options.dir_path);
   const tasks: unknown[] = [];

   for await (const file of files) {
      const file_path = path.join(options.dir_path, file);
      const file_stat = await fs.stat(file_path);

      const module_path = path.resolve(file_path);
      const ends_with = `.${file.split('.').pop()}`;

      if (file_stat.isDirectory()) {
         await import_files({
            ...options,
            dir_path: file_path
         });

         continue;
      }

      if (ends_with === options.ends_with) {
         const task = (
            process.versions.bun
               ? SUPPORTED_FILE_EXT_IMPORT_EVERY.indexOf(options.ends_with as '.js') > -1
               : SUPPORTED_FILE_EXT_IMPORT_NODE.indexOf(options.ends_with as '.js') > -1
         )
            ? await options.callback(module_path, await import(`file://${module_path}`))
            : await options.callback(module_path, await fs.readFile(module_path));

         tasks.push(task);
      }
   }

   return await Promise.all(tasks);
}
