/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-ifdef/src/formatter.ts
 */

import { REG_EXPS } from '@self/constants';
import { DirectiveError, type PluginLogicSettings, type WarnCallback } from '@self/types';
import { IfdefParser } from '@self/parser';
import { IfdefProcessor } from '@self/processor';
import { IfdefRenderer } from '@self/renderer';

/**
 * main processing function. acts as a facade that orchestrates the ifdef pipeline
 *
 * @throws {DirectiveError} for syntax errors, evaluation errors, or structural issues
 */
export function format_content_stack(
   source_text: string,
   file_path: string,
   settings: PluginLogicSettings,
   warn_fn: WarnCallback,
): string {
   try {
      const reg_exp: RegExp = settings.reg_exp ?? REG_EXPS.triple;

      const parser = new IfdefParser(reg_exp);
      const processor = new IfdefProcessor(settings, file_path, warn_fn);
      const renderer = new IfdefRenderer(settings);

      const tokens = parser.parse(source_text);
      const actions = processor.process(tokens);
      const final_content = renderer.render(actions);

      return final_content;
   } catch (e) {
      if (e instanceof DirectiveError) {
         e.file = e.file ?? file_path;

         if (
            e.line != null
            && !e.lineText
            && e.line >= 0
         ) {
            const lines = source_text.split(/\r?\n/);

            if (e.line < lines.length) {
               e.lineText = lines[e.line];
            }
         }
         throw e;
      } else {
         const lines = source_text.split(/\r?\n/);

         throw new DirectiveError(
            e instanceof Error ? e.message : String(e),
            lines.length - 1,
            { file: file_path },
            e
         );
      }
   }
}