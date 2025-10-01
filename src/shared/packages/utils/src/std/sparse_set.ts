/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/sparse_set.ts
 */

/** a data structure optimized for storing sets of integers */
export class SparseSet {
   /** tightly packed array of values */
   #dense: number[];
   /** maps value -> index in dense array */
   #sparse: Map<number, number>;
   /** current number of elements in the set */
   #size: number;
   /** current allocated size of dense array */
   #capacity: number;

   constructor(
      initial_values_or_capacity?: Iterable<number> | number | null,
      initial_capacity_if_values_provided?: number
   ) {
      let resolved_initial_capacity = 64;
      let values_to_add: Iterable<number> | null = null;

      if (typeof initial_values_or_capacity === 'number') {
         resolved_initial_capacity = initial_values_or_capacity;
      } else if (initial_values_or_capacity != null) {
         values_to_add = initial_values_or_capacity;
         resolved_initial_capacity = initial_capacity_if_values_provided ?? resolved_initial_capacity;
      }

      this.#capacity = Math.max(1, resolved_initial_capacity);
      this.#dense = new Array(this.#capacity);
      this.#sparse = new Map();
      this.#size = 0;

      if (values_to_add) {
         for (const value of values_to_add) {
            this.add(value);
         }
      }
   }

   /** gets the current number of elements in the set */
   get size(): number {
      return this.#size;
   }

   /** checks if a value exists in the set */
   has(
      value: number
   ): boolean {
      const sparse_index = this.#sparse.get(value);

      return sparse_index != null && sparse_index < this.#size && this.#dense[sparse_index] === value;
   }

   /** adds a value to the set */
   add(
      value: number
   ): boolean {
      if (this.has(value)) {
         return false;
      }

      if (this.#size >= this.#capacity) {
         this.#grow();
      }

      const index = this.#size;

      this.#dense[index] = value;
      this.#sparse.set(value, index);
      this.#size++;

      return true;
   }

   /** deletes a value from the set using swap-and-pop */
   delete(
      value: number
   ): boolean {
      const index_to_remove = this.#sparse.get(value);

      if (index_to_remove == null || index_to_remove >= this.#size || this.#dense[index_to_remove] !== value) {
         return false;
      }

      const last_index = this.#size - 1;
      const last_value = this.#dense[last_index]!;

      this.#dense[index_to_remove] = last_value;
      this.#sparse.set(last_value, index_to_remove);

      this.#sparse.delete(value);
      this.#size--;

      return true;
   }

   /** removes all elements from the set */
   clear(): void {
      this.#sparse.clear();
      this.#size = 0;
   }

   /**
    * returns an iterator over the values currently in the set
    *
    * iterates over the packed dense array
    */
   *values(): IterableIterator<number> {
      for (let i = 0; i < this.#size; i++) {
         yield this.#dense[i]!;
      }
   }

   keys(): IterableIterator<number> {
      return this.values();
   }

   *entries(): IterableIterator<[number, number]> {
      for (const value of this.values()) {
         yield [value, value];
      }
   }

   [Symbol.iterator](): IterableIterator<number> {
      return this.values();
   }

   /** doubles the capacity of the dense array */
   #grow(): void {
      this.#capacity *= 2;
      const old_dense = this.#dense;
      this.#dense = new Array(this.#capacity);

      for (let i = 0; i < this.#size; i++) {
         this.#dense[i] = old_dense[i]!;
      }

      /// #if LOGGER_HAS_TRACE
      console.debug(`grew dense array capacity to ${this.#capacity}`);
      /// #endif
   }
}