/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-logger-filter/src/transform.ts
 */

import { default as path } from 'node:path';

import * as swc from '@swc/core';
import { Visitor } from '@swc/core/Visitor.js';

import { PLUGIN_NAME } from '@self/constants';
import type { LogFilterTransformOptions } from '@self/types';
import { LogFilterVisitor } from '@self/visitor';

class UnusedLoggerRemover extends Visitor {
   logger_declarations = new Set<string>();
   used_loggers = new Set<string>();
   is_collecting = true;

   readonly absolute_file_path: string;
   readonly project_root_path: string;
   readonly source_code: string;
   readonly verbose: boolean;
   ast_start_span: number = 0;

   constructor(
      absolute_file_path: string,
      project_root_path: string,
      source_code: string,
      verbose: boolean
   ) {
      super();
      this.absolute_file_path = absolute_file_path;
      this.project_root_path = project_root_path;
      this.source_code = source_code;
      this.verbose = verbose;
   }

   get_line_from_offset(offset: number): number {
      if (offset < 0) {
         return 1;
      }

      const relative_offset = offset - this.ast_start_span;
      const valid_offset = Math.min(relative_offset, this.source_code.length);

      let line_number = 1;

      for (let i = 0; i < valid_offset; i++) {
         if (this.source_code[i] === '\n') {
            line_number++;
         }
      }

      return line_number;
   }

   override visitModule(module: swc.Module): swc.Module {
      this.ast_start_span = module.span.start;

      this.is_collecting = true;
      super.visitModule(module);

      this.is_collecting = false;

      return super.visitModule(module);
   }

   override visitVariableDeclarator(decl: swc.VariableDeclarator): swc.VariableDeclarator {
      if (
         this.is_collecting &&
         decl.id.type === 'Identifier' &&
         decl.init?.type === 'CallExpression' &&
         decl.init.callee.type === 'MemberExpression' &&
         decl.init.callee.property.type === 'Identifier' &&
         decl.init.callee.property.value === 'get_namespaced_logger'
      ) {
         this.logger_declarations.add(decl.id.value);
      }

      return decl;
   }

   override visitCallExpression(expr: swc.CallExpression): swc.Expression {
      if (
         this.is_collecting &&
         expr.callee.type === 'MemberExpression' &&
         expr.callee.object.type === 'Identifier' &&
         this.logger_declarations.has(expr.callee.object.value)
      ) {
         this.used_loggers.add(expr.callee.object.value);
      }

      return super.visitCallExpression(expr);
   }

   override visitModuleItem(item: swc.ModuleItem): swc.ModuleItem {
      if (this.is_collecting) {
         return super.visitModuleItem(item);
      }

      if (item.type === 'ExportDeclaration' && item.declaration.type === 'VariableDeclaration') {
         const original_declarations = item.declaration.declarations;

         const filtered_declarations = original_declarations.filter(d => {
            if (d.id.type === 'Identifier') {
               const var_name = d.id.value;
               const is_unused_logger = this.logger_declarations.has(var_name) && !this.used_loggers.has(var_name);

               if (is_unused_logger && this.verbose) {
                  const line_num = this.get_line_from_offset(d.span.start);
                  const file_loc = path.relative(this.project_root_path, this.absolute_file_path);

                  console.debug(`[${PLUGIN_NAME}] ${file_loc}:${line_num}: -> removing unused exported logger declaration '${var_name}'`);
               }

               return !is_unused_logger;
            }

            return true;
         });

         if (filtered_declarations.length === 0) {
            return {
               type: 'EmptyStatement',
               span: item.span
            };
         }

         item.declaration.declarations = filtered_declarations;

         return item;
      }

      return super.visitModuleItem(item);
   }

   override visitStatement(stmt: swc.Statement): swc.Statement {
      if (this.is_collecting) {
         return super.visitStatement(stmt);
      }

      if (stmt.type === 'VariableDeclaration') {
         const original_declarations = stmt.declarations;

         const filtered_declarations = original_declarations.filter(d => {
            if (d.id.type === 'Identifier') {
               const var_name = d.id.value;
               const is_unused_logger = this.logger_declarations.has(var_name) && !this.used_loggers.has(var_name);

               if (is_unused_logger && this.verbose) {
                  const line_num = this.get_line_from_offset(d.span.start);
                  const file_loc = path.relative(this.project_root_path, this.absolute_file_path);

                  console.debug(`[${PLUGIN_NAME}] ${file_loc}:${line_num}: -> removing unused logger declaration '${var_name}'`);
               }

               return !is_unused_logger;
            }

            return true;
         });

         if (filtered_declarations.length === 0) {
            return {
               type: 'EmptyStatement',
               span: stmt.span
            };
         }

         stmt.declarations = filtered_declarations;

         return stmt;
      }

      return super.visitStatement(stmt);
   }

   override visitTsType(n: swc.TsType): swc.TsType {
      return n;
   }
}

export async function apply_log_filter_transform(
   code: string,
   options: LogFilterTransformOptions
): Promise<{ code: string; map?: string }> {
   const { verbose = false } = options;
   const file_path_for_logging = path.relative(options.project_root_path, options.absolute_file_path).split(path.sep).join('/');

   if (verbose) {
      console.debug(`[${PLUGIN_NAME}] applying log filter transform to: ${file_path_for_logging}`);
   }

   try {
      let ast: swc.Module = await swc.parse(code, options.parser_options);

      const log_filter_visitor = new LogFilterVisitor(
         options.filter_settings,
         options.package_info,
         options.absolute_file_path,
         options.project_root_path,
         options.source_code,
         verbose
      );

      ast = log_filter_visitor.visitModule(ast);

      // does nothing sometimes
      const unused_logger_remover = new UnusedLoggerRemover(
         options.absolute_file_path,
         options.project_root_path,
         options.source_code,
         verbose
      );

      const final_ast = unused_logger_remover.visitModule(ast);

      const print_result = await swc.print(final_ast, options.print_options);

      if (verbose) {
         console.debug(`[${PLUGIN_NAME}] log filter transform applied successfully to ${file_path_for_logging}`);
      }

      return print_result;
   } catch (e) {
      const message = `[${PLUGIN_NAME}] swc error during log filter transform for ${file_path_for_logging}: ${e.message}`;

      console.error(message, e.stack || e);
      throw new Error(message, { cause: e });
   }
}