/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder/src/compile_tests.ts
 */

import { default as path } from 'node:path';
import { default as fs } from 'node:fs/promises';

import { build, type BuildOptions, type Plugin } from 'esbuild';

import type { ICodegenStrategy } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { IBuildTimeRegistry } from '@eldritch-engine/type-utils/builder/registry';

import { eldritch_builder_unplugin } from '@eldritch-engine/builder-unplugin/index';

import { CodegenStrategyAOS } from '@eldritch-engine/guerrero-core-strategy-aos/codegen/factory';
import { CodegenStrategyNative } from '@eldritch-engine/guerrero-core-strategy-native/codegen/factory';

import { find_git_root, find_package_root_and_name, find_source_files_recursive } from '@eldritch-engine/utils/misc';

import { base_config as project_base_build_config } from '@self/index';

import {
   find_workspace_packages,
   determine_guerrero_strategies,
   get_package_paths_map,
   workspace_alias_resolver_plugin,
   discover_file_dependencies
} from '@self/build_orchestrator';

// i dupe this shit a lot but it works
export const self_alias_resolver_plugin = (
   find_pkg: typeof find_package_root_and_name
): Plugin => ({
   name: 'eldritch-self-alias-resolver',
   setup(build) {
      const self_alias_regex = /^@self\/(.*)/;

      build.onResolve(
         { filter: self_alias_regex },
         async (args) => {
            if (!args.importer) {
               return;
            }

            const package_info = await find_pkg(path.dirname(args.importer));

            if (!package_info) {
               return {
                  errors: [
                     {
                        text: `could not find package.json root for importer: ${args.importer}`
                     }
                  ],
               };
            }

            const import_name = (args.path.match(self_alias_regex) ?? [])[1];

            if (!import_name) {
               return;
            }

            const resolved_path = path.resolve(
               package_info.package_root,
               'src',
               `${import_name}.ts`
            );

            return {
               path: resolved_path
            };
         }
      );
   },
});

export function parse_target_packages(): Set<string> | null {
   const args = process.argv.slice(2);
   const config_index = args.indexOf('-c');

   if (
      config_index === -1
      || config_index + 1 >= args.length
   ) {
      return null;
   }

   const packages_string = args[config_index + 1];

   if (
      !packages_string
      || packages_string.startsWith('-')
   ) {
      console.warn(`warning: '-c' flag was provided but no package names followed. compiling all tests`);

      return null;
   }

   return new Set(packages_string.split(',').map(p => p.trim()));
}

export interface TestFile {
   path: string;
   action: 'compile' | 'copy';
}

export async function find_test_files(
   start_dir: string
): Promise<TestFile[]> {
   const entries = await fs.readdir(start_dir, { withFileTypes: true });
   const files: TestFile[] = [];

   for (const entry of entries) {
      const full_path = path.join(start_dir, entry.name);

      if (entry.isDirectory()) {
         if (
            entry.name === 'node_modules'
            || entry.name === 'dist'
            || entry.name === 'tests-dist'
            || entry.name.startsWith('.')
         ) {
            continue;
         }

         files.push(...await find_test_files(full_path));
      } else if (
         entry.isFile()
         && full_path.includes(path.sep + 'tests' + path.sep)
         && full_path.endsWith('.test.ts')
      ) {
         const content = await fs.readFile(full_path, 'utf-8');

         const content_without_header = content.replace(/\/\*![\s\S]*?\*\//, '');
         const pragma_regex = /^\s*\/\/\s*@eldritch-build-ignore/m;

         if (pragma_regex.test(content_without_header)) {
            console.log(`found ignore pragma, will copy: ${path.relative(process.cwd(), full_path)}`);

            files.push({
               path: full_path,
               action: 'copy'
            });
         } else {
            files.push({
               path: full_path,
               action: 'compile'
            });
         }
      }
   }

   return files;
}

function get_output_paths_for_test_file(
   test_file_path: string,
   project_root: string,
   out_dir_suffix: string = ''
): {
   out_dir_path: string;
   out_file_base_js: string;
   out_file_base_ts: string;
} {
   const tests_dir_token = path.join(path.sep, 'tests');
   const tests_dist_dir_token = path.join(path.sep, 'tests-dist');
   const tests_dir_index = test_file_path.lastIndexOf(tests_dir_token);

   if (tests_dir_index === -1) {
      throw new Error(`could not find a 'tests' directory in the path: ${test_file_path}`);
   }

   const package_part = test_file_path.substring(0, tests_dir_index);
   const path_within_tests = test_file_path.substring(tests_dir_index + tests_dir_token.length);

   const out_dir_root = path.join(package_part, tests_dist_dir_token);
   const out_dir_with_suffix = path.join(out_dir_root, out_dir_suffix);
   const out_dir_path = path.join(out_dir_with_suffix, path.dirname(path_within_tests));

   const out_file_base_ts = path.basename(test_file_path);
   const out_file_base_js = path.basename(test_file_path, '.test.ts') + '.test.js';

   return {
      out_dir_path,
      out_file_base_js,
      out_file_base_ts
   };
}

async function copy_test_file(
   test_file_path: string,
   project_root: string,
   out_dir_suffix: string = ''
): Promise<void> {
   const { out_dir_path, out_file_base_ts } = get_output_paths_for_test_file(
      test_file_path,
      project_root,
      out_dir_suffix
   );

   const out_file_full_path = path.join(out_dir_path, out_file_base_ts);
   const relative_test_file_path = path.relative(project_root, test_file_path);

   try {
      await fs.mkdir(out_dir_path, { recursive: true });
      await fs.copyFile(test_file_path, out_file_full_path);

      console.log(`copied test: ${relative_test_file_path} -> ${path.relative(project_root, out_file_full_path)}`);
   } catch (error) {
      console.error(`failed to copy test ${relative_test_file_path}:`, error);

      throw error;
   }
}

export async function compile_single_file_for_test(
   test_file_path: string,
   out_file_full_path: string,
   project_root: string,
   base_esbuild_config: BuildOptions,
   guerrero_strategy: 'aos' | 'soa' | 'native',
   extra_analysis_files?: string[]
): Promise<{
   strategy?: ICodegenStrategy;
   registry: IBuildTimeRegistry;
}> {
   const package_info = await find_package_root_and_name(path.dirname(test_file_path));

   if (!package_info) {
      throw new Error(`could not find package.json for test: ${test_file_path}`);
   }

   const all_workspace_packages_paths = await find_workspace_packages(project_root, 'src');
   const package_paths_map = await get_package_paths_map(project_root, all_workspace_packages_paths);
   const discovered_files = await discover_file_dependencies([test_file_path], project_root);

   const files_to_analyze_set = new Set([...discovered_files, ...(extra_analysis_files ?? [])]);

   let captured_registry: IBuildTimeRegistry | null = null;
   let guerrero_strategy_instance: ICodegenStrategy | undefined;

   switch (guerrero_strategy) {
      case 'aos': {
         guerrero_strategy_instance = new CodegenStrategyAOS();

         const aos_package_path = package_paths_map.get('@eldritch-engine/guerrero-core-strategy-aos');

         if (aos_package_path) {
            const aos_runtime_files = await find_source_files_recursive(path.join(aos_package_path, 'src', 'runtime'), ['.ts']);

            for (const file of aos_runtime_files) {
               files_to_analyze_set.add(file);
            }
         }

         break;
      }

      // doesn't need anything
      case 'native': {
         guerrero_strategy_instance = new CodegenStrategyNative();

         break;
      }

      case 'soa': {
         const soa_package_path = package_paths_map.get('@eldritch-engine/guerrero-core-strategy-soa');

         if (soa_package_path) {
            const soa_runtime_files = await find_source_files_recursive(path.join(soa_package_path, 'src', 'runtime'), ['.ts']);

            for (const file of soa_runtime_files) {
               files_to_analyze_set.add(file);
            }
         }

         break;
      }
   }

   const internal_views_path = path.relative(project_root, path.join(package_info.package_root, 'src/__generated__/guerrero_internal.ts'));
   const tsconfig_path = path.join(package_info.package_root, 'tsconfig.json');

   const variables = {
      DEBUG: true,
      SAFETY: true,
      TLSF_STATS: true,
      PLATFORM_SUPPORT: 'bun',
      TYPE: 'server',
      ...(process.env || {}),
   };

   const current_build_options: BuildOptions = {
      ...base_esbuild_config,
      entryPoints: [test_file_path],
      outfile: out_file_full_path,
      bundle: true,
      platform: 'node',
      format: 'esm',
      sourcemap: false,
      tsconfig: tsconfig_path,
      external: [
         ...(base_esbuild_config.external || []),
         'bun:test',
         '@swc/core'
      ],
      plugins: [
         self_alias_resolver_plugin(find_package_root_and_name),
         workspace_alias_resolver_plugin(package_paths_map),
         eldritch_builder_unplugin.esbuild({
            ifdef_variables: variables,
            logger_namespace_enable_injection: true,
            logger_filter_enable: true,
            logger_verbose: false,
            ifdef_logger_rules: process.env['LOG_FILTERS'] ?? '',
            ifdef_logger_default_level: 'error',
            verbose: false,
            guerrero_enable: !!guerrero_strategy,
            guerrero_strategy: guerrero_strategy_instance,
            guerrero_internal_views_path: internal_views_path,
            tddi_enable: true,
            analysis_scope_files: [...files_to_analyze_set],
            on_analysis_complete: (registry) => {
               captured_registry = registry;
            },
         }),
         ...(base_esbuild_config.plugins || [])
      ].filter(Boolean),
   };

   await build(current_build_options);

   if (!captured_registry) {
      throw new Error('build completed but registry was not captured from the plugin');
   }

   return {
      strategy: guerrero_strategy_instance,
      registry: captured_registry,
   };
}

export async function compile_test_file(
   test_file_path: string,
   project_root: string,
   base_esbuild_config: BuildOptions,
   guerrero_strategy: 'aos' | 'soa' | 'native',
   out_dir_suffix: string = ''
) {
   const relative_test_file_path = path.relative(project_root, test_file_path);

   const { out_dir_path, out_file_base_js } = get_output_paths_for_test_file(
      test_file_path,
      project_root,
      out_dir_suffix
   );

   const out_file_full_path = path.join(out_dir_path, out_file_base_js);

   try {
      await fs.mkdir(out_dir_path, { recursive: true });

      await compile_single_file_for_test(
         test_file_path,
         out_file_full_path,
         project_root,
         base_esbuild_config,
         guerrero_strategy
      );

      console.log(`compiled test (${guerrero_strategy ?? 'none'}): ${relative_test_file_path} -> ${path.relative(project_root, out_file_full_path)}`);
   } catch (error) {
      console.error(`failed to compile test ${relative_test_file_path} with strategy '${guerrero_strategy ?? 'none'}':`, error);

      throw error;
   }
}

export async function compile_all_tests() {
   const project_root = (await find_git_root(process.cwd())) || process.cwd();
   const target_packages_names = parse_target_packages();
   const all_workspace_packages = await find_workspace_packages(project_root, 'src');

   const packages_with_tests: {
      name: string;
      path: string;
      pkg_json: any;
   }[] = [];

   for (const pkg_path of all_workspace_packages) {
      try {
         const tests_dir = path.join(project_root, pkg_path, 'tests');
         const pkg_json_path = path.join(project_root, pkg_path, 'package.json');

         await fs.access(tests_dir);

         const pkg_json = JSON.parse(await fs.readFile(pkg_json_path, 'utf-8'));

         packages_with_tests.push({
            name: pkg_json.name,
            path: pkg_path,
            pkg_json: pkg_json,
         });
      } catch (e) {
         // ignore
      }
   }

   let packages_to_process = packages_with_tests;

   if (target_packages_names) {
      console.log(`filtering tests for specified packages: ${[...target_packages_names].join(', ')}`);

      packages_to_process = packages_with_tests.filter((p) => target_packages_names.has(p.name));
   }

   const package_roots_to_clean = new Set(packages_to_process.map((p) => path.join(project_root, p.path)));

   await Promise.all([...package_roots_to_clean].map((root) => clean_tests_dist(root)));

   if (packages_to_process.length === 0) {
      console.log('no test files found for the specified packages or in the project');

      return;
   }

   console.log(`found ${packages_to_process.length} packages with tests to compile`);

   const compilation_tasks: {
      file: string;
      action: 'compile' | 'copy';
      strategy: 'aos' | 'soa' | 'native';
      suffix: string;
   }[] = [];

   for (const pkg of packages_to_process) {
      const test_files = await find_test_files(path.join(project_root, pkg.path));

      if (test_files.length === 0) {
         continue;
      }

      console.log(`\n--- preparing tests for: ${pkg.name} ---`);

      const strategies_to_run = determine_guerrero_strategies(pkg.pkg_json);

      console.log(`detected guerrero strategy: will run compilation for: [${strategies_to_run.map(s => s ?? 'none').join(', ')}]`);

      for (const strat of strategies_to_run) {
         if (strat === 'soa') {
            console.log(`(skipping 'soa' strategy for ${pkg.name} as it's not implemented yet)`);

            continue;
         }

         for (const test_file of test_files) {
            compilation_tasks.push({
               file: test_file.path,
               action: test_file.action,
               strategy: strat,
               suffix: strat ?? 'none',
            });
         }
      }
   }

   const results = await Promise.allSettled(
      compilation_tasks
         .map((task) => {
            return task.action === 'copy'
               ? copy_test_file(
                  task.file,
                  project_root,
                  task.suffix
               )
               : compile_test_file(
                  task.file,
                  project_root,
                  project_base_build_config,
                  task.strategy,
                  task.suffix
               )
         })
   );

   const failed_files: {
      file: string;
      strategy: string;
      action: 'compile' | 'copy';
   }[] = [];

   for (const [index, result] of results.entries()) {
      if (result.status === 'rejected') {
         const task = compilation_tasks[index]!;

         failed_files.push({
            file: task.file,
            strategy: task.strategy,
            action: task.action
         });
      }
   }

   if (failed_files.length > 0) {
      console.error(`\n--- compilation summary: ${failed_files.length} test file(s) failed to process ---`);

      for (const failure of failed_files) {
         console.error(`  - [${failure.strategy}] (${failure.action}) ${path.relative(project_root, failure.file)}`);
      }

      process.exit(1);
   } else {
      console.log('\n--- compilation summary: all targeted tests processed successfully ---');
   }
}

export async function clean_tests_dist(start_dir: string) {
   const entries = await fs.readdir(start_dir, { withFileTypes: true });

   for (const entry of entries) {
      const full_path = path.join(start_dir, entry.name);

      if (entry.isDirectory()) {
         if (
            entry.name === 'tests-dist'
            || entry.name === 'bench-dist'
         ) {
            console.log(`cleaning: ${path.relative(process.cwd(), full_path)}`);

            await fs.rm(full_path, { recursive: true, force: true });
         } else if (
            entry.name !== 'node_modules'
            && entry.name !== 'dist'
            && !entry.name.startsWith('.')
         ) {
            await clean_tests_dist(full_path);
         }
      }
   }
}