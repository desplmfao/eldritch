/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder/src/index.ts
 */

import { default as fs } from 'node:fs/promises';
import { default as path } from 'node:path';

import { type BuildOptions, type Platform, type Plugin, build } from 'esbuild';

import { eldritch_builder_unplugin } from '@eldritch-engine/builder-unplugin/index';

import { CodegenStrategyAOS } from '@eldritch-engine/guerrero-core-strategy-aos/codegen/factory';
import { CodegenStrategyNative } from '@eldritch-engine/guerrero-core-strategy-native/codegen/factory';

import { find_git_root, find_package_root_and_name, find_source_files_recursive } from '@eldritch-engine/utils/misc';

import {
   determine_guerrero_strategies,
   find_workspace_packages,
   get_package_paths_map,
   workspace_alias_resolver_plugin,
   discover_file_dependencies
} from '@self/build_orchestrator';

//
//

export const is_production: boolean = process.env['NODE_ENV'] === 'production';
export const is_debug_enabled: boolean = (process.env['DEBUG'] === 'false') ? false : true;
export const is_verbose_buildtime: boolean = (process.env['VERBOSE_BT'] === 'false') ? false : true;
export const is_safety_enabled: boolean = (process.env['SAFETY'] === 'false') ? false : true;
export const is_editor_enabled: boolean = (process.env['EDITOR_ENABLED'] === 'false') ? false : true;
export const is_tlsf_stats_enabled: boolean = (process.env['TLSF_STATS'] === 'false') ? false : true;

export const platform_support: string = process.env['PLATFORM_SUPPORT'] ?? 'browser';
export const build_type: string = process.env['TYPE'] ?? 'client';
//
//

export const out_dir = 'dist';

export const base_config: BuildOptions = {
   bundle: true,
   treeShaking: true,
   color: true,
   metafile: true,
   logLevel: 'info',

   legalComments: 'eof',
   sourcemap: 'linked',

   minify: false,
   minifySyntax: is_production,
   minifyIdentifiers: false,
   minifyWhitespace: is_production,
   keepNames: true,
   mangleQuoted: false,

   charset: 'utf8',

   platform: platform_support as Platform,
   packages: 'bundle',

   external: [
      ...(platform_support === 'browser' ? [] : ['bun', 'bun:*', 'node:*']),
      '@swc/core',
   ],
};

export interface CreateBuildConfig extends BuildOptions {
   variables?: Record<string, boolean | string | number> | NodeJS.ProcessEnv;
}

export async function clean_output_directories(directories: string[]): Promise<void> {
   for (const dir of directories) {
      try {
         await fs.rm(dir, { recursive: true, force: true });
         await fs.mkdir(dir, { recursive: true });

         console.debug('cleaned directory:', dir);
      } catch (e) {
         if (e.code !== 'ENOENT') {
            try {
               await fs.access(dir);
            } catch (access_error) {
               if (access_error.code === 'ENOENT') {
                  await fs.mkdir(dir, { recursive: true });

                  console.debug('created directory:', dir);

                  continue;
               }
            }
         }

         if (e.code !== 'ENOENT') {
            console.error('failed to clean directory:', dir, e);
         } else {
            await fs.mkdir(dir, { recursive: true });

            console.debug('created directory after ENOENT on rm:', dir);
         }
      }
   }
}

export async function create_build_config(config: CreateBuildConfig): Promise<void> {
   const {
      variables,
      entryPoints,
      outfile,
      platform,
      format,
      outdir,
      ...esbuild_config
   } = config;

   try {
      const final_config: BuildOptions = {
         ...base_config,
         ...esbuild_config,
         platform: platform ?? base_config.platform,
         format: format ?? base_config.format,
         entryPoints: entryPoints ?? {
            'index': './src/index.ts'
         },
         outfile: outfile,
         outdir: outfile ? undefined : (outdir ?? `${out_dir}/${platform_support}/`),
         plugins: [
            ...(base_config.plugins || []),
            ...(esbuild_config.plugins || [])
         ],
         bundle: esbuild_config.bundle != null ? esbuild_config.bundle : true,
      };

      if (final_config.outfile) {
         delete final_config.outdir;
      } else if (final_config.outdir) {
         delete final_config.outfile;
      }

      console.debug('--- building with config ---');
      console.debug('entry points:', final_config.entryPoints);
      console.debug('outfile:', final_config.outfile);
      console.debug('outdir:', final_config.outdir);
      console.debug('platform:', final_config.platform);
      console.debug('format:', final_config.format);
      console.debug('bundle:', final_config.bundle);
      console.debug('--------------------------');

      await build(final_config);
   } catch (e) {
      console.error('build failed for:', entryPoints, '->', outfile ?? config.outdir, e);
   }
}

export async function build_single(
   options?: Partial<BuildOptions>,
   plugins?: Plugin[],
): Promise<void> {
   const variables: Record<string, string | number | boolean> | NodeJS.ProcessEnv = {
      DEBUG: is_debug_enabled,
      VERBOSE_BT: is_verbose_buildtime,
      EDITOR_ENABLED: is_editor_enabled,
      SAFETY: is_safety_enabled,
      TLSF_STATS: is_tlsf_stats_enabled,
      PLATFORM_SUPPORT: platform_support,
      TYPE: build_type,
      ...process.env
   };

   const package_root = process.cwd();
   const project_root = (await find_git_root(package_root)) || package_root;
   const pkg_json_content = JSON.parse(await fs.readFile(path.join(package_root, 'package.json'), 'utf-8'));

   const all_workspace_packages_paths = await find_workspace_packages(project_root, 'src');
   const package_paths_map = await get_package_paths_map(project_root, all_workspace_packages_paths);

   const entry_points = Array.isArray(options?.entryPoints)
      ? options.entryPoints
      : Object.values(options?.entryPoints || { 'index': './src/index.ts' });

   const normalized_entry_points = entry_points.map(
      (entry) => {
         if (typeof entry === 'string') {
            return entry;
         }

         return entry.in;
      }
   );

   const files_to_analyze = await discover_file_dependencies(normalized_entry_points, project_root);

   const strategies = determine_guerrero_strategies(pkg_json_content);
   let guerrero_strategy_instance;

   if (strategies.length > 0) {
      const strategy_to_use = strategies[0]!;

      if (strategies.length > 1) {
         console.warn(`[build] package '${pkg_json_content.name}' specifies multiple guerrero strategies. using the first one found ('${strategy_to_use}') for this build`);
      }

      switch (strategy_to_use) {
         case 'aos': {
            guerrero_strategy_instance = new CodegenStrategyAOS();

            break;
         }

         case 'soa': {
            break;
         }

         case 'native': {
            guerrero_strategy_instance = new CodegenStrategyNative();

            break;
         }
      }
   }

   const internal_views_path = path.relative(project_root, path.join(package_root, 'src/__generated__/guerrero_internal.ts'));

   const build_target: CreateBuildConfig = {
      ...options,
      outdir: `${out_dir}/${platform_support}/`,
      format: 'esm',
      variables: variables,
      entryNames: options?.entryPoints ? undefined : `${build_type === 'server' ? 'server' : 'client'}.min`,
      plugins: [
         workspace_alias_resolver_plugin(package_paths_map),
         eldritch_builder_unplugin.esbuild({
            ifdef_variables: variables,
            logger_namespace_enable_injection: true,
            logger_filter_enable: true,
            logger_verbose: is_verbose_buildtime,
            ifdef_logger_rules: process.env['LOG_FILTERS'] ?? '',
            ifdef_logger_default_level: 'error',
            verbose: is_verbose_buildtime,
            tddi_enable: true,
            tddi_custom_generators: [],
            guerrero_enable: !!guerrero_strategy_instance,
            guerrero_strategy: guerrero_strategy_instance,
            guerrero_internal_views_path: internal_views_path,
            analysis_scope_files: files_to_analyze,
         }),
         ...(plugins ? plugins : [])
      ]
   };

   await clean_output_directories([`${out_dir}/`]);
   await create_build_config(build_target);
}

export async function build_all_alternative(
   options?: Partial<BuildOptions>,
   plugins?: Plugin[],
): Promise<void> {
   // TODO: make this use build single, and just change the entry

   const variables: Record<string, string | number | boolean> | NodeJS.ProcessEnv = {
      DEBUG: is_debug_enabled,
      VERBOSE_BT: is_verbose_buildtime,
      EDITOR_ENABLED: is_editor_enabled,
      SAFETY: is_safety_enabled,
      TLSF_STATS: is_tlsf_stats_enabled,
      PLATFORM_SUPPORT: platform_support,
      TYPE: build_type,
      ...process.env
   };

   const config: BuildOptions = {
      ...options,
      ...base_config,
      outdir: `${out_dir}/${platform_support}/`,
      format: 'esm',
      plugins: [
         eldritch_builder_unplugin.esbuild({
            ifdef_variables: variables,
            logger_namespace_enable_injection: true,
            logger_filter_enable: true,
            logger_verbose: is_verbose_buildtime,
            ifdef_logger_rules: process.env['LOG_FILTERS'] ?? '',
            ifdef_logger_default_level: 'error',
            verbose: is_verbose_buildtime,
            tddi_enable: true,
            tddi_custom_generators: [],
         }),
         ...(plugins ? plugins : [])
      ]
   };

   await clean_output_directories([`${out_dir}/`]);

   let total_files_built = 0;

   const chrome_builds: Promise<unknown>[] = [];

   for (let version = 51; version <= 130; version++) {
      const entry_name = `dist-chrome${version}`;

      const build_promise = build({
         ...config,
         target: [`chrome${version}`],
         entryPoints: {
            [entry_name]: './src/index.ts'
         }
      });

      chrome_builds.push(build_promise);
   }

   const firefox_builds: Promise<unknown>[] = [];

   for (let version = 52; version <= 130; version++) {
      const entry_name = `dist-firefox${version}`;

      const build_promise = build({
         ...config,
         target: [`firefox${version}`],
         entryPoints: {
            [entry_name]: './src/index.ts'
         }
      });

      firefox_builds.push(build_promise);
   }

   total_files_built = chrome_builds.length + firefox_builds.length;

   try {
      await Promise.all([
         ...chrome_builds,
         ...firefox_builds
      ]);

      console.debug('all versioned builds completed successfully', total_files_built);
   } catch (e) {
      console.error('one or more versioned builds failed:', e);
   }
}

export interface BuildSourceFilesOptions {
   src_dir: string;
   out_dir: string;
   platform?: Platform;
   format?: BuildOptions['format'];
   esbuild_options?: Partial<BuildOptions>;
   plugin_options?: Parameters<typeof eldritch_builder_unplugin.esbuild>[0];
   file_extension?: string;
   build_type_env?: string;
}

export async function build_package_sources(options: BuildSourceFilesOptions): Promise<void> {
   const {
      src_dir,
      out_dir: out_dir_base,
      platform = platform_support as Platform,
      format = 'esm',
      esbuild_options = {},
      plugin_options = {},
      file_extension = '.ts',
      build_type_env = 'example',
   } = options;

   const resolved_src_dir = path.resolve(src_dir);
   const resolved_out_dir = path.resolve(out_dir_base);

   await clean_output_directories([resolved_out_dir]);

   const absolute_source_files = await find_source_files_recursive(resolved_src_dir, [file_extension]);

   if (absolute_source_files.length === 0) {
      console.warn(`no source files ending with '${file_extension}' found in ${resolved_src_dir}`);

      return;
   }

   console.log(`found ${absolute_source_files.length} files to compile from ${src_dir} to ${out_dir_base}`);

   const package_info = await find_package_root_and_name(src_dir);

   if (!package_info) {
      throw new Error(`could not find package.json for source directory: ${src_dir}`);
   }

   const project_root = (await find_git_root(src_dir)) || package_info.package_root;
   const pkg_json_content = JSON.parse(await fs.readFile(path.join(package_info.package_root, 'package.json'), 'utf-8'));

   const all_workspace_packages_paths = await find_workspace_packages(project_root, 'src');
   const package_paths_map = await get_package_paths_map(project_root, all_workspace_packages_paths);
   const strategies = determine_guerrero_strategies(pkg_json_content);

   let guerrero_strategy_instance;

   if (strategies.length > 0) {
      const strategy_to_use = strategies[0]!;

      switch (strategy_to_use) {
         case 'aos': {
            guerrero_strategy_instance = new CodegenStrategyAOS();

            break;
         }

         case 'soa': {
            break;
         }

         case 'native': {
            guerrero_strategy_instance = new CodegenStrategyNative();

            break;
         }
      }
   }

   const internal_views_path = path.relative(project_root, path.join(package_info.package_root, 'src/__generated__/guerrero_internal.ts'));

   const build_promises: Promise<void>[] = [];

   for (const absolute_file_path of absolute_source_files) {
      const input_file_path = absolute_file_path;

      const relative_file_path = path.relative(resolved_src_dir, absolute_file_path);
      const output_file_path = path.join(resolved_out_dir, relative_file_path.replace(new RegExp(path.extname(relative_file_path) + '$'), '.js'));

      await fs.mkdir(path.dirname(output_file_path), { recursive: true });

      const final_plugin_options: Parameters<typeof eldritch_builder_unplugin.esbuild>[0] = {
         ifdef_variables: {
            DEBUG: is_debug_enabled,
            VERBOSE_BT: is_verbose_buildtime,
            EDITOR_ENABLED: is_editor_enabled,
            SAFETY: is_safety_enabled,
            TLSF_STATS: is_tlsf_stats_enabled,
            PLATFORM_SUPPORT: platform,
            TYPE: build_type_env,
            ...(process.env || {}),
            ...(plugin_options.ifdef_variables || {})
         },
         logger_namespace_enable_injection: true,
         logger_filter_enable: true,
         logger_verbose: is_verbose_buildtime,
         verbose: is_verbose_buildtime,
         guerrero_enable: !!guerrero_strategy_instance,
         guerrero_strategy: guerrero_strategy_instance,
         guerrero_internal_views_path: internal_views_path,
         ...plugin_options,
      };

      final_plugin_options.ifdef_variables = {
         ...final_plugin_options.ifdef_variables,
         ...(plugin_options.ifdef_variables || {})
      };

      const current_build_config: BuildOptions = {
         ...base_config,
         ...esbuild_options,
         entryPoints: [input_file_path],
         outfile: output_file_path,
         platform: platform,
         format: format,
         bundle: true,
         sourcemap: 'linked',
         plugins: [
            workspace_alias_resolver_plugin(package_paths_map),
            eldritch_builder_unplugin.esbuild(final_plugin_options),
            ...(esbuild_options.plugins || []),
            ...(base_config.plugins || [])
         ].filter((v, i, a) => a.findIndex(t => (t.name === v.name)) === i),
      };

      delete current_build_config.outdir;
      const build_promise = build(current_build_config);

      build_promises.push(
         (async () => {
            try {
               await build_promise;

               console.log(`compiled: ${path.relative(process.cwd(), input_file_path)} -> ${path.relative(process.cwd(), output_file_path)}`);
            } catch (e) {
               console.error(`failed to compile: ${path.relative(process.cwd(), input_file_path)}`);

               throw e;
            }
         })()
      );
   }

   try {
      await Promise.all(build_promises);

      console.log(`successfully compiled ${absolute_source_files.length} files from ${src_dir} to ${out_dir_base}`);
   } catch (e) {
      console.error(`one or more files failed to compile.`);

      throw e;
   }
}