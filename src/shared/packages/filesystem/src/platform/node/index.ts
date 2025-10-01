/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/filesystem/src/platform/node/index.ts
 */

import { default as path } from 'node:path';
import { default as fs } from 'node:fs/promises';

import type { FileSystem, Stat } from '@self/types/filesystem';

/** node filesystem implementation */
export class NodeFileSystem implements FileSystem {
   #base_dir: string;

   constructor(
      base_dir?: string
   ) {
      this.#base_dir = base_dir ? path.resolve(base_dir) : path.resolve(process.cwd(), 'assets');
   }

   async readdir(
      path: string
   ): Promise<string[]> {
      return await fs.readdir(this.#resolve_path(path));
   }

   async rmdir(
      path: string
   ): Promise<boolean> {
      await fs.rmdir(this.#resolve_path(path));

      return true;
   }

   async mkdir(
      path: string,
      options?: {
         recursive?: boolean;
      }
   ): Promise<boolean> {
      await fs.mkdir(this.#resolve_path(path), options);

      return true;
   }

   async write(
      file_path: string,
      buffer: Uint8Array
   ): Promise<boolean> {
      await fs.writeFile(this.#resolve_path(file_path), buffer);

      return true;
   }

   async read(
      path: string
   ): Promise<Buffer> {
      return await fs.readFile(this.#resolve_path(path));
   }

   async rename(
      old_path: string,
      new_path: string
   ): Promise<boolean> {
      await fs.rename(this.#resolve_path(old_path), this.#resolve_path(new_path));

      return true;
   }

   async chmod(
      path: string,
      mode: string | number
   ): Promise<boolean> {
      await fs.chmod(this.#resolve_path(path), mode);

      return true;
   }

   async exists(
      path: string
   ): Promise<boolean> {
      try {
         await fs.access(this.#resolve_path(path));

         return true;
      } catch (e) {
         return false;
      }
   }

   async stat(
      path: string
   ): Promise<Stat> {
      const stats = await fs.stat(path);

      return {
         size: stats.size,
         mode: stats.mode,
         modify_time: stats.mtimeMs,
         change_time: stats.ctimeMs,
         create_time: stats.birthtimeMs
      };
   }

   #resolve_path(
      file_path: string
   ): string {
      const resolved = path.resolve(`${this.#base_dir}/${file_path}`);

      if (!resolved.startsWith(this.#base_dir)) {
         throw new Error('access outside base directory is forbidden');
      }

      return resolved;
   }
}
