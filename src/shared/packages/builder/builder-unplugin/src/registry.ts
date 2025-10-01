/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-unplugin/src/registry.ts
 */

import { default as path } from 'node:path';
import { default as fs } from 'node:fs/promises';

import * as swc from '@swc/core';

import { default_logger } from '@eldritch-engine/logger/logger';

import type { ImportInfo } from '@eldritch-engine/type-utils/tddi/index';
import type { MetadataClassExtracted, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { IBuildTimeRegistry } from '@eldritch-engine/type-utils/builder/registry';
import type { ITypeResolver } from '@eldritch-engine/type-utils/builder/resolver';
import { FileOrigin } from '@eldritch-engine/type-utils/builder/origin';

import { ImportVisitor } from '@eldritch-engine/builder-core-tddi/swc/import_visitor';
import { map_dist_to_src } from '@eldritch-engine/builder-core-tddi/utils';
import { is_tddi_marker_type_recursive } from '@eldritch-engine/builder-core-tddi/transform';

import { ReflectMetadataVisitor } from '@eldritch-engine/guerrero-core/visitors/reflect_metadata_visitor';

import { SchemaLayoutCalculator } from '@eldritch-engine/guerrero-core/layout/calculator';

import { find_source_files_recursive } from '@eldritch-engine/utils/misc';

const SWC_PARSER_OPTIONS: swc.ParseOptions = {
   syntax: 'typescript',
   tsx: false,
   decorators: true,
   dynamicImport: true,
};

export class BuildTimeRegistry implements IBuildTimeRegistry {
   readonly project_root_path: string;
   readonly source_roots: readonly string[];

   calculator!: SchemaLayoutCalculator;
   resolver!: ITypeResolver;

   readonly asts = new Map<string, swc.Module>();
   readonly import_maps = new Map<string, Map<string, ImportInfo>>();
   readonly metadata = new Map<string, MetadataClassExtracted>();
   readonly layouts = new Map<string, SchemaLayout>();
   readonly aliases = new Map<string, string>();
   readonly tddi_marker_cache = new Map<string, boolean>();
   readonly enum_definitions = new Map<string, Map<string, number>>();
   readonly #file_origins = new Map<string, FileOrigin>();

   readonly generated_internal_views = new Map<
      string,
      {
         code: string;
         imports: Set<string>;
         internal_dependencies?: Set<string>;
      }
   >();

   constructor(
      project_root_path: string,
      source_roots?: readonly string[]
   ) {
      this.project_root_path = project_root_path;
      this.source_roots = source_roots ?? [path.join(project_root_path, 'src')];
   }

   async analyze_project(
      options: {
         verbose?: boolean,
         guerrero_internal_views_path?: string,
         scope_to_dirs?: readonly string[],
         files_to_analyze?: readonly string[],
      }
   ): Promise<void> {
      const { verbose = false, guerrero_internal_views_path, scope_to_dirs, files_to_analyze } = options;
      const logger = default_logger.get_namespaced_logger('<namespace>');

      let source_files: string[];

      if (files_to_analyze) {
         source_files = [...new Set(files_to_analyze)];

         logger.info(`analyzing ${source_files.length} source files from discovered dependency graph...`);
      } else {
         const dirs_to_scan = scope_to_dirs ?? this.source_roots;
         const source_files_promises = dirs_to_scan.map(dir => find_source_files_recursive(dir, ['.ts', '.tsx']));
         const source_files_nested = await Promise.all(source_files_promises);

         source_files = [...new Set(source_files_nested.flat())];

         logger.info(`analyzing ${source_files.length} source files from ${dirs_to_scan.length} scoped root(s)...`);
      }

      if (
         'process' in global
         && process.env.NODE_ENV !== 'test'
      ) {
         const test_file_regex = /[\\\/]tests[\\\/]/;
         const original_count = source_files.length;
         source_files = source_files.filter(file_path => !test_file_regex.test(file_path));

         if (
            verbose
            && original_count > source_files.length
         ) {
            logger.info(`non test environment detected. filtering out ${original_count - source_files.length} test files from analysis`);
         }
      }

      for (const file_path of source_files) {
         try {
            const original_code = await fs.readFile(file_path, 'utf-8');
            const code = original_code.replace(/\r\n/g, '\n').replace(/\t/g, '   ');
            const ast = await swc.parse(code, SWC_PARSER_OPTIONS);
            const normalized_file_path = file_path.split(path.sep).join('/');

            this.asts.set(normalized_file_path, ast);

            const import_visitor = new ImportVisitor();
            import_visitor.visitModule(ast);

            await this.#resolve_imports(import_visitor, file_path);
            this.import_maps.set(normalized_file_path, import_visitor.imports_map);

            let origin: FileOrigin;

            const absolute_internal_views_path = guerrero_internal_views_path
               ? path.resolve(this.project_root_path, guerrero_internal_views_path).split(path.sep).join('/')
               : null;

            if (
               absolute_internal_views_path
               && normalized_file_path === absolute_internal_views_path
            ) {
               origin = FileOrigin.Generated;
            } else if (normalized_file_path.startsWith(this.source_roots[0]?.split(path.sep).join('/')!)) {
               origin = FileOrigin.User;
            } else {
               origin = FileOrigin.Engine;
            }

            this.#file_origins.set(normalized_file_path, origin);

            const metadata_visitor = new ReflectMetadataVisitor(
               code,
               import_visitor.imports_map,
               normalized_file_path,
               (message: string) => console.warn(`warning in ${file_path}: ${message}`),
               (message: string) => logger.trace(message),
               verbose,
               origin
            );

            metadata_visitor.visitModule(ast);

            const collected_aliases_in_file = metadata_visitor.get_collected_aliases();

            for (const [alias_name, target_type] of collected_aliases_in_file) {
               this.register_type_alias(alias_name, target_type);

               if (verbose) {
                  logger.info(`[registry] registered type alias: '${alias_name}' -> '${target_type}'`);
               }
            }

            const collected_metadata_in_file = metadata_visitor.get_collected_metadata();

            let reflectable_in_file = 0;
            let enums_in_file = 0;

            for (const [class_name, new_metadata] of collected_metadata_in_file) {
               const existing_metadata = this.metadata.get(class_name);

               if (existing_metadata) {
                  const is_new_from_test = new_metadata.file_path.includes('/tests/');
                  const is_existing_from_test = existing_metadata.file_path.includes('/tests/');

                  if (
                     !is_existing_from_test
                     && is_new_from_test
                  ) {
                     continue;
                  }

                  if (!is_new_from_test) {
                     logger.warn(`duplicate reflectable class name found: '${class_name}'. the last one analyzed will be used`);
                  }
               }

               this.metadata.set(class_name, new_metadata);

               if (new_metadata.is_reflectable) {
                  reflectable_in_file++;
               } else if (new_metadata.definition_type === 'enum') {
                  enums_in_file++;
               }

               if (
                  new_metadata.definition_type === 'enum'
                  && new_metadata.enum_members
               ) {
                  const member_map = new Map<string, number>();

                  for (const member of new_metadata.enum_members) {
                     member_map.set(member.name, member.value);
                  }

                  this.enum_definitions.set(class_name, member_map);
               }
            }

            if (
               verbose
               && (
                  reflectable_in_file > 0
                  || enums_in_file > 0
               )
            ) {
               logger.info(`[registry] processed '${path.relative(this.project_root_path, file_path)}': found ${reflectable_in_file} reflectable(s), ${enums_in_file} enum(s)`);
            }
         } catch (e) {
            throw new Error(`failed to analyze file ${file_path}`, { cause: e });
         }
      }

      for (const metadata of this.metadata.values()) {
         if (metadata.alias_for) {
            this.register_type_alias(metadata.class_name, metadata.alias_for);

            if (verbose) {
               logger.info(`registered alias: '${metadata.class_name}' -> '${metadata.alias_for}'`);
            }
         }
      }

      let total_reflectable_found = 0;
      let total_enums_found = 0;

      for (const meta of this.metadata.values()) {
         if (meta.is_reflectable) {
            total_reflectable_found++;
         } else if (meta.definition_type === 'enum') {
            total_enums_found++;
         }
      }

      logger.info(`analysis complete. found ${total_reflectable_found} reflectable classes and ${total_enums_found} enums`);
   }

   async #resolve_imports(visitor: ImportVisitor, file_path: string): Promise<void> {
      const resolution_promises = visitor.imports.map(
         async (imp) => {
            try {
               const resolved = require.resolve(
                  imp.source_path,
                  {
                     paths: [
                        path.dirname(file_path),
                        ...this.source_roots,
                        this.project_root_path,
                     ]
                  }
               );

               imp.resolved_path = resolved;
               imp.resolved_source_path = map_dist_to_src(resolved);
            } catch (e) {
               if (imp.source_path.startsWith('.')) {
                  console.warn(`could not resolve import '${imp.source_path}' in '${file_path}'`);
               }
            }
         }
      );

      await Promise.all(resolution_promises);
   }

   get_file_origin(file_path: string): FileOrigin | undefined {
      return this.#file_origins.get(file_path);
   }

   get_type_origin(type_name: string): FileOrigin | undefined {
      return this.metadata.get(type_name)?.origin;
   }

   get_class_metadata(class_name: string): MetadataClassExtracted | undefined {
      return this.metadata.get(class_name);
   }

   get_schema_layout(type_name: string): SchemaLayout | undefined {
      if (this.layouts.has(type_name)) {
         return this.layouts.get(type_name);
      }

      if (this.calculator.currently_calculating.has(type_name)) {
         return {
            class_name: type_name,
            total_size: -1, // sentinel value for proxy
            alignment: -1,
            properties: [],
            has_dynamic_data: true,
         };
      }

      const metadata = this.get_class_metadata(type_name);

      if (!metadata) {
         return;
      }

      if (
         metadata.alias_for
         && metadata.alias_mode !== 'extend'
      ) {
         const resolved = this.resolver.resolve(metadata.alias_for);

         if (resolved.schema_layout) {
            const alias_schema = {
               ...resolved.schema_layout,
               class_name: type_name
            };

            this.layouts.set(type_name, alias_schema);

            return alias_schema;
         }

         console.warn(`resolver failed to produce a schema for alias target '${metadata.alias_for}' of '${type_name}'`);

         return;
      }

      const layout = this.calculator.calculate_schema_layout(type_name, metadata);

      if (layout.total_size !== -1) {
         this.layouts.set(type_name, layout);
      }

      return layout;
   }

   register_type_alias(alias_name: string, target_type_string: string): void {
      this.aliases.set(alias_name, target_type_string);
   }

   get_type_alias_target(alias_name: string): string | undefined {
      return this.aliases.get(alias_name);
   }

   async is_tddi_marker(
      type_name_to_check: string,
      import_info_for_type: ImportInfo,
      underlying_name: string
   ): Promise<boolean> {
      const cache_key = `${type_name_to_check}:${import_info_for_type.resolved_source_path}`;

      if (this.tddi_marker_cache.has(cache_key)) {
         return this.tddi_marker_cache.get(cache_key)!;
      }

      if (!import_info_for_type.resolved_source_path) {
         this.tddi_marker_cache.set(cache_key, false);

         return false;
      }

      const source_file_ast = this.asts.get(import_info_for_type.resolved_source_path);

      if (!source_file_ast) {
         console.warn(`ast not found for tddi marker check: ${import_info_for_type.resolved_source_path}`);

         this.tddi_marker_cache.set(cache_key, false);

         return false;
      }

      const import_resolver = async (
         name_to_resolve: string,
         from_file_path: string
      ): Promise<[string, swc.Module, string] | null> => {
         const import_map = this.import_maps.get(from_file_path);
         const found_import = import_map?.get(name_to_resolve);

         if (found_import?.resolved_source_path) {
            const next_ast = this.asts.get(found_import.resolved_source_path);

            if (next_ast) {
               const original_name = found_import.named_imports.find(i => i.local_name === name_to_resolve)?.original_name ?? name_to_resolve;

               return [original_name, next_ast, found_import.resolved_source_path];
            }
         }

         const current_ast = this.asts.get(from_file_path);

         return current_ast ? [name_to_resolve, current_ast, from_file_path] : null;
      };

      const original_name = import_info_for_type.named_imports.find(i => i.local_name === type_name_to_check)?.original_name ?? type_name_to_check;

      const result = await is_tddi_marker_type_recursive(
         original_name,
         source_file_ast,
         import_info_for_type.resolved_source_path,
         import_resolver,
         underlying_name
      );

      this.tddi_marker_cache.set(cache_key, result);

      return result;
   }
}