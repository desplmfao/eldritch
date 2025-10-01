/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-tddi/src/transform.ts
 */

import { default as path } from 'node:path';

import * as swc from '@swc/core';

import { default_logger } from '@eldritch-engine/logger/logger';

import type { ImportInfo } from '@eldritch-engine/type-utils/tddi/index';
import type { IInjectionGenerator } from '@eldritch-engine/type-utils/tddi/generator';

import { ImportVisitor } from '@self/swc/import_visitor';
import { TDDIVisitor } from '@self/swc/visitor';

import { generate_tddi_code } from '@self/codegen';
import { map_dist_to_src, SWC_PARSER_OPTIONS } from '@self/utils';

import { InjectionGeneratorRegistry } from '@self/generators/registry';

export interface TDDITransformOptions {
   absolute_file_path: string;
   project_root_path: string;
   verbose?: boolean;
   underlying_name: string;
   custom_generators?: IInjectionGenerator[];
}

export const parsed_file_cache = new Map<string, swc.Module>();

async function resolve_imports(
   visitor: ImportVisitor,
   file_path: string,
   project_root: string
): Promise<void> {
   const resolution_promises = visitor.imports.map(
      async (imp) => {
         try {
            const resolved = require.resolve(
               imp.source_path,
               {
                  paths: [
                     path.dirname(file_path),
                     project_root
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

         return imp;
      }
   );

   await Promise.all(resolution_promises);
}

export async function parse_file_cached(file_path: string): Promise<swc.Module> {
   if (parsed_file_cache.has(file_path)) {
      return parsed_file_cache.get(file_path)!;
   }

   const code = await Bun.file(file_path).text();
   const ast = await swc.parse(code, SWC_PARSER_OPTIONS);

   parsed_file_cache.set(file_path, ast);

   return ast;
}

export async function is_tddi_marker_type_recursive(
   type_name_to_check: string,
   source_ast: swc.Module,
   current_file_path: string,
   import_resolver: (name_to_resolve: string, from_file_path: string) => Promise<[new_type_name: string, new_ast: swc.Module, new_file_path: string] | null>,
   underlying_name: string,
   visited_aliases: Set<string> = new Set()
): Promise<boolean> {
   const visited_key = `${current_file_path}:${type_name_to_check}`;

   if (visited_aliases.has(visited_key)) {
      return false;
   }

   visited_aliases.add(visited_key);

   for (const item of source_ast.body) {
      if (
         item.type === 'ExportDeclaration' &&
         item.declaration.type === 'TsTypeAliasDeclaration'
      ) {
         const alias_decl = item.declaration;

         if (alias_decl.id.value === type_name_to_check) {
            const type_ann = alias_decl.typeAnnotation;

            if (type_ann.type === 'TsIntersectionType') {
               for (const intersection_member of type_ann.types) {
                  if (intersection_member.type === 'TsTypeLiteral') {
                     for (const member of intersection_member.members) {
                        if (
                           member.type === 'TsPropertySignature'
                           && member.key.type === 'Identifier'
                           && member.key.value === underlying_name
                           && member.typeAnnotation?.typeAnnotation.type === 'TsLiteralType'
                           && member.typeAnnotation.typeAnnotation.literal.type === 'BooleanLiteral'
                           && member.typeAnnotation.typeAnnotation.literal.value === true
                        ) {
                           return true;
                        }
                     }
                  }
               }
            }

            if (
               type_ann.type === 'TsTypeReference'
               && type_ann.typeName.type === 'Identifier'
            ) {
               const referenced_type_name = type_ann.typeName.value;
               const resolution = await import_resolver(referenced_type_name, current_file_path);

               if (resolution) {
                  const [next_type_name, next_ast, next_file_path] = resolution;

                  const result = await is_tddi_marker_type_recursive(
                     next_type_name,
                     next_ast,
                     next_file_path,
                     import_resolver,
                     underlying_name,
                     new Set(visited_aliases)
                  );

                  if (result) {
                     return true;
                  }
               }
            }
         }
      }
   }

   return false;
}

export async function is_tddi_marker_type(
   type_name: string,
   importer_file_path: string,
   importer_import_map: Map<string, ImportInfo>,
   underlying_name: string
): Promise<boolean> {
   const logger = default_logger.get_namespaced_logger('<namespace>');

   const import_resolver = async (
      name_to_resolve: string,
      from_file_path: string
   ): Promise<[string, swc.Module, string] | null> => {
      const import_info = importer_import_map.get(name_to_resolve);

      if (import_info?.resolved_source_path) {
         try {
            const next_ast = await parse_file_cached(import_info.resolved_source_path);
            const original_name = import_info.named_imports.find(i => i.local_name === name_to_resolve)?.original_name ?? name_to_resolve;

            return [original_name, next_ast, import_info.resolved_source_path];
         } catch (e) {
            logger.warn(`could not parse ast for '${name_to_resolve}' from path '${import_info.resolved_source_path}'`);

            return null;
         }
      }

      const current_ast = await parse_file_cached(from_file_path);

      return [
         name_to_resolve,
         current_ast,
         from_file_path
      ];
   };

   const initial_resolution = await import_resolver(type_name, importer_file_path);

   if (!initial_resolution) {
      return false;
   }

   const [
      initial_type_name,
      initial_ast,
      initial_file_path
   ] = initial_resolution;

   return await is_tddi_marker_type_recursive(initial_type_name, initial_ast, initial_file_path, import_resolver, underlying_name);
}

export async function apply_tddi_transform(
   code: string,
   options: TDDITransformOptions
): Promise<string | undefined> {
   const logger = default_logger.get_namespaced_logger('<namespace>');
   const { custom_generators } = options;

   try {
      const ast = await swc.parse(code, SWC_PARSER_OPTIONS);

      const import_visitor = new ImportVisitor();
      import_visitor.visitModule(ast);

      await resolve_imports(import_visitor, options.absolute_file_path, options.project_root_path);

      const valid_tddi_marker_names = new Set<string>();
      const temp_generator_registry = new InjectionGeneratorRegistry(custom_generators);
      const all_imported_names = new Set(import_visitor.imports_map.keys());

      for (const imported_name of all_imported_names) {
         if (temp_generator_registry.get(imported_name)) {
            if (
               await is_tddi_marker_type(
                  imported_name,
                  options.absolute_file_path,
                  import_visitor.imports_map,
                  options.underlying_name
               )
            ) {
               valid_tddi_marker_names.add(imported_name);
            }
         }
      }

      const tddi_visitor = new TDDIVisitor(import_visitor.imports_map, valid_tddi_marker_names, custom_generators);
      tddi_visitor.visitModule(ast);

      const collected_metadata = tddi_visitor.get_collected_metadata();

      if (Object.keys(collected_metadata).length === 0) {
         return;
      }

      const generated_code = generate_tddi_code(options.absolute_file_path, collected_metadata, import_visitor.imports_map);

      if (generated_code.trim() === '') {
         return;
      }

      return code + '\n' + generated_code;
   } catch (e) {
      {
         const message = `failed to process '${options.absolute_file_path}'\n${e.message}`;

         logger.critical(message);
         throw new Error(message, { cause: e });
      }
   }
}