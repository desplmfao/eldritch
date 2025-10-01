/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-ifdef/src/processor.ts
 */

import {
   DirectiveError,
   Token,
   type BlockState,
   type PruningInfo,
   type PluginLogicSettings,
   type WarnCallback,
   type DirectiveToken,
   type ContentToken,
   type PruneAction,
   type KeepAction,
   type PassAction,
} from '@self/types';

import { PLUGIN_NAME } from '@self/constants';

export class IfdefProcessor {
   readonly settings: PluginLogicSettings;
   readonly file_path: string;
   readonly warn_fn: WarnCallback;

   readonly file_variables: Record<string, unknown>;
   readonly stack: BlockState[] = [];

   constructor(
      settings: PluginLogicSettings,
      file_path: string,
      warn_fn: WarnCallback,
   ) {
      this.settings = settings;
      this.file_path = file_path;
      this.warn_fn = warn_fn;

      const initial_vars: Record<string, unknown> = {
         ...process.env
      };

      this.file_variables = {
         ...initial_vars,
         ...(this.settings.variables ?? {})
      };
   }

   *process(
      tokens: Generator<DirectiveToken | ContentToken, void, void>
   ): Generator<KeepAction | PruneAction | PassAction, void, void> {
      for (const token of tokens) {
         if (token.type === 'content') {
            const is_overall_pruning: boolean = this.stack.some(block => block.prune);

            if (is_overall_pruning) {
               yield {
                  type: 'PRUNE',
                  line_text: token.line_text
               };
            } else {
               yield {
                  type: 'KEEP',
                  content: token.line_text
               };
            }
         } else if (token.type === 'directive') {
            this.process_directive(token);

            yield {
               type: 'PRUNE',
               line_text: token.line_text
            };
         }
      }

      if (this.stack.length > 0) {
         const unclosed_block: BlockState = this.stack[0]!;

         throw new DirectiveError(`unterminated #if block that started on line ${unclosed_block.start_line}`, unclosed_block.start_line - 1, { file: this.file_path });
      }
   }

   process_directive(
      token: DirectiveToken
   ): void {
      const { line_index, line_text, token_str, expression, column, length } = token;

      const location_info = {
         column,
         length,
         lineText: line_text,
         file: this.file_path
      };

      let token_enum: Token;

      try {
         token_enum = this.get_token_enum(token_str);
      } catch (e) {
         throw new DirectiveError(e instanceof Error ? e.message : String(e), line_index, location_info);
      }

      const is_overall_pruning: boolean = this.stack.some(block => block.prune);
      const current_eval_context: Readonly<Record<string, unknown>> = Object.freeze({ ...this.file_variables });
      const current_block: BlockState | null = this.stack.length > 0 ? this.stack[this.stack.length - 1]! : null;
      const is_outer_pruning: boolean = this.stack.length > 1 ? this.stack.slice(0, -1).some(b => b.prune) : false;

      const create_pruning_info = (result: boolean): PruningInfo => ({
         line: line_index + 1,
         token: token_str,
         expression: expression,
         result: result,
      });

      switch (token_enum) {
         case Token.If:
         case Token.Ifdef:
         case Token.Ifndef: {
            let condition_result: boolean;
            let pruning_info: PruningInfo | undefined;

            try {
               if (token_enum === Token.If) {
                  condition_result = this.eval_expression(expression, line_index, current_eval_context);
               } else {
                  condition_result = this.check_defined(expression, line_index, this.file_variables);

                  if (token_enum === Token.Ifndef) {
                     condition_result = !condition_result;
                  }
               }
               pruning_info = create_pruning_info(condition_result);
            } catch (e) {
               throw new DirectiveError(
                  e instanceof Error ? e.message : String(e),
                  line_index,
                  location_info,
                  e instanceof Error ? e.stack : e
               );
            }

            const new_block_prune: boolean = is_overall_pruning
               || !condition_result;

            this.stack.push({
               start_line: line_index + 1,
               prune: new_block_prune,
               done: condition_result,
               has_else_branch: false,
               pruning_directive: new_block_prune
                  && !is_overall_pruning ? pruning_info : undefined,
            });

            break;
         }

         case Token.Elseif:
         case Token.Elifdef:
         case Token.Elifndef: {
            if (!current_block) {
               throw new DirectiveError(`misplaced #${token_str} directive`, line_index, location_info);
            }

            if (current_block.has_else_branch) {
               throw new DirectiveError(`misplaced #${token_str} after #else`, line_index, location_info);
            }

            const was_block_pruning_before_directive = current_block.prune;
            let condition_result = false;
            let pruning_info: PruningInfo | undefined;

            if (!is_outer_pruning && !current_block.done) {
               try {
                  if (token_enum === Token.Elseif) {
                     condition_result = this.eval_expression(expression, line_index, current_eval_context);
                  } else {
                     condition_result = this.check_defined(expression, line_index, this.file_variables);

                     if (token_enum === Token.Elifndef) {
                        condition_result = !condition_result;
                     }
                  }

                  pruning_info = create_pruning_info(condition_result);
               } catch (e) {
                  throw new DirectiveError(
                     e instanceof Error ? e.message : String(e),
                     line_index,
                     location_info,
                     e instanceof Error ? e.stack : e
                  );
               }
            } else {
               pruning_info = create_pruning_info(condition_result);
            }

            const should_branch_be_active = !is_outer_pruning
               && !current_block.done
               && condition_result;

            current_block.prune = !should_branch_be_active;

            if (should_branch_be_active) {
               current_block.done = true;
               current_block.pruning_directive = undefined;
            } else {
               if (
                  !was_block_pruning_before_directive
                  && current_block.prune
                  && !is_outer_pruning
               ) {
                  current_block.pruning_directive = pruning_info ?? create_pruning_info(false);
               }
            }

            break;
         }

         case Token.Else: {
            if (!current_block) {
               throw new DirectiveError('misplaced #else directive', line_index, location_info);
            }

            if (current_block.has_else_branch) {
               throw new DirectiveError('multiple #else directives in the same #if block', line_index, location_info);
            }

            if (expression) {
               throw new DirectiveError('#else directive cannot have an expression', line_index, location_info);
            }

            const was_block_pruning_before_directive = current_block.prune;
            const should_branch_be_active = !is_outer_pruning && !current_block.done;

            current_block.prune = !should_branch_be_active;
            current_block.done = true;
            current_block.has_else_branch = true;

            const pruning_info: PruningInfo = {
               line: line_index + 1,
               token: token_str,
               expression: '',
               result: !should_branch_be_active
            };

            if (
               !was_block_pruning_before_directive
               && current_block.prune
               && !is_outer_pruning
            ) {
               current_block.pruning_directive = pruning_info;
            } else if (should_branch_be_active) {
               current_block.pruning_directive = undefined;
            }

            break;
         }

         case Token.Endif: {
            if (!current_block) {
               throw new DirectiveError('misplaced #endif directive', line_index, location_info);
            }

            if (expression) {
               throw new DirectiveError('#endif directive cannot have an expression', line_index, location_info);
            }

            this.stack.pop();

            break;
         }

         case Token.Define: {
            if (!expression) {
               throw new DirectiveError('#define directive requires a variable name', line_index, location_info);
            }

            const first_space = expression.indexOf(' ');
            const var_name = first_space === -1 ? expression : expression.substring(0, first_space);
            const value_str = first_space === -1 ? '' : expression.substring(first_space + 1).trim();

            if (!this.validate_var_name(var_name)) {
               throw new DirectiveError(`invalid variable name "${var_name}" for #define`, line_index, location_info);
            }

            if (!is_overall_pruning) {
               let defined_value: unknown = true;

               if (value_str) {
                  if (value_str === 'true') {
                     defined_value = true;
                  }

                  else if (value_str === 'false') {
                     defined_value = false;
                  }

                  else if (
                     !Number.isNaN(Number.parseFloat(value_str))
                     && Number.isFinite(Number(value_str))
                  ) {
                     defined_value = Number(value_str);
                  }

                  else if (
                     (
                        value_str.startsWith('"')
                        && value_str.endsWith('"')
                     )
                     || (
                        value_str.startsWith("'")
                        && value_str.endsWith("'")
                     )
                  ) {
                     defined_value = value_str.slice(1, -1);
                  }

                  else {
                     defined_value = value_str;
                  }
               }

               this.file_variables[var_name] = defined_value;
            }

            break;
         }

         case Token.Undef: {
            if (!expression) {
               throw new DirectiveError('#undef directive requires a variable name', line_index, location_info);
            }

            if (!this.validate_var_name(expression)) {
               throw new DirectiveError(`invalid variable name "${expression}" for #undef`, line_index, location_info);
            }

            if (!is_overall_pruning) {
               delete this.file_variables[expression];
            }

            break;
         }

         case Token.Warning:
         case Token.Error: {
            if (!is_overall_pruning) {
               this.handle_message_token(token_str, expression, line_index, column, length, line_text, token_enum as (Token.Warning | Token.Error));
            }

            break;
         }

         case Token.Pragma: {
            // no-op
            break;
         }

         default: {
            throw new DirectiveError(`internal error: unhandled token ${token_str}`, line_index, location_info);
         }
      }
   }

   get_token_enum(
      token_string: string
   ): Token {
      switch (token_string.toLowerCase()) {
         case 'if': return Token.If;
         case 'else': return Token.Else;
         case 'elseif':
         case 'elif': return Token.Elseif;
         case 'endif': return Token.Endif;
         case 'warning':
         case 'warn': return Token.Warning;
         case 'error':
         case 'err': return Token.Error;
         case 'ifdef': return Token.Ifdef;
         case 'ifndef': return Token.Ifndef;
         case 'elifdef': return Token.Elifdef;
         case 'elifndef': return Token.Elifndef;
         case 'undef': return Token.Undef;
         case 'define': return Token.Define;
         case 'pragma': return Token.Pragma;

         default: {
            throw new Error(`unsupported directive token: ${token_string}`);
         }
      }
   }

   handle_message_token(
      token_str: string,
      message_text: string,
      line_index: number,
      column: number,
      length: number,
      line_text: string,
      token_enum: Token.Warning | Token.Error,
   ): void {
      const line_info = { line_index, column, length, line_text };

      switch (token_enum) {
         case Token.Warning: {
            this.warn_fn(message_text || `directive warning (#${token_str})`, line_info);

            break;
         }
         case Token.Error: {
            throw new DirectiveError(
               message_text || `directive error (#${token_str})`,
               line_index,
               {
                  column,
                  length,
                  lineText: line_text
               }
            );
         }
      }
   }

   validate_var_name(var_name: string): boolean {
      return !!var_name
         && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(var_name);
   }

   check_defined(
      var_name: string,
      line_index: number,
      variables: Readonly<Record<string, unknown>>
   ): boolean {
      if (!this.validate_var_name(var_name)) {
         throw new Error(`invalid variable name ${JSON.stringify(var_name)}`);
      }

      return Object.prototype.hasOwnProperty.call(variables, var_name);
   }

   eval_expression(
      expression: string,
      line_index: number,
      variables: Readonly<Record<string, unknown>>
   ): boolean {
      const {
         verbose = false,
         strict = false,
         expression_helpers = {}
      } = this.settings;

      if (!expression) {
         throw new Error('directive requires a non-empty expression');
      }

      const line_num: number = line_index + 1;

      const helper_defined = (var_name: unknown): boolean => {
         if (typeof var_name !== 'string') {
            throw new TypeError(`invalid argument passed to defined(): expected string, got ${typeof var_name} (${JSON.stringify(var_name)})`);
         }

         try {
            return this.check_defined(var_name, line_index, variables);
         } catch (e) {
            throw new TypeError(`invalid variable name passed to defined(): ${JSON.stringify(var_name)}`);
         }
      };

      const helper_env = (
         var_name: unknown,
         default_value?: unknown
      ): unknown => {
         if (typeof var_name !== 'string') {
            throw new TypeError(`invalid variable name passed to env(): expected string, got ${typeof var_name} (${JSON.stringify(var_name)})`);
         }

         if (!this.validate_var_name(var_name)) {
            throw new TypeError(`invalid variable name passed to env(): ${JSON.stringify(var_name)}`);
         }

         if (Object.prototype.hasOwnProperty.call(variables, var_name)) {
            return variables[var_name];
         }

         if (Object.prototype.hasOwnProperty.call(process.env, var_name)) {
            return process.env[var_name];
         }

         return default_value;
      };

      const built_in_helpers: Readonly<Record<string, Function>> = Object.freeze({
         defined: helper_defined,
         env: helper_env,
      });

      const context: Record<string, unknown> = { ...variables };

      for (const name in expression_helpers) {
         if (Object.prototype.hasOwnProperty.call(expression_helpers, name)) {
            const helper_func: Function = expression_helpers[name]!;

            if (Object.prototype.hasOwnProperty.call(built_in_helpers, name)) {
               if (verbose) {
                  console.warn(`[${PLUGIN_NAME}] warning: custom expression helper "${name}" conflicts with a built-in helper and will be ignored`);
               }
            } else {
               if (Object.prototype.hasOwnProperty.call(variables, name)) {
                  if (verbose) {
                     console.warn(`[${PLUGIN_NAME}] warning: custom expression helper "${name}" overrides variable with the same name`);
                  }
               }

               context[name] = helper_func;
            }
         }
      }

      Object.assign(context, built_in_helpers);

      const arg_names: string[] = [...Object.keys(context), '__FILE__', '__LINE__'];
      const arg_values: unknown[] = [...Object.values(context), this.file_path, line_num];
      const function_body: string = `${strict ? '"use strict"; ' : ''}return Boolean(${expression});`;

      try {
         const func: Function = new Function(...arg_names, function_body);
         const result = func(...arg_values);

         if (verbose) {
            console.debug(`[${PLUGIN_NAME}] expression "${expression}" at ${this.file_path}:${line_num} evaluated to ${!!result} (strict mode: ${strict})`);
         }

         return !!result;
      } catch (e) {
         if (
            !strict
            && e instanceof ReferenceError
         ) {
            if (verbose) {
               console.debug(`[${PLUGIN_NAME}] expression "${expression}" at ${this.file_path}:${line_num} had ReferenceError in non-strict mode, evaluating to false`);
            }

            return false;
         }

         let message: string = `failed to evaluate expression "${expression}" at ${this.file_path}:${line_num}`;

         if (
            strict
            && e instanceof ReferenceError
         ) {
            message += `: ${e.message} (strict mode violation)`;
         }

         else if (e instanceof Error) {
            message += `: ${e.message}`;
         }

         else {
            message += `: ${String(e)}`;
         }

         const error_to_throw: Error = e instanceof Error ? e : new Error(String(e));
         error_to_throw.message = message;

         throw error_to_throw;
      }
   }
}