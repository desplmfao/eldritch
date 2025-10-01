/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-logger-filter/src/visitor.ts
 */

import { default as path } from 'node:path';

import { Visitor } from '@swc/core/Visitor.js';
import type * as swc from '@swc/core';

import type { PackageInfo } from '@eldritch-engine/builder-core-logger-namespace/types';

import { LOG_LEVEL_MAP, PLUGIN_NAME } from '@self/constants';
import type { LogFilterSettings } from '@self/types';

export class LogFilterVisitor extends Visitor {
   readonly filter_settings: LogFilterSettings;
   readonly package_info: PackageInfo | undefined;
   readonly absolute_file_path: string;
   readonly project_root_path: string;
   readonly verbose: boolean;
   readonly source_code: string;

   ast_start_span: number = 0;

   constructor(
      filter_settings: LogFilterSettings,
      package_info: PackageInfo | undefined,
      absolute_file_path: string,
      project_root_path: string,
      source_code: string,
      verbose: boolean
   ) {
      super();

      this.filter_settings = filter_settings;
      this.package_info = package_info;
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

   get_base_namespace_for_file(): string {
      if (this.package_info) {
         const relative_path = path.relative(this.package_info.root_path, this.absolute_file_path)
            .split(path.sep).join('/')
            .replace(/\.[jt]sx?$/, '');

         return `${this.package_info.name}/${relative_path}`;
      }

      return path.relative(this.project_root_path, this.absolute_file_path)
         .split(path.sep).join('/')
         .replace(/\.[jt]sx?$/, '');
   }

   override visitModule(module: swc.Module): swc.Module {
      this.ast_start_span = module.span.start;

      return super.visitModule(module);
   }

   override visitCallExpression(expr: swc.CallExpression): swc.Expression {
      if (expr.callee.type === 'MemberExpression') {
         const member_expr = expr.callee;
         let log_method_name: string | undefined;

         if (member_expr.property.type === 'Identifier') {
            log_method_name = member_expr.property.value;
         }

         if (
            log_method_name
            && LOG_LEVEL_MAP.has(log_method_name)
         ) {
            const call_log_level_numeric = LOG_LEVEL_MAP.get(log_method_name)!;
            let namespace_for_call: string | undefined;

            if (
               member_expr.object.type === 'CallExpression'
               && member_expr.object.callee.type === 'MemberExpression'
               && member_expr.object.callee.property.type === 'Identifier'
               && member_expr.object.callee.property.value === 'get_namespaced_logger'
               && member_expr.object.arguments.length > 0
               && member_expr.object.arguments[0]?.expression.type === 'StringLiteral'
            ) {
               namespace_for_call = member_expr.object.arguments[0].expression.value;
            }

            else if (
               expr.arguments.length > 0
               && expr.arguments[0]?.expression.type === 'StringLiteral'
            ) {
               const first_arg_val = expr.arguments[0].expression.value;

               if (
                  first_arg_val.includes('::')
                  || first_arg_val.includes('/')
                  || first_arg_val.startsWith('@')
               ) {
                  namespace_for_call = first_arg_val;
               }
            }

            if (namespace_for_call == null) {
               namespace_for_call = this.get_base_namespace_for_file();
            }

            if (namespace_for_call != null) {
               let effective_filter_level = this.filter_settings.default_level_numeric;
               let matched_rule_info = `default (${this.filter_settings.default_level_numeric})`;

               for (const rule of this.filter_settings.rules) {
                  if (rule.pattern.test(namespace_for_call)) {
                     effective_filter_level = rule.level;
                     matched_rule_info = `rule '${rule.original_pattern}=${rule.original_level_string}' (level ${rule.level})`;

                     break;
                  }
               }

               if (this.verbose) {
                  const line_num = this.get_line_from_offset(expr.span.start);
                  const file_loc = path.relative(this.project_root_path, this.absolute_file_path);

                  console.debug(`[${PLUGIN_NAME}] ${file_loc}:${line_num}: log call ${log_method_name} (level ${call_log_level_numeric}) in namespace '${namespace_for_call}'. matched: ${matched_rule_info}. effective filter level: ${effective_filter_level}.`);
               }

               if (call_log_level_numeric < effective_filter_level) {
                  if (this.verbose) {
                     const line_num = this.get_line_from_offset(expr.span.start);
                     const file_loc = path.relative(this.project_root_path, this.absolute_file_path);

                     console.debug(`[${PLUGIN_NAME}] ${file_loc}:${line_num}: -> removing log call`);
                  }

                  return {
                     type: 'NullLiteral',
                     span: expr.span
                  };
               }
            }
         }
      }

      return super.visitCallExpression(expr);
   }

   override visitExpressionStatement(stmt: swc.ExpressionStatement): swc.Statement {
      const original_expression = stmt.expression;
      const visited_expr = this.visitExpression(original_expression);

      if (original_expression !== visited_expr) {
         stmt.expression = visited_expr;
      }

      return stmt;
   }

   override visitTsType(node: swc.TsType): swc.TsType {
      return node;
   }
}