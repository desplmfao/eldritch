/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/runtime/allocator/mapping.ts
 */

import { tlsf_fls_sizet } from '@self/runtime/allocator/bit_utils';
import { SMALL_BLOCK_SIZE, SL_INDEX_COUNT, SL_INDEX_COUNT_LOG2, FL_INDEX_SHIFT } from '@self/runtime/allocator/constants';

/** */
export function mapping_insert(
   size: number
): {
   fli: number,
   sli: number
} {
   let fli: number;
   let sli: number;

   if (size < SMALL_BLOCK_SIZE) {
      fli = 0;
      sli = Math.floor(size / (SMALL_BLOCK_SIZE / SL_INDEX_COUNT));
   } else {
      const fl = tlsf_fls_sizet(size);

      sli = (size >> (fl - SL_INDEX_COUNT_LOG2)) ^ (1 << SL_INDEX_COUNT_LOG2);
      fli = fl - (FL_INDEX_SHIFT - 1);
   }

   return {
      fli,
      sli
   };
}

/** */
export function mapping_search(
   size: number
): {
   fli: number,
   sli: number
} {
   if (size >= SMALL_BLOCK_SIZE) {
      const fl = tlsf_fls_sizet(size);
      const round = (1 << (fl - SL_INDEX_COUNT_LOG2)) - 1;

      size += round;
   }

   return mapping_insert(size);
}