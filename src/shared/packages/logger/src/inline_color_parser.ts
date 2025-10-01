/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/logger/src/inline_color_parser.ts
 */

import type { StyleInfo } from '@eldritch-engine/type-utils/logger/index';

import type { AssembleAnsi } from '@self/ansi';

export class InlineColorParser {
   #assembler: AssembleAnsi;
   #ansi_enabled: boolean;

   constructor(
      assembler: AssembleAnsi,
      ansi_enabled: boolean = true
   ) {
      this.#assembler = assembler;
      this.#ansi_enabled = ansi_enabled;
   }

   extract_token(
      message: string,
      start: number
   ): {
      token: string;
      new_index: number;
      found_closing: boolean;
   } {
      let token = '';
      let i = start;
      let found_closing = false;

      const len = message.length;

      while (i < len) {
         const char = message[i];

         if (char === '\\' && i + 1 < len && message[i + 1] === '%') {
            token += '%';
            i += 2;

            continue;
         }

         if (char === '%') {
            found_closing = true;

            break;
         }

         token += char;
         i++;
      }

      const new_index = found_closing ? i + 1 : i;

      return {
         token,
         new_index,
         found_closing
      };
   }

   collect_literal(
      message: string,
      start: number
   ): {
      literal: string;
      new_index: number;
   } {
      let i = start;
      let literal = '';

      const len = message.length;

      while (i < len) {
         const char = message[i];

         if (char === '\\' || char === '%') {
            break;
         }

         literal += char;
         i++;
      }

      return {
         literal,
         new_index: i
      };
   }

   handle_token(
      message: string,
      i: number,
      current_style?: StyleInfo
   ): {
      output: string;
      new_index: number;
      new_style?: StyleInfo;
   } {
      const { token, new_index, found_closing } = this.extract_token(message, i + 1);
      let output = '';
      let new_style = current_style;

      if (!found_closing) {
         output = '%';

         return {
            output,
            new_index: i + 1,
            new_style
         };
      }

      if (current_style) {
         if (this.#ansi_enabled) {
            output += current_style.style.close;
         }

         new_style = undefined;
      }

      const style = this.#assembler.styles.get(token);

      if (style) {
         if (this.#ansi_enabled) {
            output += style.open;
         }

         new_style = {
            key: token,
            style
         };
      } else {
         output += `%${token}%`;
      }

      return {
         output,
         new_index,
         new_style
      };
   }

   parse(message: string): string {
      let result = '';
      let current_style: StyleInfo | undefined = undefined;
      let i = 0;

      const len = message.length;

      while (i < len) {
         const char = message[i];

         if (
            char === '\\'
            && i + 1 < len
            && message[i + 1] === '%'
         ) {
            result += '%';
            i += 2;
         } else if (char === '%') {
            const { output, new_index, new_style } = this.handle_token(message, i, current_style);

            result += output;
            current_style = new_style;
            i = new_index;
         } else {
            const { literal, new_index } = this.collect_literal(message, i);

            result += literal;
            i = new_index;
         }
      }

      if (
         current_style
         && this.#ansi_enabled
      ) {
         result += current_style.style.close;
      }

      return result;
   }

   apply_style(
      text: string,
      token: string
   ): string {
      if (!this.#ansi_enabled) {
         return text;
      }

      const style = this.#assembler.styles.get(token);

      if (style) {
         return style.open + text + style.close;
      }

      return text;
   }
}