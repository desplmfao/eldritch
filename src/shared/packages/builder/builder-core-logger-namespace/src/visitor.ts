/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-logger-namespace/src/visitor.ts
 */

import { Visitor } from '@swc/core/Visitor.js';

import { format_hash, hash_fnv1a } from '@eldritch-engine/utils/hash';

import type {
   ClassDeclaration,
   ClassMethod,
   FunctionDeclaration,
   CallExpression,
   Expression,
   Identifier,
   Argument,
   StringLiteral,
   TsType
} from '@swc/core';

import { NAMESPACE_PLACEHOLDER } from '@self/constants';

import type { PackageInfo } from '@self/types';

export class NamespaceVisitor extends Visitor {
   #current_class_name?: string;
   #current_method_name?: string;

   readonly #absolute_file_path: string;
   readonly #package_info: PackageInfo;
   readonly #relative_path_in_package: string;
   readonly #use_readable_namespace: boolean;

   constructor(
      absolute_file_path: string,
      package_info: PackageInfo,
      relative_path_in_package: string,
      use_readable_namespace: boolean
   ) {
      super();

      this.#absolute_file_path = absolute_file_path;
      this.#package_info = package_info;
      this.#relative_path_in_package = relative_path_in_package;
      this.#use_readable_namespace = use_readable_namespace;
   }

   override visitClassDeclaration(decl: ClassDeclaration): ClassDeclaration {
      const old_class_name = this.#current_class_name;
      this.#current_class_name = decl.identifier.value;

      const result: ClassDeclaration = super.visitClassDeclaration(decl) as ClassDeclaration;
      this.#current_class_name = old_class_name;

      return result;
   }

   override visitClassMethod(method: ClassMethod): ClassMethod {
      const old_method_name = this.#current_method_name;

      if (method.key.type === 'Identifier') {
         this.#current_method_name = method.key.value;
      } else if (method.key.type === 'StringLiteral') {
         this.#current_method_name = method.key.value;
      } else {
         this.#current_method_name = '[ComputedMethodName]';
      }

      const result: ClassMethod = super.visitClassMethod(method) as ClassMethod;
      this.#current_method_name = old_method_name;

      return result;
   }

   override visitFunctionDeclaration(decl: FunctionDeclaration): FunctionDeclaration {
      const old_method_name = this.#current_method_name;
      const old_class_name = this.#current_class_name;

      this.#current_method_name = decl.identifier?.value ?? '[AnonymousFunction]';
      this.#current_class_name = undefined;

      const result: FunctionDeclaration = super.visitFunctionDeclaration(decl) as FunctionDeclaration;

      this.#current_method_name = old_method_name;
      this.#current_class_name = old_class_name;

      return result;
   }

   override visitCallExpression(expr: CallExpression): Expression {
      if (expr.callee.type === 'MemberExpression') {
         const method_identifier = expr.callee.property as Identifier;

         if (
            method_identifier?.value === 'get_namespaced_logger'
            && expr.arguments.length >= 1
         ) {
            const first_arg: Argument = expr.arguments[0]!;
            const arg_expression: Expression = first_arg.expression;

            const class_part: string = this.#current_class_name ? `::${this.#current_class_name}` : '';
            const method_part: string = this.#current_method_name ? `::${this.#current_method_name}` : '::UnknownContext';

            const readable_base_namespace = `${this.#package_info.name}/${this.#relative_path_in_package}`;
            const readable_namespace_with_context = `${readable_base_namespace}${class_part}${method_part}`;

            let final_namespace: string;

            if (this.#use_readable_namespace) {
               final_namespace = readable_namespace_with_context;
            } else {
               const hash_input_string: string = readable_namespace_with_context;
               const hash_value: number = hash_fnv1a(hash_input_string);

               final_namespace = format_hash(hash_value);
            }

            let replaced: boolean = false;

            if (arg_expression.type === 'StringLiteral') {
               const original_value: string = arg_expression.value;

               if (original_value.includes(NAMESPACE_PLACEHOLDER)) {
                  const new_value: string = original_value.replace(NAMESPACE_PLACEHOLDER, final_namespace);

                  arg_expression.value = new_value;
                  arg_expression.raw = `'${new_value.replace(/'/g, "\\'")}'`;

                  replaced = true;
               }
            } else if (arg_expression.type === 'TemplateLiteral') {
               for (const quasi of arg_expression.quasis) {
                  const original_raw: string = quasi.raw;

                  if (!replaced && original_raw.includes(NAMESPACE_PLACEHOLDER)) {
                     const new_raw: string = original_raw.replace(NAMESPACE_PLACEHOLDER, final_namespace);

                     quasi.raw = new_raw;

                     if (quasi.cooked) {
                        quasi.cooked = new_raw;
                     }

                     replaced = true;

                     break;
                  }
               }
            }

            if (replaced) {
               return expr;
            }
         } else if (
            method_identifier?.value === 'set_enabled_namespaces'
            && !this.#use_readable_namespace
            && expr.arguments.length >= 1
         ) {
            const first_arg: Argument = expr.arguments[0]!;
            const arg_expression: Expression = first_arg.expression;

            if (arg_expression.type === 'ArrayExpression') {
               let modified_array: boolean = false;

               for (const element of arg_expression.elements) {
                  if (
                     element
                     && element.expression.type === 'StringLiteral'
                  ) {
                     const string_literal_node: StringLiteral = element.expression;
                     const readable_name_from_config: string = string_literal_node.value;

                     const hash_input_for_config: string = readable_name_from_config;

                     const hash_value: number = hash_fnv1a(hash_input_for_config);
                     const hashed_name: string = format_hash(hash_value);

                     string_literal_node.value = hashed_name;
                     string_literal_node.raw = `'${hashed_name.replace(/'/g, "\\'")}'`;

                     modified_array = true;
                  }
               }

               if (modified_array) {
                  return expr;
               }
            }
         }
      }

      return super.visitCallExpression(expr) as Expression;
   }

   override visitTsType(node: TsType): TsType {
      return node;
   }
}