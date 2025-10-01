/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-unplugin/src/index.ts
 */

import { default as path } from 'node:path';
import { default as fs } from 'node:fs/promises';

import { createUnplugin } from 'unplugin';
import type { UnpluginBuildContext, UnpluginContext, UnpluginOptions } from 'unplugin';

import * as swc from '@swc/core';

import type { TypeNode } from '@eldritch-engine/type-utils/guerrero/parser';
import type { ICodegenStrategy } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { IBuildTimeRegistry } from '@eldritch-engine/type-utils/builder/registry';
import type { IInjectionGenerator } from '@eldritch-engine/type-utils/tddi/generator';

import { format_content_stack } from '@eldritch-engine/builder-core-ifdef/formatter';
import { REG_EXPS as IFDEF_REG_EXPS, PLUGIN_NAME as IFDEF_PLUGIN_NAME } from '@eldritch-engine/builder-core-ifdef/constants';
import { DirectiveError, type PluginLogicSettings, type WarnCallback } from '@eldritch-engine/builder-core-ifdef/types';

import { apply_namespace_transform, type NamespaceTransformOptions } from '@eldritch-engine/builder-core-logger-namespace/transform';
import type { PackageInfo } from '@eldritch-engine/builder-core-logger-namespace/types';

import { DEFAULT_LOG_FILTER_ENV_VAR, DEFAULT_LOG_FILTER_DEFAULT_LEVEL } from '@eldritch-engine/builder-core-logger-filter/constants';
import { parse_log_filter_rules } from '@eldritch-engine/builder-core-logger-filter/parser';
import { apply_log_filter_transform } from '@eldritch-engine/builder-core-logger-filter/transform';
import type { LogFilterSettings, LogFilterTransformOptions } from '@eldritch-engine/builder-core-logger-filter/types';

import { apply_tddi_transform } from '@eldritch-engine/builder-core-tddi/transform';
import { TDDI_MARKER_PROP_NAME } from '@eldritch-engine/builder-core-tddi/swc/visitor';

import { TypeParser, stringify_type_node } from '@eldritch-engine/guerrero-core/layout/parser/parser';
import { SchemaLayoutCalculator } from '@eldritch-engine/guerrero-core/layout/calculator';
import { TypeResolver } from '@eldritch-engine/guerrero-core/layout/resolver';

import { find_git_root, find_all_source_roots } from '@eldritch-engine/utils/misc';

import { ALL_LOG_LEVELS, LOG_LEVEL_HIERARCHY } from '@self/log_levels';
import { BuildTimeRegistry } from '@self/registry';

/** settings for the eldritch builder unplugin */
export interface PluginSettings {
   /** enable verbose logging from the plugin and core modules */
   verbose?: boolean;
   /** regular expression to filter files processed by this plugin. defaults to `/\.[jt]sx?/` */
   file_path_filter?: RegExp;

   /** regex for ifdef directives, defaults to triple slash `/// #directive` */
   ifdef_directive_regexp?: RegExp;
   /** replace pruned lines with spaces instead of removing them */
   ifdef_fill_with_spaces?: boolean;
   /** replace pruned lines with comments instead of removing them */
   ifdef_comment_out_lines?: boolean;
   /** prefix for commented out lines if `ifdef_comment_out_lines` is true */
   ifdef_comment_prefix?: string;
   /** variables accessible within ifdef expressions */
   ifdef_variables?: Record<string, unknown>;
   /** a comma-separated string of rules to determine log levels for ifdef compilation */
   ifdef_logger_rules?: string;
   /** the default log level to use for ifdef if no rule matches. defaults to 'warn' */
   ifdef_logger_default_level?: string;
   /** enable strict mode for ifdef expression evaluation */
   ifdef_strict?: boolean;
   /** custom helper functions for ifdef expressions */
   ifdef_expression_helpers?: Record<string, (...args: any[]) => any>;

   /** set to true to enable automatic logger namespacing using swc */
   logger_namespace_enable_injection?: boolean;

   /** enable compile-time log filtering */
   logger_filter_enable?: boolean;
   /** environment variable name to read log filter rules from */
   logger_filter_rules_env_var?: string;
   /** default log level to apply if no specific rule matches a namespace */
   logger_filter_default_level?: string;
   /** enable verbose logging for the plugin */
   logger_verbose?: boolean;

   /** enable the guerrero code generation step */
   guerrero_enable?: boolean;
   /** a specific codegen strategy to use. if undefined, the original user-defined class is used */
   guerrero_strategy?: ICodegenStrategy;
   /** path to write the shared internal guerrero views file, relative to project root */
   guerrero_internal_views_path?: string;

   /** enable the tddi code generation step */
   tddi_enable?: boolean;
   /** an array of custom injection generator instances to extend the tddi system */
   tddi_custom_generators?: IInjectionGenerator[];

   /** an existing registry instance to share state across multiple builds */
   shared_build_registry?: IBuildTimeRegistry;

   /** a callback invoked after the build-time analysis is complete, providing access to the populated registry. */
   on_analysis_complete?: (registry: IBuildTimeRegistry) => void;

   /**
    * a list of source files to scope the build-time analysis to.
    * if not provided, all source roots discovered in the project will be analyzed.
    */
   analysis_scope_files?: string[];

   /**
    * controls the behavior of the guerrero step
    *
    * 'full' runs analysis and transform
    *
    * 'analyze' only collects internal views
    *
    * 'transform' only transforms source code, assuming internal views are already generated
    */
   guerrero_build_mode?: 'full' | 'analyze' | 'transform';
}

export const DEFAULT_FILE_PATH_REGEX: RegExp = /\.[jt]sx?/;
export const PLUGIN_NAME: string = 'eldritch-builder-unplugin';

const SWC_PARSER_OPTIONS: swc.ParseOptions = {
   syntax: 'typescript',
   tsx: false,
   decorators: true,
   dynamicImport: true,
};

const SWC_PRINT_OPTIONS_BASE: swc.Options = {
   jsc: {
      parser: SWC_PARSER_OPTIONS,
      target: 'esnext',
      preserveAllComments: true,
      externalHelpers: false,
   },
   module: {
      type: 'nodenext',
      strict: true,
      importInterop: 'swc',
   },
   minify: false,
   sourceMaps: true,
   isModule: true,
};

const package_info_cache = new Map<string, PackageInfo | undefined>();

async function find_package_info(file_path: string): Promise<PackageInfo | undefined> {
   let current_dir = path.dirname(file_path);
   const { root } = path.parse(current_dir);

   while (current_dir !== root) {
      const cached = package_info_cache.get(current_dir);

      if (cached != null) {
         return cached;
      }

      const pkg_json_path = path.join(current_dir, 'package.json');

      try {
         await fs.access(pkg_json_path);

         const content = await fs.readFile(pkg_json_path, 'utf-8');
         const pkg = JSON.parse(content);

         if (pkg.name && typeof pkg.name === 'string') {
            const info: PackageInfo = { name: pkg.name, root_path: current_dir };

            package_info_cache.set(current_dir, info);

            let parent_dir = path.dirname(file_path);

            while (parent_dir.startsWith(current_dir) && parent_dir !== current_dir) {
               if (!package_info_cache.has(parent_dir)) {
                  package_info_cache.set(parent_dir, info);
               }

               parent_dir = path.dirname(parent_dir);
            }

            return info;
         }
      } catch (e) {
         if (e.code !== 'ENOENT') {
            console.warn(`[${PLUGIN_NAME}] warning: error reading/parsing ${pkg_json_path}: ${e.message}`);
         }
      }

      current_dir = path.dirname(current_dir);
   }

   package_info_cache.set(path.dirname(file_path), undefined);

   return;
}

interface LogLevelIfdefRule {
   pattern: RegExp;
   level_numeric: number;
}

function parse_log_level_rules(
   rules_string?: string
): LogLevelIfdefRule[] {
   const rules: LogLevelIfdefRule[] = [];

   if (!rules_string) {
      return rules;
   }

   const parts = rules_string.split(',');

   for (const part of parts) {
      const rule_parts = part.trim().split('=');

      if (rule_parts.length !== 2) {
         console.warn(`[${PLUGIN_NAME}] invalid ifdef log rule: '${part}', skipping`);

         continue;
      }

      const pattern_str = rule_parts[0]!.trim();
      const level_str = rule_parts[1]!.trim().toLowerCase();

      try {
         const regex_match = pattern_str.match(/^\/(.+)\/([gimyus]*)$/);
         const regex = regex_match ? new RegExp(regex_match[1]!, regex_match[2]!) : new RegExp(pattern_str);
         const level_numeric = LOG_LEVEL_HIERARCHY.get(level_str);

         if (level_numeric == null) {
            console.warn(`[${PLUGIN_NAME}] invalid log level '${level_str}' in ifdef rule '${part}', skipping`);

            continue;
         }

         rules.push({
            pattern: regex,
            level_numeric
         });
      } catch (e) {
         console.warn(`[${PLUGIN_NAME}] invalid regex in ifdef log rule '${pattern_str}': ${e.message}, skipping`);
      }
   }

   return rules;
}

function get_ifdef_log_variables(
   package_name: string | undefined,
   rules: LogLevelIfdefRule[],
   default_level_numeric: number
): Record<string, boolean> {
   let effective_level = default_level_numeric;

   if (package_name) {
      for (const rule of rules) {
         if (rule.pattern.test(package_name)) {
            effective_level = rule.level_numeric;

            break;
         }
      }
   }

   const log_vars: Record<string, boolean> = {};

   for (const level_name of ALL_LOG_LEVELS) {
      const var_name = `LOGGER_HAS_${level_name}`;
      const level_numeric = LOG_LEVEL_HIERARCHY.get(level_name.toLowerCase())!;

      log_vars[var_name] = level_numeric >= effective_level;
   }

   return log_vars;
}

export async function write_internal_views_file(
   registry: IBuildTimeRegistry,
   strategy: ICodegenStrategy,
   project_root_path: string,
   internal_views_path: string
) {
   const all_shared_code_blocks: string[] = [];
   const all_shared_imports = new Set<string>();

   for (const { code, imports } of registry.generated_internal_views.values()) {
      all_shared_code_blocks.push(code);

      for (const imp of imports) {
         all_shared_imports.add(imp);
      }
   }

   const strategy_import_map = strategy.get_import_map();
   const grouped_imports = new Map<string, Set<string>>();

   for (const imp of all_shared_imports) {
      const pkg_path = strategy_import_map.get(imp);

      if (pkg_path) {
         if (!grouped_imports.has(pkg_path)) {
            grouped_imports.set(pkg_path, new Set());
         }

         grouped_imports.get(pkg_path)!.add(imp);

         continue;
      }

      const metadata = registry.get_class_metadata(imp);

      if (
         metadata
         && metadata.is_reflectable
      ) {
         const guerrero_file_path = path.join(project_root_path, internal_views_path);

         let relative_path = path.relative(path.dirname(guerrero_file_path), metadata.file_path).replace(/\\/g, '/').replace(/\.ts$/, '');

         if (!relative_path.startsWith('.')) {
            relative_path = `./${relative_path}`;
         }

         if (!grouped_imports.has(relative_path)) {
            grouped_imports.set(relative_path, new Set());
         }

         const alias = strategy.get_alias_for_user_type(imp);
         if (alias) {
            grouped_imports.get(relative_path)!.add(`${imp} as ${alias}`);
         } else {
            grouped_imports.get(relative_path)!.add(imp);
         }
      }
   }

   let import_statements = '';
   for (const [pkg, names] of grouped_imports.entries()) {
      import_statements += `import { ${[...names].sort().join(', ')} } from '${pkg}';\n`;
   }

   const final_shared_code = `\
// @ts-nocheck - we know that the types are correct
// this is automatically generated - do not edit manually
${import_statements}

${all_shared_code_blocks.join('\n\n')}\n`;

   const write_path = path.join(project_root_path, internal_views_path);
   await fs.mkdir(path.dirname(write_path), { recursive: true });
   await fs.writeFile(write_path, final_shared_code, 'utf-8');
}

type ImportSpecifier = string | {
   original: string;
   local: string
};

function generate_imports_from_names(
   all_imports: Set<ImportSpecifier>,
   import_map: ReadonlyMap<string, string>
): string {
   const grouped_imports = new Map<string, Set<string>>();
   const built_ins = new Set<string>();

   for (const spec of all_imports) {
      const is_aliased = typeof spec === 'object';
      const original_name = is_aliased ? spec.original : spec;
      const import_string = is_aliased ? `${spec.original} as ${spec.local}` : spec;

      const pkg = import_map.get(original_name);

      if (pkg) {
         if (!grouped_imports.has(pkg)) {
            grouped_imports.set(pkg, new Set());
         }

         grouped_imports.get(pkg)!.add(import_string);
      } else {
         built_ins.add(original_name);
      }
   }

   let import_statements: string = '';

   for (const [pkg, names] of grouped_imports.entries()) {
      import_statements += `import { ${[...names].sort().join(', ')} } from '${pkg}';\n`;
   }

   return import_statements;
}


export const eldritch_builder_unplugin = createUnplugin(
   (options: PluginSettings | undefined): UnpluginOptions => {
      const settings = options ?? {} as PluginSettings;
      const verbose: boolean = settings.verbose ?? false;

      const file_filter: RegExp = settings.file_path_filter ?? DEFAULT_FILE_PATH_REGEX;

      const enable_log_filtering: boolean = settings.logger_filter_enable ?? false;
      const log_filter_rules_env: string = settings.logger_filter_rules_env_var ?? DEFAULT_LOG_FILTER_ENV_VAR;
      const log_filter_default_level_str: string = settings.logger_filter_default_level ?? DEFAULT_LOG_FILTER_DEFAULT_LEVEL;
      let parsed_log_filter_settings: LogFilterSettings;

      const log_ifdef_rules = parse_log_level_rules(settings.ifdef_logger_rules);
      const default_log_ifdef_level_numeric = LOG_LEVEL_HIERARCHY.get(settings.ifdef_logger_default_level?.toLowerCase() ?? 'warn') ?? 3;

      const enable_namespacing: boolean = settings.logger_namespace_enable_injection ?? true;
      const enable_guerrero: boolean = settings.guerrero_enable ?? true;
      const guerrero_strategy_instance: ICodegenStrategy | undefined = settings.guerrero_strategy;
      const guerrero_internal_views_path: string = settings.guerrero_internal_views_path ?? 'src/__generated__/guerrero_internal.ts';
      const guerrero_build_mode = settings.guerrero_build_mode ?? 'full';

      const enable_tddi: boolean = settings.tddi_enable ?? true;

      const ifdef_logic_settings: PluginLogicSettings = {
         verbose: settings.verbose,
         reg_exp: settings.ifdef_directive_regexp ?? IFDEF_REG_EXPS.triple,
         fill_with_spaces: settings.ifdef_fill_with_spaces,
         comment_out_lines: settings.ifdef_comment_out_lines,
         comment_prefix: settings.ifdef_comment_prefix,
         variables: {
            ...(process.env),
            ...(settings.ifdef_variables ?? {})
         },
         strict: settings.ifdef_strict,
         expression_helpers: settings.ifdef_expression_helpers
      };

      let project_root_path: string = '';
      let build_time_registry: IBuildTimeRegistry | null = null;

      const format_build_error = async (error: Error): Promise<string> => {
         let message = error.message;
         let cause_message = error.cause instanceof Error ? `\n   -> caused by: ${error.cause.message}` : '';

         const location_match = message.match(/in file '([^':]+):(\d+)'/);

         if (location_match) {
            const file_path = location_match[1]!;
            const line_number = Number.parseInt(location_match[2]!, 10);
            message = message.replace(/ in file '.*?'/, '');

            try {
               const file_content = await fs.readFile(file_path, 'utf-8');
               const lines = file_content.split(/\r?\n/);
               const error_line = lines[line_number - 1];

               if (error_line) {
                  return `\
error: ${message}${cause_message}
--> ${file_path}:${line_number}
|
${line_number.toString().padStart(4, ' ')} | ${error_line}
|
`;
               }
            } catch (read_error) {
               // fallback
            }
         }

         return `error: ${message}${cause_message}\n   (could not retrieve source location for context)`;
      };

      return {
         name: PLUGIN_NAME,
         enforce: 'pre',

         async buildStart(this: UnpluginBuildContext) {
            try {
               if (settings.shared_build_registry) {
                  build_time_registry = settings.shared_build_registry;
                  project_root_path = build_time_registry.project_root_path;

                  if (verbose) {
                     console.debug(`[${PLUGIN_NAME}] buildstart: using shared build registry.`);
                  }
               } else {
                  project_root_path = await find_git_root(process.cwd()) ?? process.cwd();

                  let project_pkg_json: object | undefined;

                  try {
                     const pkg_json_path = path.join(project_root_path, 'package.json');
                     const pkg_json_content = await fs.readFile(pkg_json_path, 'utf-8');

                     project_pkg_json = JSON.parse(pkg_json_content);
                  } catch (e) {
                     if (verbose) {
                        console.debug(`[${PLUGIN_NAME}] buildStart: could not read package.json at project root. proceeding with auto-discovery`);
                     }
                  }

                  const all_source_roots = await find_all_source_roots(project_root_path, project_pkg_json);

                  if (all_source_roots.length === 0) {
                     console.error(`[${PLUGIN_NAME}] could not locate any source directories. analysis cannot proceed`);

                     process.exit(1);
                  }

                  build_time_registry = new BuildTimeRegistry(project_root_path, all_source_roots);
               }

               if (!build_time_registry) {
                  throw new Error('internal error: build_time_registry was not initialized');
               }

               const type_resolver = new TypeResolver(build_time_registry, guerrero_strategy_instance);
               build_time_registry.resolver = type_resolver;
               // @ts-expect-error
               build_time_registry.calculator = new SchemaLayoutCalculator(build_time_registry, type_resolver);

               if (enable_guerrero && guerrero_strategy_instance) {
                  guerrero_strategy_instance.project_root_path = project_root_path;
                  guerrero_strategy_instance.guerrero_internal_views_path = guerrero_internal_views_path;
                  guerrero_strategy_instance.registry = build_time_registry;
                  guerrero_strategy_instance.resolver = type_resolver;
                  // @ts-expect-error
                  guerrero_strategy_instance.calculator = build_time_registry.calculator;
               } else if (enable_guerrero && !guerrero_strategy_instance) {
                  console.error(`[${PLUGIN_NAME}] guerrero_enable is true, but no guerrero_strategy was provided`);

                  process.exit(1);
               }

               if (!settings.shared_build_registry) {
                  await build_time_registry.analyze_project({
                     verbose,
                     guerrero_internal_views_path,
                     files_to_analyze: settings.analysis_scope_files,
                  });
               }

               if (enable_log_filtering) {
                  const rules_string = process.env[log_filter_rules_env];
                  parsed_log_filter_settings = parse_log_filter_rules(rules_string, log_filter_default_level_str);

                  if (verbose) {
                     console.debug(`[${PLUGIN_NAME}] log filter rules loaded: ${parsed_log_filter_settings!.rules.length} rules, default level: ${parsed_log_filter_settings!.default_level_numeric}`);
                  }
               }

               if (
                  enable_guerrero
                  && guerrero_strategy_instance
                  && guerrero_build_mode === 'full'
                  && build_time_registry
               ) {
                  if (verbose) {
                     console.log(`[${PLUGIN_NAME}] buildstart: pre-calculating all schema layouts...`);
                  }

                  for (const class_name of build_time_registry.metadata.keys()) {
                     build_time_registry.get_schema_layout(class_name);
                  }

                  if (verbose) {
                     console.log(`[${PLUGIN_NAME}] buildstart: schema layout calculation complete`);
                     console.log(`[${PLUGIN_NAME}] buildstart: pre-generating all internal guerrero views...`);
                  }

                  const visited_types = new Set<string>();

                  const generate_views_for_type = (type_string: string) => {
                     if (visited_types.has(type_string)) {
                        return;
                     }
                     visited_types.add(type_string);

                     try {
                        const node = new TypeParser(type_string).parse();

                        const visit = (n: TypeNode) => {
                           const propgen_for_node = guerrero_strategy_instance!.propgens.find(p => p.can_handle_as_standalone?.(n));

                           if (propgen_for_node) {
                              guerrero_strategy_instance!.get_or_generate_view_and_schema_for_type(stringify_type_node(n));
                           }

                           if ('element_type' in n && n.element_type) {
                              visit(n.element_type as TypeNode);
                           }

                           if ('key_type' in n && n.key_type) {
                              visit(n.key_type as TypeNode);
                           }

                           if ('value_type' in n && n.value_type) {
                              visit(n.value_type as TypeNode);
                           }

                           if ('variants' in n && n.variants) {
                              for (const variant of (n.variants as TypeNode[])) {
                                 visit(variant);
                              }
                           }
                        };

                        visit(node);
                     } catch (e) {
                        // not a guerrero type, ignore
                     }
                  };

                  for (const metadata of build_time_registry.metadata.values()) {
                     if (metadata.is_reflectable) {
                        for (const prop_meta of metadata.properties.values()) {
                           generate_views_for_type(prop_meta.type);
                        }
                     }

                     if (metadata.alias_for) {
                        generate_views_for_type(metadata.alias_for);
                     }
                  }

                  if (build_time_registry.generated_internal_views.size > 0) {
                     await write_internal_views_file(
                        build_time_registry,
                        guerrero_strategy_instance,
                        project_root_path,
                        guerrero_internal_views_path
                     );

                     if (verbose) {
                        console.debug(`[${PLUGIN_NAME}] buildstart: wrote ${build_time_registry.generated_internal_views.size} internal views to ${guerrero_internal_views_path}`);
                     }
                  }
               }

               if (settings.on_analysis_complete) {
                  settings.on_analysis_complete(build_time_registry);
               }
            } catch (e) {
               const error_message = `[${PLUGIN_NAME}] build failed during initialization (buildStart) phase`;
               const formatted_error = await format_build_error(e);

               throw new Error(`${error_message}\n${formatted_error}`, { cause: e });
            }
         },

         async buildEnd(this: UnpluginBuildContext): Promise<void> {
            // the internal views file is now written during buildStart to avoid race conditions
         },

         async transform(
            this: UnpluginContext,
            code: string,
            id: string
         ): Promise<{
            code: string,
            map?: any
         } | undefined> {
            if (!build_time_registry) {
               return;
            }

            const is_in_source_root = build_time_registry.source_roots.some(
               root => path.normalize(id).startsWith(path.normalize(root))
            );

            if (
               !file_filter.test(id)
               || !is_in_source_root
            ) {
               return;
            }

            const normalized_id = id.split(path.sep).join('/');

            let package_info: PackageInfo | undefined;

            try {
               package_info = await find_package_info(normalized_id);
            } catch (e) {
               this.warn(`[${PLUGIN_NAME}] error finding package info for ${normalized_id}: ${e.message}. skipping namespacing for this file.`);
            }

            const file_path_for_logging = package_info
               ? `${package_info.name}/${path.relative(package_info.root_path, normalized_id).split(path.sep).join('/')}`
               : path.relative(project_root_path, normalized_id).split(path.sep).join('/');

            if (verbose) {
               console.debug(`[${PLUGIN_NAME}] transform: processing ${file_path_for_logging}`);
            }

            let transformed_code: string = code;
            let source_map: string | undefined = undefined;
            let current_stage = 'initial';

            try {
               const warn_adapter: WarnCallback = (
                  message: string,
                  line_info?: {
                     line_index: number;
                     column: number;
                     length: number;
                     line_text: string;
                  }
               ) => {
                  let warning_text = `[${IFDEF_PLUGIN_NAME}] ${message}`;

                  if (line_info) {
                     warning_text += ` (at ${file_path_for_logging}:${line_info.line_index + 1}:${line_info.column})`;
                  }

                  this.warn(warning_text);
               };

               const file_metadata = new Map(
                  [...build_time_registry.metadata.entries()].filter(
                     ([_, meta]) => meta.file_path === normalized_id
                  )
               );

               if (enable_tddi) {
                  current_stage = 'tddi';

                  if (verbose) {
                     console.debug(`[${PLUGIN_NAME}] transform: applying tddi transforms to ${file_path_for_logging}`);
                  }

                  const tddi_result = await apply_tddi_transform(
                     transformed_code,
                     {
                        absolute_file_path: normalized_id,
                        project_root_path: project_root_path,
                        verbose: verbose,
                        underlying_name: TDDI_MARKER_PROP_NAME,
                        custom_generators: settings.tddi_custom_generators
                     }
                  );

                  if (tddi_result) {
                     transformed_code = tddi_result;

                     if (verbose) {
                        console.debug(`[${PLUGIN_NAME}] transform: applied tddi transforms to ${file_path_for_logging}`);
                     }
                  }
               }

               {
                  current_stage = 'ifdef';

                  const ifdef_log_vars = get_ifdef_log_variables(package_info?.name, log_ifdef_rules, default_log_ifdef_level_numeric);
                  const final_ifdef_settings: PluginLogicSettings = {
                     ...ifdef_logic_settings,
                     variables: {
                        ...ifdef_logic_settings.variables,
                        ...ifdef_log_vars,
                     }
                  };

                  transformed_code = format_content_stack(
                     transformed_code,
                     normalized_id,
                     final_ifdef_settings,
                     warn_adapter
                  );
               }

               if (
                  guerrero_build_mode !== 'analyze'
                  && enable_guerrero
                  && guerrero_strategy_instance
                  && file_metadata.size > 0
               ) {
                  current_stage = `guerrero (${guerrero_strategy_instance.constructor.name})`;

                  if (verbose) {
                     console.debug(`[${PLUGIN_NAME}] transform: applying guerrero codegen strategy '${guerrero_strategy_instance.constructor.name}' to ${file_path_for_logging}`);
                  }

                  const guerrero_result = await guerrero_strategy_instance.transform_source_code(
                     build_time_registry.layouts,
                     file_metadata,
                     transformed_code,
                     normalized_id
                  );

                  if (guerrero_result) {
                     const {
                        code: guerrero_code,
                        imports: local_imports,
                        internal_imports
                     } = guerrero_result;

                     transformed_code = guerrero_code;

                     const import_map = guerrero_strategy_instance.get_import_map();
                     const final_import_statements = generate_imports_from_names(local_imports as Set<ImportSpecifier>, import_map);

                     const absolute_internal_views_path = path.join(project_root_path, guerrero_internal_views_path);
                     let relative_internal_views_path = path.relative(path.dirname(normalized_id), absolute_internal_views_path).replace(/\\/g, '/').replace('.ts', '');

                     if (!relative_internal_views_path.startsWith('.')) {
                        relative_internal_views_path = `./${relative_internal_views_path}`;
                     }

                     const internal_import_statement = internal_imports.size > 0
                        ? `import { ${[...internal_imports].sort().join(', ')} } from '${relative_internal_views_path}';\n`
                        : '';

                     transformed_code = `${final_import_statements}\n${internal_import_statement}${transformed_code}`;

                     if (verbose) {
                        console.debug(`[${PLUGIN_NAME}] transform: applied guerrero codegen strategy '${guerrero_strategy_instance.constructor.name}' to ${file_path_for_logging}`);
                     }
                  }
               }

               if (
                  enable_namespacing
                  && package_info
               ) {
                  current_stage = 'logger-namespacing';
                  if (verbose) {
                     console.debug(`[${PLUGIN_NAME}] transform: applying swc transforms (namespacing) to: ${file_path_for_logging}`);
                  }

                  const relative_path_in_package_posix = path.relative(package_info.root_path, normalized_id)
                     .split(path.sep).join('/')
                     .replace(/\.[jt]sx?$/, '');

                  const is_debug_build = (ifdef_logic_settings.variables?.['DEBUG'] === true) || (process.env['DEBUG'] === 'true');

                  const source_map_relative_path = path.relative(project_root_path, normalized_id).split(path.sep).join('/');

                  const file_swc_print_options: swc.Options = {
                     ...SWC_PRINT_OPTIONS_BASE,
                     sourceFileName: source_map_relative_path,
                     sourceRoot: path.relative(path.dirname(normalized_id), project_root_path).split(path.sep).join('/') || '.',
                  };

                  const transform_options: NamespaceTransformOptions = {
                     absolute_file_path: normalized_id,
                     package_info: package_info,
                     relative_path_in_package: relative_path_in_package_posix,
                     use_readable_namespace: is_debug_build,
                     parser_options: SWC_PARSER_OPTIONS,
                     print_options: file_swc_print_options,
                     verbose: verbose
                  };

                  const swc_result = await apply_namespace_transform(transformed_code, transform_options);

                  transformed_code = swc_result.code;
                  source_map = swc_result.map;

                  if (verbose) {
                     console.debug(`[${PLUGIN_NAME}] transform: swc transforms applied to ${file_path_for_logging}`);
                  }
               } else if (enable_namespacing && !package_info) {
                  this.warn(`[${PLUGIN_NAME}] skipping namespacing for ${normalized_id} as package info could not be determined`);
               }

               if (
                  enable_log_filtering
                  && parsed_log_filter_settings
               ) {
                  current_stage = 'logger-filtering';
                  if (verbose) {
                     console.debug(`[${PLUGIN_NAME}] transform: applying swc transforms (log filtering) to: ${file_path_for_logging}`);
                  }

                  const log_filter_options: LogFilterTransformOptions = {
                     source_code: code,
                     absolute_file_path: normalized_id,
                     package_info: package_info,
                     project_root_path: project_root_path,
                     filter_settings: parsed_log_filter_settings,
                     parser_options: SWC_PARSER_OPTIONS,
                     print_options: {
                        ...SWC_PRINT_OPTIONS_BASE,
                        sourceFileName: path.relative(project_root_path, normalized_id).split(path.sep).join('/'),
                        sourceRoot: path.relative(path.dirname(normalized_id), project_root_path).split(path.sep).join('/') || '.',
                        sourceMaps: !!source_map,
                     },
                     verbose: options?.logger_verbose,
                  };

                  const filter_result = await apply_log_filter_transform(transformed_code, log_filter_options);

                  transformed_code = filter_result.code;
                  source_map = filter_result.map ?? source_map;
               }

               if (verbose) {
                  console.debug(`[${PLUGIN_NAME}] transform: completed for ${file_path_for_logging}`);
               }

               return {
                  code: transformed_code,
                  map: source_map ? JSON.parse(source_map) : undefined
               };
            } catch (e) {
               let error_message = `[${PLUGIN_NAME}] failed to process file ${file_path_for_logging} during stage: ${current_stage}`;

               if (e instanceof DirectiveError) {
                  error_message = `[${IFDEF_PLUGIN_NAME}] ${e.message}`;

                  if (
                     e.line != null
                     && e.line >= 0
                  ) {
                     error_message += ` (at ${file_path_for_logging}:${e.line + 1}:${e.column ?? 0})`;
                  }
               } else if (e instanceof Error) {
                  const formatted_error = await format_build_error(e);

                  error_message = `[${PLUGIN_NAME}] error processing ${file_path_for_logging}:\n${formatted_error}`;
               } else {
                  error_message = `[${PLUGIN_NAME}] unknown error processing ${file_path_for_logging}: ${String(e)}`;
               }

               this.error(error_message);

               throw new Error(error_message, { cause: e })
            }
         },
      };
   }
);

export default eldritch_builder_unplugin;