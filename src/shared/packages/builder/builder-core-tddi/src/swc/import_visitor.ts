/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-tddi/src/swc/import_visitor.ts
 */

import { Visitor } from '@swc/core/Visitor.js';
import * as swc from '@swc/core';

import type { ImportInfo, ExportAllInfo, LocalExportInfo, ImportSpecifierInfo } from '@eldritch-engine/type-utils/tddi/index';

export class ImportVisitor extends Visitor {
   readonly imports: ImportInfo[] = [];
   readonly export_alls: ExportAllInfo[] = [];
   readonly local_exports: LocalExportInfo[] = [];

   #memoized_imports_map?: Map<string, ImportInfo>;

   /** provides a map of all imported local names to their source ImportInfo object */
   get imports_map(): Map<string, ImportInfo> {
      if (this.#memoized_imports_map) {
         return this.#memoized_imports_map;
      }

      const map = new Map<string, ImportInfo>();

      for (const import_info of this.imports) {
         if (import_info.default_import) {
            map.set(import_info.default_import.local_name, import_info);
         }

         if (import_info.namespace_import) {
            map.set(import_info.namespace_import.local_name, import_info);
         }

         for (const specifier of import_info.named_imports) {
            map.set(specifier.local_name, import_info);
         }
      }

      this.#memoized_imports_map = map;
      return this.#memoized_imports_map;
   }

   override visitImportDeclaration(
      decl: swc.ImportDeclaration
   ): swc.ImportDeclaration {
      const source_path = decl.source.value;
      const current_import: ImportInfo = {
         source_path: source_path,
         resolved_path: null,
         resolved_source_path: null,
         named_imports: [],
      };

      for (const specifier of decl.specifiers) {
         switch (specifier.type) {
            case 'ImportSpecifier': {
               const s: ImportSpecifierInfo = {
                  original_name: '',
                  local_name: specifier.local.value,
               };

               if (specifier.imported) {
                  if (specifier.imported.type === 'Identifier') {
                     s.original_name = specifier.imported.value;
                  } else {
                     s.original_name = specifier.imported.value;
                  }
               } else {
                  s.original_name = specifier.local.value;
               }

               current_import.named_imports.push(s);

               break;
            }

            case 'ImportDefaultSpecifier': {
               current_import.default_import = {
                  local_name: specifier.local.value,
               };

               break;
            }

            case 'ImportNamespaceSpecifier': {
               current_import.namespace_import = {
                  local_name: specifier.local.value,
               };

               break;
            }
         }
      }

      this.imports.push(current_import);

      return decl;
   }

   override visitExportDefaultDeclaration(
      decl: swc.ExportDefaultDeclaration
   ): swc.ExportDefaultDeclaration {
      this.local_exports.push({
         name: 'default'
      });

      return decl;
   }

   override visitExportDefaultExpression(
      expr: swc.ExportDefaultExpression
   ): swc.ExportDefaultExpression {
      this.local_exports.push({
         name: 'default'
      });

      return expr;
   }

   override visitExportAllDeclaration(
      decl: swc.ExportAllDeclaration
   ): swc.ExportAllDeclaration {
      this.export_alls.push({
         source_path: decl.source.value
      });

      return decl;
   }

   override visitTsType(
      node: swc.TsType
   ): swc.TsType {
      return node;
   }
}