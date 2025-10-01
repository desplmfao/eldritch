/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-ifdef/src/parser.ts
 */

import type { TokenParseResult, DirectiveToken, ContentToken } from '@self/types';

export class IfdefParser {
   reg_exp: RegExp;

   constructor(
      reg_exp: RegExp
   ) {
      this.reg_exp = reg_exp;
   }

   get_token_data(line: string): TokenParseResult | undefined {
      const match: RegExpMatchArray | null = line.match(this.reg_exp);

      if (match?.groups) {
         const token_str: string = match.groups['token'] ?? '';
         const expression_str: string = match.groups['expression']?.trim() ?? '';
         const column_idx: number = match.index ?? -1;
         const match_length: number = match[0].length ?? -1;

         return [
            token_str,
            expression_str,
            column_idx,
            match_length
         ];
      }

      return;
   }

   *parse(source_text: string): Generator<DirectiveToken | ContentToken, void, void> {
      const lines: string[] = source_text.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
         const line = lines[i]!;
         const token_data = this.get_token_data(line);

         if (token_data) {
            yield {
               type: 'directive',
               line_index: i,
               line_text: line,
               token_str: token_data[0],
               expression: token_data[1],
               column: token_data[2],
               length: token_data[3],
            };
         } else {
            yield {
               type: 'content',
               line_index: i,
               line_text: line,
            };
         }
      }
   }
}