/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder/src/build_orchestrator.ts
 */

import { $ } from 'bun';

import { default as path } from 'node:path';
import { default as fs } from 'node:fs/promises';
import { watch as fs_watch, type FSWatcher } from 'node:fs';

import type { Plugin } from 'esbuild';
import * as swc from '@swc/core';

import { ImportVisitor } from '@eldritch-engine/builder-core-tddi/swc/import_visitor';
import { map_dist_to_src } from '@eldritch-engine/builder-core-tddi/utils';

// quite possibly the worst fix ever, but it works
export const workspace_alias_resolver_plugin = (
   package_paths_map: Map<string, string>
): Plugin => ({
   name: 'eldritch-workspace-alias-resolver',
   setup(build) {
      const workspace_alias_regex = /^(@eldritch-engine\/.*)/;

      build.onResolve(
         { filter: workspace_alias_regex },
         (args) => {
            const package_path_str = args.path;
            const pkg_match = package_path_str.match(/^(@[^\/]+\/[^\/]+)(.*)/);

            if (!pkg_match) {
               return;
            }

            const package_name = pkg_match[1];
            const module_subpath = pkg_match[2] ?? '';

            if (!package_paths_map.has(package_name!)) {
               // not a workspace package we manage, let the default resolver handle it
               return;
            }

            const package_root = package_paths_map.get(package_name!)!;
            const resolved_path_no_ext = path.resolve(package_root, 'src', module_subpath.substring(1));

            return {
               path: resolved_path_no_ext + '.ts'
            };
         }
      );
   }
});

export function resolve_path_for_string_replacement(
   source_path: string,
   current_file_path: string,
   package_root_path: string
): string {
   const import_subpath = source_path.replace(/^@self\//, '');

   const current_file_dest_path = current_file_path.replace(
      path.join(package_root_path, 'src'),
      path.join(package_root_path, 'dist')
   );

   const target_file_dest_path = path.resolve(
      package_root_path,
      'dist',
      import_subpath
   );

   let relative_path = path.relative(
      path.dirname(current_file_dest_path),
      target_file_dest_path
   );

   if (!relative_path.startsWith('.')) {
      relative_path = './' + relative_path;
   }

   return relative_path;
}

async function directory_contains_files(
   dir: string
): Promise<boolean> {
   try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
         const full_path = path.join(dir, entry.name);

         if (entry.isFile()) {
            return true;
         }

         if (entry.isDirectory()) {
            if (await directory_contains_files(full_path)) {
               return true;
            }
         }
      }

      return false;
   } catch (e) {
      if (e.code === 'ENOENT') {
         return false;
      }

      throw e;
   }
}

export async function execute_package_build_commands(
   package_relative_path: string,
   project_root_path: string,
   log_prefix: string = ''
): Promise<void> {
   const full_package_path = path.resolve(project_root_path, package_relative_path);
   const package_name_from_path = path.basename(package_relative_path);
   const custom_build_script_path = path.join(full_package_path, 'build.ts');

   // check for placeholder packages
   const src_dir = path.join(full_package_path, 'src');

   try {
      const src_entries = await fs.readdir(src_dir, { withFileTypes: true });
      const user_entries = src_entries.filter(e => e.name !== '__generated__');

      if (user_entries.length === 0) {
         console.info(`[${log_prefix}${package_name_from_path}] skipping build: 'src' directory is empty or only contains '__generated__'`);

         return;
      }

      const has_files = await directory_contains_files(src_dir);

      if (!has_files) {
         console.info(`[${log_prefix}${package_name_from_path}] skipping build: 'src' directory contains no files`);

         return;
      }
   } catch (e) {
      if (e.code === 'ENOENT') {
         console.info(`[${log_prefix}${package_name_from_path}] skipping build: 'src' directory not found`);

         return;
      }

      throw e;
   }

   console.info(`\n--- ${log_prefix}building package: ${package_name_from_path} ---`);

   try {
      const custom_build_script_exists = await Bun.file(custom_build_script_path).exists();

      if (custom_build_script_exists) {
         console.info(`[${log_prefix}${package_name_from_path}] found 'build.ts', running custom build script...`);

         const original_cwd = process.cwd();

         try {
            process.chdir(full_package_path);

            await $`bun build.ts`;
         } finally {
            process.chdir(original_cwd);
         }
      } else {
         const dist_dir = path.join(full_package_path, 'dist');

         await fs.rm(dist_dir, { recursive: true, force: true });
         await fs.mkdir(dist_dir, { recursive: true });

         const glob = new Bun.Glob('**/*');

         for await (const file of glob.scan({
            cwd: src_dir,
            absolute: true
         })) {
            const relative_path = path.relative(src_dir, file);
            const dest_path = path.join(dist_dir, relative_path);

            await fs.mkdir(path.dirname(dest_path), { recursive: true });

            if (file.endsWith('.ts')) {
               let content = await Bun.file(file).text();

               const static_import_export_regex = /(from\s+)(['"])@self\/([^'"]+)\2/g;

               content = content.replace(
                  static_import_export_regex,
                  (
                     match,
                     prefix,
                     quote,
                     module_path
                  ) => {
                     const source_path = `@self/${module_path}`;
                     const new_relative_path = resolve_path_for_string_replacement(source_path, file, full_package_path);

                     const output = `${prefix}${quote}${new_relative_path}${quote}`;

                     console.debug(`'${static_import_export_regex}', '${source_path}', '${output}'`);

                     return output;
                  }
               );

               const dynamic_import_regex = /(import\(\s*)(['"])@self\/([^'"]+)\2/g;

               content = content.replace(
                  dynamic_import_regex,
                  (
                     match,
                     prefix,
                     quote,
                     module_path
                  ) => {
                     const source_path = `@self/${module_path}`;
                     const new_relative_path = resolve_path_for_string_replacement(source_path, file, full_package_path);

                     const output = `${prefix}${quote}${new_relative_path}${quote}`;

                     console.debug(`'${dynamic_import_regex}', '${source_path}', '${output}'`);

                     return output;
                  }
               );

               await Bun.write(dest_path, content);
            } else {
               await Bun.write(dest_path, Bun.file(file));
            }
         }
      }

      console.info(`[${log_prefix}${package_name_from_path}] build successful`);
   } catch (e) {
      console.error(`\n!!!!!!!! ${log_prefix}ERROR: build failed for package: ${package_name_from_path} !!!!!!!!`);

      throw e;
   }
}

export const DEBOUNCE_DELAY_MS = 15;

export interface RunOrderedBuildsOptions {
   watch?: boolean;
   orchestrator_name?: string;
   skip_initial_build_on_watch?: boolean;
}

export let package_path_to_name_map: Map<string, string> = new Map();

export async function populate_package_path_to_name_map(
   package_compilation_order: string[],
   project_root_path: string,
   orchestrator_name: string
): Promise<void> {
   package_path_to_name_map.clear();

   const package_json_promises = package_compilation_order.map(async (pkg_path) => {
      const full_pkg_json_path = path.resolve(project_root_path, pkg_path, 'package.json');
      try {
         const content = await fs.readFile(full_pkg_json_path, 'utf-8');
         const data = JSON.parse(content);

         if (
            data.name
            && typeof data.name === 'string'
         ) {
            return {
               path: pkg_path,
               name: data.name,
            };
         }
      } catch (e) {
         console.warn(`[${orchestrator_name}] warning: could not read/parse package.json for ${pkg_path}: ${e.message}`);
      }

      return null;
   });

   const package_jsons_data_raw = await Promise.all(package_json_promises);
   const package_jsons_data = package_jsons_data_raw.filter(p => p != null)!;

   for (const { path: pkg_path, name } of package_jsons_data) {
      package_path_to_name_map.set(pkg_path, name);
   }
}

export async function find_workspace_packages(
   project_root: string,
   search_dir_relative: string = 'src'
): Promise<string[]> {
   const packages: string[] = [];
   const search_root_absolute = path.resolve(project_root, search_dir_relative);

   async function search(current_dir: string) {
      try {
         const entries = await fs.readdir(current_dir, { withFileTypes: true });

         if (entries.some((e) => {
            return e.isFile()
               && e.name === 'package.json';
         })) {
            packages.push(path.relative(project_root, current_dir));

            return;
         }

         const sub_dir_promises = entries
            .filter((e) => {
               return e.isDirectory()
                  && e.name !== 'node_modules'
                  && !e.name.startsWith('.')
            })
            .map(dir_entry => search(path.join(current_dir, dir_entry.name)));

         await Promise.all(sub_dir_promises);
      } catch (err) {
         if (err.code !== 'ENOENT') {
            console.warn(`[find_workspace_packages] could not search directory ${current_dir}: ${err.message}`);
         }
      }
   }

   await search(search_root_absolute);

   return packages;
}

export async function get_workspace_dependency_graph(
   project_root: string,
   package_paths: string[]
): Promise<
   Map<
      string,
      {
         name: string;
         dependencies: Record<string, string>
      }
   >
> {
   const dependency_graph = new Map<
      string,
      {
         name: string;
         dependencies: Record<string, string>
      }
   >();

   for (const pkg_path of package_paths) {
      try {
         const full_pkg_path = path.resolve(project_root, pkg_path);
         const pkg_json_path = path.join(full_pkg_path, 'package.json');
         const pkg_json_content = await fs.readFile(pkg_json_path, 'utf-8');
         const pkg_json = JSON.parse(pkg_json_content);

         if (pkg_json.name) {
            dependency_graph.set(
               pkg_json.name,
               {
                  name: pkg_json.name,
                  dependencies: {
                     ...pkg_json.dependencies,
                     ...pkg_json.devDependencies,
                     ...pkg_json.peerDependencies,
                  },
               }
            );
         }
      } catch (e) {
         // ignore
      }
   }

   return dependency_graph;
}

export type GuerreroStrategy = 'aos' | 'soa' | 'native';

export function determine_guerrero_strategies(
   pkg_json_content: any
): GuerreroStrategy[] {
   const strategies = pkg_json_content.guerrero_strategies;

   if (strategies === 'all') {
      return ['aos', 'soa', 'native'];
   }

   if (Array.isArray(strategies)) {
      return strategies as GuerreroStrategy[];
   }

   if (typeof strategies === 'string') {
      return [strategies as GuerreroStrategy];
   }

   return ['native'];
}

export async function get_package_paths_map(
   project_root: string,
   package_paths: string[]
): Promise<Map<string, string>> {
   const map = new Map<string, string>();

   for (const pkg_path of package_paths) {
      try {
         const full_pkg_path = path.resolve(project_root, pkg_path);
         const pkg_json_path = path.join(full_pkg_path, 'package.json');
         const pkg_json_content = await fs.readFile(pkg_json_path, 'utf-8');
         const pkg_json = JSON.parse(pkg_json_content);

         if (pkg_json.name) {
            map.set(pkg_json.name, full_pkg_path);
         }
      } catch (e) {
         // ignore
      }
   }

   return map;
}

export function get_transitive_dependency_paths(
   start_package_name: string,
   dep_graph: Map<
      string,
      {
         name: string;
         dependencies: Record<string, string>
      }
   >,
   package_paths_map: Map<string, string>
): string[] {
   const resolved_paths = new Set<string>();
   const queue = [start_package_name];
   const visited = new Set<string>([start_package_name]);

   while (queue.length > 0) {
      const current_pkg_name = queue.shift()!;
      const pkg_path = package_paths_map.get(current_pkg_name);

      if (pkg_path) {
         resolved_paths.add(path.join(pkg_path, 'src'));
      }

      const dep_info = dep_graph.get(current_pkg_name);

      if (dep_info?.dependencies) {
         for (const dep_name in dep_info.dependencies) {
            if (
               !visited.has(dep_name) &&
               dep_graph.has(dep_name)
            ) {
               visited.add(dep_name);
               queue.push(dep_name);
            }
         }
      }
   }

   return [...resolved_paths];
}

export async function discover_file_dependencies(
   entry_points: string[],
   project_root: string
): Promise<string[]> {
   const resolved_files = new Set<string>();
   const queue = [...entry_points.map(p => path.resolve(p))];
   const visited = new Set<string>(queue);

   const SWC_PARSER_OPTIONS: swc.ParseOptions = {
      syntax: 'typescript',
      tsx: false,
      decorators: true,
      dynamicImport: true,
   };

   while (queue.length > 0) {
      const current_file = queue.shift()!;
      resolved_files.add(current_file);

      const content = await fs.readFile(current_file, 'utf-8');
      const ast = await swc.parse(content, SWC_PARSER_OPTIONS);

      const import_visitor = new ImportVisitor();
      import_visitor.visitModule(ast);

      for (const imp of import_visitor.imports) {
         try {
            const resolved = await Bun.resolve(imp.source_path, path.dirname(current_file));
            const source_path = map_dist_to_src(resolved);

            if (
               !visited.has(source_path)
               && source_path.startsWith(project_root)
               && !source_path.includes('node_modules')
            ) {
               if (await Bun.file(source_path).exists()) {
                  visited.add(source_path);
                  queue.push(source_path);
               }
            }
         } catch (e) {
            // ignore unresolved modules like bun:test, node built-ins, etc.
         }
      }
   }
   return [...resolved_files];
}

let rebuild_debounce_timer: NodeJS.Timeout | null = null;
let is_rebuilding = false;

const watchers: FSWatcher[] = [];

export async function run_build_orchestrator(
   project_root_path: string,
   options: RunOrderedBuildsOptions
): Promise<void> {
   const orchestrator_name = options?.orchestrator_name ?? 'build';
   const watch_mode = options?.watch ?? false;

   const skip_initial_build = watch_mode
      && (options?.skip_initial_build_on_watch ?? false);

   let package_compilation_order: string[] = [];
   let dependency_graph: Map<string, { name: string; dependencies: Record<string, string>; }> | undefined;
   let reverse_dependency_graph: Map<string, string[]> = new Map();
   let package_name_to_path_map: Map<string, string> = new Map();

   const build_packages = async (
      package_paths_to_build: Set<string>
   ): Promise<void> => {
      const ordered_subset_to_build = package_compilation_order.filter(p => package_paths_to_build.has(p));
      let failed_packages_count = 0;

      const log_prefix = `[${orchestrator_name}] `;

      for (const pkg_path of ordered_subset_to_build) {
         try {
            await execute_package_build_commands(pkg_path, project_root_path, log_prefix);
         } catch (e) {
            failed_packages_count++;
         }
      }

      console.info(`\n--- ${orchestrator_name} incremental build summary ---`);

      if (failed_packages_count === 0) {
         console.info(`${ordered_subset_to_build.length} package(s) compiled successfully`);
      } else {
         const error_message = `${failed_packages_count} package(s) failed to compile`;

         console.error(error_message);

         if (!watch_mode) {
            throw new Error(error_message);
         }
      }
   };

   const build_logic = async () => {
      console.info(`\n[${orchestrator_name}] starting full build...`);

      package_compilation_order = await find_workspace_packages(project_root_path, 'src');
      package_compilation_order.sort((a, b) => a.localeCompare(b));

      console.info(`[${orchestrator_name}] found ${package_compilation_order.length} packages to build`);

      for (const pkg of package_compilation_order) {
         console.log(`  - ${pkg}`);
      }

      if (package_compilation_order.length === 0) {
         console.error(`[${orchestrator_name}] no packages found. build cannot continue`);

         process.exit(1);
      }

      await populate_package_path_to_name_map(package_compilation_order, project_root_path, orchestrator_name);

      await build_packages(new Set(package_compilation_order));
   };

   if (!skip_initial_build) {
      await build_logic();
   }

   if (watch_mode) {
      console.info(`\n[${orchestrator_name}] starting watch mode...`);

      const all_package_paths = await find_workspace_packages(project_root_path, 'src');

      dependency_graph = await get_workspace_dependency_graph(project_root_path, all_package_paths);
      package_name_to_path_map = new Map([...package_path_to_name_map.entries()].map(([k, v]) => [v, k]));

      reverse_dependency_graph.clear();

      for (const [pkg_name, pkg_info] of dependency_graph.entries()) {
         for (const dep_name in pkg_info.dependencies) {
            if (dependency_graph.has(dep_name)) {
               if (!reverse_dependency_graph.has(dep_name)) {
                  reverse_dependency_graph.set(dep_name, []);
               }

               reverse_dependency_graph.get(dep_name)!.push(pkg_name);
            }
         }
      }

      let packages_changed = new Set<string>();
      let full_rebuild_needed = false;

      const debounced_rebuild = async () => {
         if (is_rebuilding) {
            return;
         }

         is_rebuilding = true;

         try {
            if (full_rebuild_needed) {
               console.info(`\n[${orchestrator_name} watch] structural change detected, starting full rebuild...`);

               await build_logic();
            } else if (packages_changed.size > 0) {
               console.info(`\n[${orchestrator_name} watch] change detected, starting incremental rebuild...`);

               const packages_to_rebuild = new Set<string>();
               const queue = [...packages_changed];
               const visited = new Set<string>(queue);

               while (queue.length > 0) {
                  const pkg_path = queue.shift()!;
                  const pkg_name = package_path_to_name_map.get(pkg_path);

                  packages_to_rebuild.add(pkg_path);

                  if (pkg_name) {
                     const dependents = reverse_dependency_graph.get(pkg_name) || [];

                     for (const dependent_name of dependents) {
                        const dependent_path = package_name_to_path_map.get(dependent_name);

                        if (dependent_path && !visited.has(dependent_path)) {
                           visited.add(dependent_path);
                           queue.push(dependent_path);
                        }
                     }
                  }
               }
               await build_packages(packages_to_rebuild);
            }
         } catch (e) {
            // error is already logged
         } finally {
            packages_changed.clear();
            full_rebuild_needed = false;
            is_rebuilding = false;

            console.info(`[${orchestrator_name} watch] rebuild cycle finished. watching for changes...`);
         }
      };

      const trigger_rebuild = () => {
         if (rebuild_debounce_timer) {
            clearTimeout(rebuild_debounce_timer);
         }

         rebuild_debounce_timer = setTimeout(debounced_rebuild, DEBOUNCE_DELAY_MS);
      };

      for (const pkg_path of all_package_paths) {
         const src_dir_to_watch = path.resolve(project_root_path, pkg_path, 'src');

         try {
            await fs.access(src_dir_to_watch);

            const watcher = fs_watch(
               src_dir_to_watch,
               {
                  recursive: true
               },
               (
                  event_type,
                  filename
               ) => {
                  if (
                     filename
                     && !filename.includes('__generated__')
                  ) {
                     if (event_type === 'rename') {
                        full_rebuild_needed = true;
                     }

                     packages_changed.add(pkg_path);
                     trigger_rebuild();
                  }
               }
            );

            watcher.on('error', (e) => console.error(`[${orchestrator_name} watch] error watching ${src_dir_to_watch}:`, e));

            watchers.push(watcher);
         } catch (e) {
            // ignore
         }
      }

      console.info(`[${orchestrator_name}] watching ${watchers.length} package source directories...`);

      if (skip_initial_build) {
         console.info('[build script] --skip-initial-build provided. watching for changes...');
      }

      process.on('SIGINT', () => {
         console.info(`\n[${orchestrator_name}] watch mode interrupted. closing watchers...`);

         for (const watcher of watchers) {
            watcher.close();
         }

         if (rebuild_debounce_timer) {
            clearTimeout(rebuild_debounce_timer);
         }

         console.info(`[${orchestrator_name}] watchers closed. exiting.`);

         process.exit(0);
      });
   }
}