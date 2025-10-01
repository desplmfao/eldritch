/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/misc.ts
 */

import { default as path } from 'node:path';
import { default as fs } from 'node:fs/promises';
import { constants as fs_constants } from 'node:fs';

import { default_logger } from '@eldritch-engine/logger/logger';

export async function find_git_root(start_dir: string): Promise<string | undefined> {
   let current_dir: string = path.resolve(start_dir);

   while (true) {
      const git_path: string = path.join(current_dir, '.git');

      try {
         await fs.access(git_path, fs_constants.F_OK);

         return current_dir;
      } catch (e) {
         if (e.code !== 'ENOENT') {
            throw e;
         }

         // skip
      }

      const parent_dir: string = path.dirname(current_dir);

      if (parent_dir === current_dir) {
         return;
      }

      current_dir = parent_dir;
   }
}

async function find_submodule_roots(
   project_root: string
): Promise<string[]> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const gitmodules_path = path.join(project_root, '.gitmodules');
   const submodule_roots: string[] = [];

   try {
      const content = await fs.readFile(gitmodules_path, 'utf-8');
      const path_regex = /^\s*path\s*=\s*(.*)$/gm;
      let match: RegExpExecArray | null;

      while ((match = path_regex.exec(content)) != null) {
         if (match[1]) {
            const submodule_dir = path.join(project_root, match[1].trim());

            try {
               await fs.access(submodule_dir);

               submodule_roots.push(submodule_dir);
            } catch (e) {
               logger.warn(`found submodule path '${match[1].trim()}' in .gitmodules but directory does not exist at '${submodule_dir}'`);
            }
         }
      }
   } catch (e) {
      /* ignore if .gitmodules doesn't exist */
   }

   return submodule_roots;
}

export async function find_all_source_roots(
   project_root: string,
   project_pkg_json?: any
): Promise<string[]> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const source_roots = new Set<string>();

   source_roots.add(path.join(project_root, 'src'));

   // check for explicit engine path in package.json first
   if (project_pkg_json?.engine_path) {
      const engine_path = path.resolve(project_root, project_pkg_json.engine_path);

      try {
         await fs.access(engine_path);
         logger.trace(`found engine root via 'engine_path' in package.json: ${engine_path}`);

         source_roots.add(path.join(engine_path, 'src'));

         return Array.from(source_roots);
      } catch (e) {
         logger.warn(`'engine_path' in package.json points to a non-existent directory: '${engine_path}'`);
      }
   }

   // git submodules
   const submodule_roots = await find_submodule_roots(project_root);

   if (submodule_roots.length > 0) {
      logger.trace(`found engine and dependency roots via git submodules:`, submodule_roots);

      for (const root of submodule_roots) {
         source_roots.add(path.join(root, 'src'));
      }
   }

   // sibling directory
   try {
      const sibling_path = path.join(path.dirname(project_root), 'engine');
      await fs.access(sibling_path);

      logger.trace(`found engine root as sibling directory: ${sibling_path}`);

      source_roots.add(path.join(sibling_path, 'src'));
   } catch (e) {
      /* ignore */
   }

   // current directory is the engine monorepo
   try {
      const pkg_json_path = path.join(project_root, 'package.json');
      const content = await fs.readFile(pkg_json_path, 'utf-8');
      const pkg = JSON.parse(content);

      if (pkg.name === 'eldritch-monorepo') {
         logger.trace(`assuming current project root is the engine monorepo: ${project_root}`);

         source_roots.add(path.join(project_root, 'src'));
      }
   } catch (e) {
      /* ignore */
   }

   return Array.from(source_roots);
}


const package_root_cache = new Map<string, { package_root: string; package_name: string } | null>();

export async function find_package_root_and_name(
   start_dir: string
): Promise<{
   package_root: string;
   package_name: string
} | null> {
   const resolved_start_dir = path.resolve(start_dir);

   if (package_root_cache.has(resolved_start_dir)) {
      return package_root_cache.get(resolved_start_dir) ?? null;
   }

   let current_dir: string = resolved_start_dir;

   while (true) {
      const package_json_path: string = path.join(current_dir, 'package.json');

      try {
         await fs.access(package_json_path, fs_constants.R_OK);

         try {
            const content = await fs.readFile(package_json_path, 'utf-8');
            const data = JSON.parse(content);

            if (data && typeof data.name === 'string') {
               const result = {
                  package_root: current_dir,
                  package_name: data.name
               };

               package_root_cache.set(resolved_start_dir, result);
               package_root_cache.set(current_dir, result);

               return result;
            } else {
               console.warn(`found package.json at ${current_dir} but it's missing a 'name' field.`);
            }
         } catch (parse_or_read_error: any) {
            console.warn(`error reading/parsing package.json at ${current_dir}: ${parse_or_read_error.message}`);
         }

      } catch (access_error: any) {
         if (access_error.code !== 'ENOENT') {
            console.warn(`error accessing ${package_json_path}: ${access_error.message}`);
         }
      }

      const parent_dir: string = path.dirname(current_dir);

      if (parent_dir === current_dir) {
         package_root_cache.set(resolved_start_dir, null);

         return null;
      }

      current_dir = parent_dir;
   }
}

export async function find_source_files_recursive(
   dir: string,
   extensions: string[],
   exclude: (string | RegExp)[] = [
      'node_modules',
      /.*-dist$/, // does not include dist or *-dist
      /^\./ // does not start with a dot
   ]
): Promise<string[]> {
   const files: string[] = [];

   try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
         const full_path = path.join(dir, entry.name);

         if (entry.isDirectory()) {
            const is_excluded = exclude.some(
               (rule) => {
                  if (typeof rule === 'string') {
                     return entry.name === rule;
                  }

                  return rule.test(entry.name);
               }
            );

            if (!is_excluded) {
               files.push(...await find_source_files_recursive(full_path, extensions, exclude));
            }
         } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
            files.push(full_path);
         }
      }
   } catch (e: any) {
      if (e.code !== 'ENOENT') {
         console.warn(`could not read directory ${dir}: ${e.message}`);
      }
   }

   return files;
}