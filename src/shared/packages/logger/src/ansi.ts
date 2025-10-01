/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/logger/src/ansi.ts
 */

import type { AnsiGroup, ColorEntry, ColorList } from '@eldritch-engine/type-utils/logger/index';

export const MAX_COLOR = 2 ** 8 - 1;

export const HEX_COLOR_REGEX = /[a-f\d]{6}|[a-f\d]{3}/i;
export const ANSI_BACKGROUND_FORM_FOREGROUND_OFFSET = 10;

export const ANSI_COLOR_STYLES = new Map<string, unknown>([
   // aliases
   ['r', 'reset'],
   ['ul', 'underline'],
   ['ol', 'overline'],
   ['st', 'strikethrough'],

   // modifiers
   ['reset', [0, 0]],
   ['bold', [1, 21]],
   ['dim', [2, 22]],
   ['italic', [3, 23]],
   ['underline', [4, 24]],
   ['slow_blink', [5, 25]],
   ['fast_blink', [6, 26]],
   ['inverse', [7, 27]],
   ['hidden', [8, 28]],
   ['strikethrough', [9, 29]],
   ['framed', [51, 54]],
   ['encircle', [52, 54]],
   ['overline', [53, 55]],

   // foreground colors
   ['black', [30, 39]],
   ['red', [31, 39]],
   ['green', [32, 39]],
   ['yellow', [33, 39]],
   ['blue', [34, 39]],
   ['magenta', [35, 39]],
   ['cyan', [36, 39]],
   ['white', [37, 39]],

   // bright foreground colors
   ['black_bright', [90, 39]],
   ['red_bright', [91, 39]],
   ['green_bright', [92, 39]],
   ['yellow_bright', [93, 39]],
   ['blue_bright', [94, 39]],
   ['magenta_bright', [95, 39]],
   ['cyan_bright', [96, 39]],
   ['white_bright', [97, 39]],

   // background colors
   ['bg_black', [40, 49]],
   ['bg_red', [41, 49]],
   ['bg_green', [42, 49]],
   ['bg_yellow', [43, 49]],
   ['bg_blue', [44, 49]],
   ['bg_magenta', [45, 49]],
   ['bg_cyan', [46, 49]],
   ['bg_white', [47, 49]],

   // bright background colors
   ['bg_black_bright', [100, 49]],
   ['bg_red_bright', [101, 49]],
   ['bg_green_bright', [102, 49]],
   ['bg_yellow_bright', [103, 49]],
   ['bg_blue_bright', [104, 49]],
   ['bg_magenta_bright', [105, 49]],
   ['bg_cyan_bright', [106, 49]],
   ['bg_white_bright', [107, 49]],

   // custom inline colors (to test)
   // these all should output the same color, or something CLOSE to the same
   /// #if LOGGER_HAS_TRACE
   ['internal_test1', [93, 39]], // 8 bit
   ['internal_test2', 'rgb(255,165,0):8'], // 8 bit
   ['internal_test3', 'rgb(255,165,0):24'], // 24 bit
   ['internal_test4', '255,165,0:8'], // 8 bit
   ['internal_test5', '255,165,0:24'], // 24 bit
   ['internal_test6', '#FFA500'], // 24 bit
   ['internal_test7', 'internal_test1']
   /// #endif
]);

/**
 * a class to manage ansi color codes and convert between different color formats
 */
export class AssembleAnsi {
   public styles = new Map<string, AnsiGroup>();
   public color_cache = new Map<string, number>();

   constructor(colors?: ColorList) {
      this.initialize(colors);
   }

   initialize(colors: ColorList = {}): void {
      this.add_predefined_styles();
      this.add_user_defined_colors(colors);
   }

   parse_hex(s: string): {
      r: number;
      g: number;
      b: number;
   } {
      let hex = s.slice(1);

      if (hex.length === 3) {
         hex = hex
            .split('')
            .map((char) => char + char)
            .join('');
      }

      const r = Number.parseInt(hex.substring(0, 2), 16);
      const g = Number.parseInt(hex.substring(2, 4), 16);
      const b = Number.parseInt(hex.substring(4, 6), 16);

      return {
         r,
         g,
         b
      };
   }

   rgb_to_ansi_256(
      r: number,
      g: number,
      b: number
   ): number {
      const nr = Math.max(0, Math.min(MAX_COLOR, r));
      const ng = Math.max(0, Math.min(MAX_COLOR, g));
      const nb = Math.max(0, Math.min(MAX_COLOR, b));

      const key = `${nr},${ng},${nb}`;

      if (this.color_cache.has(key)) {
         return Number(this.color_cache.get(key));
      }

      let result: number;

      if (
         nr === ng
         && ng === nb
      ) {
         switch (true) {
            case nr < 8: {
               result = 16;

               break;
            }

            case nr > 248: {
               result = 231;

               break;
            }

            default: {
               result = Math.round(((nr - 8) / 247) * 24) + 232;

               break;
            }
         }
      } else {
         result =
            16
            + 36 * Math.round((nr / MAX_COLOR) * 5)
            + 6 * Math.round((ng / MAX_COLOR) * 5)
            + Math.round((nb / MAX_COLOR) * 5);
      }

      this.color_cache.set(key, result);

      return result;
   }

   ansi_256_to_ansi(code: number): number {
      let n_code = code;

      if (
         !Number.isInteger(n_code)
         || n_code < 0
         || n_code > MAX_COLOR
      ) {
         return 30;
      }

      if (n_code < 8) {
         return 30 + n_code;
      }

      if (n_code < 16) {
         return 90 + (n_code - 8);
      }

      let r: number;
      let g: number;
      let b: number;

      if (n_code >= 232) {
         r = ((n_code - 232) * 10 + 8) / MAX_COLOR;
         g = r;
         b = r;
      } else {
         n_code -= 16;

         const remainder = n_code % 36;

         r = Math.floor(n_code / 36) / 5;
         g = Math.floor(remainder / 6) / 5;
         b = (remainder % 6) / 5;
      }

      const value = Math.max(r, g, b) * 2;

      if (value === 0) {
         return 30;
      }

      let result = 30 + ((Math.round(b) << 2) | (Math.round(g) << 1) | Math.round(r));

      if (value === 2) {
         result += 60;
      }

      return result;
   }

   rgb_to_ansi(
      r: number,
      g: number,
      b: number
   ): number {
      return this.ansi_256_to_ansi(this.rgb_to_ansi_256(r, g, b));
   }

   resolve_predefined_style(
      token: string,
      seen_tokens: Set<string> = new Set()
   ): AnsiGroup | undefined {
      if (seen_tokens.has(token)) {
         return;
      }

      seen_tokens.add(token);

      const value = ANSI_COLOR_STYLES.get(token) as ColorEntry;

      if (value == null) {
         return;
      }

      if (typeof value === 'object') {
         return {
            open: `\u001B[${value[0]}m`,
            close: `\u001B[${value[1]}m`
         };
      }

      const candidate = String(value).trim();

      if (
         candidate.startsWith('#')
         || candidate.toLowerCase().startsWith('rgb(')
         || candidate.split(',').length === 3
      ) {
         const custom = this.create_string_style(candidate);

         if (custom) {
            return custom;
         }
      }

      return this.resolve_predefined_style(candidate, seen_tokens);
   }

   add_predefined_styles() {
      for (const [style_name] of ANSI_COLOR_STYLES) {
         const resolved = this.resolve_predefined_style(style_name);

         if (resolved) {
            this.styles.set(style_name, resolved);
         } else {
            console.warn(`'${style_name}' could not resolve predefined style`);
         }
      }
   }

   add_user_defined_colors(colors: ColorList) {
      for (const [color_name, color] of Object.entries(colors)) {
         const custom_style = this.create_custom_style(color);

         if (custom_style) {
            this.styles.set(color_name, custom_style);
         } else {
            console.warn(`'${color_name}' didn't provide a valid custom style`);
         }
      }
   }

   create_custom_style(color: number | string | object) {
      switch (typeof color) {
         case 'number': {
            return this.create_number_style(color);
         }

         case 'string': {
            return this.create_string_style(color);
         }

         case 'object': {
            return this.create_object_style(color);
         }

         default: {
            return;
         }
      }
   }

   create_number_style(color: number) {
      if (
         Number.isInteger(color)
         && color >= 0
         && color <= MAX_COLOR
      ) {
         return {
            open: `\u001B[${color}m`,
            close: '\u001B[0m'
         } as AnsiGroup;
      }

      return;
   }

   create_string_style(color: string): AnsiGroup | undefined {
      const { trimmed, mode } = this.create_string_style_extract_color_mode(color);

      let components: [number, number, number] = [0, 0, 0];

      //

      if (trimmed.toLowerCase().startsWith('rgb(') && trimmed.endsWith(')')) {
         const inside = trimmed.substring(4, trimmed.length - 1);
         const parts = inside.split(',').map((n) => Number(n.trim()));

         if (
            parts.length === 3
            && parts.every((n) => !Number.isNaN(n))
         ) {
            components = parts as [number, number, number];
         }
      }

      else if (trimmed.split(',').length === 3) {
         const parts = trimmed.split(',').map((n) => Number(n.trim()));

         if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
            components = parts as [number, number, number];
         }
      }

      else if (
         trimmed.startsWith('#')
         && (
            trimmed.length === 4
            || trimmed.length === 7
         )
      ) {
         const { r, g, b } = this.parse_hex(trimmed);

         components = [r, g, b];
      }

      //

      if (components) {
         if (mode === '24') {
            return this.create_24_bit_style(components[0], components[1], components[2]);
         }

         const ansi = this.rgb_to_ansi(components[0], components[1], components[2]);

         return {
            open: `\u001B[${ansi}m`,
            close: '\u001B[0m'
         } as AnsiGroup;
      }

      return;
   }

   create_string_style_extract_color_mode(
      color: string
   ): {
      trimmed: string;
      mode: '8' | '24';
   } {
      let trimmed = color.trim();
      let mode: '8' | '24' = '24';

      if (trimmed.indexOf(':') > -1) {
         const parts = trimmed.split(':') as [string, string];

         trimmed = parts[0].trim();
         const flag = parts[1].trim().toLowerCase();

         if (flag.startsWith('8')) {
            mode = '8';
         } else if (flag.startsWith('24')) {
            mode = '24';
         }
      }

      return {
         trimmed,
         mode
      };
   }

   create_object_style(color: object) {
      if (
         Array.isArray(color)
         && color.length === 2
      ) {
         const [open, close] = color as [number, number];

         if (
            Number.isInteger(open)
            && Number.isInteger(close)
         ) {
            return {
               open: `\u001B[${open}m`,
               close: `\u001B[${close}m`
            } as AnsiGroup;
         }
      }

      return;
   }

   create_24_bit_style(
      r: number,
      g: number,
      b: number,
      is_background = false
   ): AnsiGroup {
      return {
         open: `\u001B[${is_background ? '48' : '38'};2;${r};${g};${b}m`,
         close: `\u001B[${is_background ? '49' : '39'}m`
      } as AnsiGroup;
   }
}