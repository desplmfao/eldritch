/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/array.ts
 */

/**
 * shuffles the elements of an array in place using the fisher-yates algorithm
 *
 * @template T - the type of elements in the array
 * 
 * @param array - the array to shuffle
 */
export function shuffle<T>(array: T[]): T[] {
   let current_index: number = array.length;
   let random_index: number;

   while (current_index > 0) {
      random_index = Math.floor(Math.random() * current_index);
      current_index--;

      [array[current_index], array[random_index]] = [array[random_index] as T, array[current_index] as T];
   }

   return array;
}

/**
 * partially shuffles the beginning of an array in place. this is a "lazy"
 * and faster alternative to a full shuffle when you only need to randomize
 * the first `k` items
 *
 * @template T - the type of elements in the array
 * @param array - the array to partially shuffle
 * @param count - the number of elements from the start of the array to shuffle
 */
export function partial_shuffle<T>(
   array: T[],
   count: number
): T[] {
   const length = array.length;
   const limit = Math.min(count, length);

   for (let i = 0; i < limit; i++) {
      const j = i + Math.floor(Math.random() * (length - i));

      [array[i], array[j]] = [array[j] as T, array[i] as T];
   }

   return array;
}

/**
 * selects a random element from an array
 *
 * @template T - the type of elements in the array
 * 
 * @param array - the array to choose from
 */
export function random_choice<T>(array: readonly T[]): T | undefined {
   if (array.length === 0) {
      return;
   }

   const index: number = Math.floor(Math.random() * array.length);

   return array[index];
}

/**
 * splits an array into smaller chunks of a specified size
 *
 * @template T - the type of elements in the array
 * 
 * @param array - the array to chunk
 * @param size - the desired size of each chunk
 */
export function chunk<T>(array: readonly T[], size: number): T[][] {
   if (size <= 0) {
      return [[]];
   }

   const result: T[][] = [];

   for (let i: number = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
   }

   return result;
}

/**
 * returns a new array containing only the unique elements from the input array
 * (based on strict equality `===` or Set uniqueness)
 *
 * @template T - the type of elements in the array
 * 
 * @param array - the input array
 */
export function unique<T>(array: readonly T[]): T[] {
   return [...new Set(array)];
}

/**
 * gets the first element of an array safely
 *
 * @template T - the type of elements in the array
 * 
 * @param array - the input array
 */
export function first<T>(array: readonly T[]): T | undefined {
   return array[0];
}

/**
 * gets the last element of an array safely
 *
 * @template T - the type of elements in the array
 * 
 * @param array - the input array
 */
export function last<T>(array: readonly T[]): T | undefined {
   return array.length > 0 ? array[array.length - 1] : undefined;
}

/**
 * removes the first occurrence of an item from an array (modifies the array in place)
 *
 * @template T - the type of elements in the array
 * 
 * @param array - the array to modify
 * @param item - the item to remove
 */
export function remove<T>(array: T[], item: T): boolean {
   let index: number = -1;

   for (let i: number = 0; i < array.length; i++) {
      if (array[i] === item) {
         index = i;

         break;
      }
   }

   if (index > -1) {
      array.splice(index, 1);

      return true;
   }

   return false;
}

export function equal<A extends unknown[], B extends unknown[]>(
   a: A,
   b: B
): boolean {
   if (a.length !== b.length) {
      return false;
   }

   for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
         return false;
      }
   }

   return true;
}

/**
 * finds the element in an array that has the maximum value when the keying function is applied
 *
 * @template T - the type of elements in the array
 * 
 * @param array - the input array
 * @param key_fn - a function that returns a comparable value for each element
 * 
 * @returns the element with the maximum key value, or undefined if the array is empty
 */
export function max_by_key<T>(array: readonly T[], key_fn: (element: T) => number | bigint): T | undefined {
   if (array.length === 0) {
      return;
   }

   let max_element: T = array[0]!;
   let max_key = key_fn(max_element);

   for (let i = 1; i < array.length; i++) {
      const current_element = array[i]!;
      const current_key = key_fn(current_element);
      if (current_key > max_key) {
         max_key = current_key;
         max_element = current_element;
      }
   }

   return max_element;
}

/**
 * finds the element in an array that has the minimum value when the keying function is applied
 *
 * @template T - the type of elements in the array
 * 
 * @param array - the input array
 * @param key_fn - a function that returns a comparable value for each element
 * 
 * @returns the element with the minimum key value, or undefined if the array is empty
 */
export function min_by_key<T>(
   array: readonly T[], key_fn: (element: T) => number | bigint
): T | undefined {
   if (array.length === 0) {
      return;
   }

   let min_element: T = array[0]!;
   let min_key = key_fn(min_element);

   for (let i = 1; i < array.length; i++) {
      const current_element = array[i]!;
      const current_key = key_fn(current_element);

      if (current_key < min_key) {
         min_key = current_key;
         min_element = current_element;
      }
   }

   return min_element;
}

/**
 * maps an array and filters out any null or undefined results
 *
 * @template T - the type of elements in the input array
 * @template U - the type of elements in the output array
 * 
 * @param array - the input array
 * @param callback - a function to apply to each element. if it returns null or undefined, the element is discarded
 * 
 * @returns a new array containing only the non-null/non-undefined mapped values
 */
export function filter_map<T, U>(
   array: readonly T[],
   callback: (element: T, index: number) => U | null | undefined
): U[] {
   const result: U[] = [];

   for (let i = 0; i < array.length; i++) {
      const mapped_value = callback(array[i]!, i);

      if (mapped_value != null) {
         result.push(mapped_value);
      }
   }

   return result;
}

/**
 * groups the elements of an array based on the value returned by the callback
 *
 * @template T - the type of elements in the array
 * @param array - the array to iterate over
 * @param key_fn - the function to transform each element into a group key
 */
export function group_by<T>(
   array: readonly T[],
   key_fn: (element: T) => string | number
): Record<string | number, T[]> {
   return array.reduce((result, element) => {
      const key = key_fn(element);

      if (!result[key]) {
         result[key] = [];
      }

      result[key]!.push(element);

      return result;
   }, {} as Record<string | number, T[]>);
}

/**
 * creates an array of grouped elements, the first of which contains elements
 * that return true for the predicate, the second of which contains elements
 * that return false
 *
 * @template T - the type of elements in the array
 * @param array - the array to partition
 * @param predicate - the function invoked per element
 */
export function partition<T>(
   array: readonly T[],
   predicate: (element: T) => boolean
): [T[], T[]] {
   const truthy: T[] = [];
   const falsy: T[] = [];

   for (const element of array) {
      (predicate(element) ? truthy : falsy).push(element);
   }

   return [truthy, falsy];
}