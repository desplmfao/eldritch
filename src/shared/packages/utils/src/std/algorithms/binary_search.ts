/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/algorithms/binary_search.ts
 */

/**
 * performs a binary search on a sorted array to find the index of an element.
 * if the element is not found, it returns the index where the element should be inserted to maintain order
 *
 * @template T - the type of elements in the array
 * 
 * @param array - the sorted array to search in
 * @param key - the value to search for
 * @param key_fn - a function that extracts a comparable numeric key from an element
 * 
 * @returns an object indicating whether the key was found, and the index
 */
export function binary_search_by_key<T>(
   array: readonly T[],
   key: number,
   key_fn: (element: T) => number
): {
   found: boolean,
   index: number
} {
   let low = 0;
   let high = array.length - 1;
   let insertion_index = array.length;

   while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const mid_key = key_fn(array[mid]!);

      if (mid_key === key) {
         return {
            found: true,
            index: mid
         };
      } else if (mid_key < key) {
         low = mid + 1;
      } else {
         insertion_index = mid;
         high = mid - 1;
      }
   }

   return {
      found: false,
      index: insertion_index
   };
}