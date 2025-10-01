/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-ifdef/src/renderer.ts
 */

import type { PluginLogicSettings, KeepAction, PruneAction, PassAction } from '@self/types';

import { DEFAULT_COMMENT_PREFIX } from '@self/constants';

export class IfdefRenderer {
   readonly fill_with_spaces: boolean;
   readonly comment_out_lines: boolean;
   readonly comment_prefix: string;

   constructor(settings: PluginLogicSettings) {
      this.fill_with_spaces = settings.fill_with_spaces ?? false;
      this.comment_out_lines = settings.comment_out_lines ?? false;
      this.comment_prefix = settings.comment_prefix ?? DEFAULT_COMMENT_PREFIX;
   }

   render(
      actions: Generator<KeepAction | PruneAction | PassAction, void, void>
   ): string {
      const output_lines: string[] = [];

      for (const action of actions) {
         switch (action.type) {
            case 'KEEP': {
               output_lines.push(action.content);

               break;
            }

            case 'PRUNE': {
               if (this.comment_out_lines) {
                  output_lines.push(this.comment_prefix + action.line_text);
               } else if (this.fill_with_spaces) {
                  output_lines.push(' '.repeat(action.line_text.length));
               } else {
                  output_lines.push('');
               }

               break;
            }

            case 'PASS': {
               output_lines.push(action.content);

               break;
            }
         }
      }

      return output_lines.join('\n');
   }
}