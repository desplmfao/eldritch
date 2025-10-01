/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/set.ts
 */

/** helper to compare component sets and find the single difference */
export function set_find_difference(
   set_a: Set<string>,
   set_b: Set<string>
): {
   added_to_a: string | null,
   added_to_b: string | null
} {
   let added_to_a: string | null = null;
   let added_to_b: string | null = null;

   let diff_count = 0;

   for (const item_a of set_a) {
      if (!set_b.has(item_a)) {
         added_to_a = item_a;

         diff_count++;
      }
   }

   for (const item_b of set_b) {
      if (!set_a.has(item_b)) {
         added_to_b = item_b;

         diff_count++;
      }
   }

   if (diff_count === 1) {
      return {
         added_to_a,
         added_to_b
      };
   } else {
      return {
         added_to_a: null,
         added_to_b: null
      };
   }
}