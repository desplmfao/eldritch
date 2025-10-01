/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/algorithms/merge_sort.ts
 */

import type { MaybePromise } from '@eldritch-engine/type-utils';

export async function merge_sort<T>(
   arr: T[],
   comparator: (a: T, b: T) => MaybePromise<number>
): Promise<T[]> {
   if (arr.length <= 1) {
      return arr;
   }

   const mid = Math.floor(arr.length / 2);
   const left = await merge_sort(arr.slice(0, mid), comparator);
   const right = await merge_sort(arr.slice(mid), comparator);

   return await merge(left, right, comparator);
}

export async function merge<T>(
   left: T[],
   right: T[],
   comparator: (a: T, b: T) => MaybePromise<number>
): Promise<T[]> {
   const result: T[] = [];

   let i = 0;
   let j = 0;

   while (i < left.length && j < right.length) {
      const comp = await comparator(left[i] as T, right[j] as T);

      if (comp <= 0) {
         result.push(left[i] as T);

         i++;
      } else {
         result.push(right[j] as T);

         j++;
      }
   }

   while (i < left.length) {
      result.push(left[i] as T);

      i++;
   }

   while (j < right.length) {
      result.push(right[j] as T);

      j++;
   }

   return result;
}
