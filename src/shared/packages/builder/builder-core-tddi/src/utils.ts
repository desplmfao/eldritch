/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-tddi/src/utils.ts
 */

import { default as path } from 'node:path';

import * as swc from '@swc/core';

export const SWC_PARSER_OPTIONS: swc.ParseOptions = {
   syntax: 'typescript',
   tsx: false,
   decorators: true,
};

export function map_dist_to_src(resolved_path: string): string {
   const dist_segment = path.sep + 'dist' + path.sep;

   if (resolved_path.indexOf(dist_segment) > -1) {
      const src_path = resolved_path.replace(dist_segment, path.sep + 'src' + path.sep);

      if (
         src_path.endsWith('.js')
         || src_path.endsWith('.d.ts')
      ) {
         return src_path.replace(/\.(js|d\.ts)$/, '.ts');
      }

      return src_path;
   }

   return resolved_path;
}