/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-ifdef/src/types.ts
 */

/** settings controlling the ifdef logic behavior */
export interface PluginLogicSettings {
   verbose?: boolean;
   reg_exp?: RegExp;
   fill_with_spaces?: boolean;
   comment_out_lines?: boolean;
   comment_prefix?: string;
   variables?: Record<string, unknown>;
   strict?: boolean;
   expression_helpers?: Record<string, (...args: any[]) => any>;
}

/** represents the type of preprocessor directive token found */
export enum Token {
   If,
   Else,
   Elseif,
   Endif,
   //
   Warning,
   Error,
   //
   Ifdef,
   Ifndef,
   Elifdef,
   Elifndef,
   //
   Undef,
   Define,
   Pragma,
}

export type TokenParseResult = [
   token: string,
   expression: string,
   column: number,
   length: number
];

export interface PruningInfo {
   line: number;
   token: string;
   expression: string;
   result: boolean;
}

export interface BlockState {
   start_line: number;
   prune: boolean;
   done: boolean;
   has_else_branch: boolean;
   pruning_directive?: PruningInfo;
}

/** type for the warning callback function used by format_content_stack */
export type WarnCallback = (
   message: string,
   line_info?: {
      line_index: number,
      column: number,
      length: number,
      line_text: string,
   }
) => void;

/** custom error class for directive processing errors */
export class DirectiveError extends Error {
   line?: number;
   column?: number;
   length?: number;
   lineText?: string;
   file?: string;
   detail?: unknown;

   constructor(
      message: string,
      line?: number,
      location?: {
         column?: number;
         length?: number;
         lineText?: string;
         file?: string;
      },
      detail?: unknown,
   ) {
      super(message);

      this.name = 'DirectiveError';
      this.line = line;
      this.column = location?.column;
      this.length = location?.length;
      this.lineText = location?.lineText;
      this.file = location?.file;
      this.detail = detail;
   }
}

export interface DirectiveToken {
   type: 'directive';
   line_index: number;
   line_text: string;
   token_str: string;
   expression: string;
   column: number;
   length: number;
}

export interface ContentToken {
   type: 'content';
   line_index: number;
   line_text: string;
}

export interface KeepAction {
   type: 'KEEP';
   content: string;
}

export interface PruneAction {
   type: 'PRUNE';
   line_text: string;
}

export interface PassAction {
   type: 'PASS';
   content: string;
}