/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/collections/deep_set.ts
 */

import { deep_equal } from '@self/std/object';

export class DeepSet<T> {
   #values: T[] = [];

   constructor(values?: Iterable<T> | null) {
      if (values) {
         for (const value of values) {
            this.add(value);
         }
      }
   }

   get size(): number {
      return this.#values.length;
   }

   add(value: T): this {
      if (!this.has(value)) {
         this.#values.push(value);
      }

      return this;
   }

   has(value: T): boolean {
      for (const existing_value of this.#values) {
         if (deep_equal(existing_value, value)) {
            return true;
         }
      }

      return false;
   }

   delete(value: T): boolean {
      for (let i = 0; i < this.#values.length; i++) {
         if (deep_equal(this.#values[i], value)) {
            this.#values.splice(i, 1);

            return true;
         }
      }

      return false;
   }

   clear(): void {
      this.#values = [];
   }

   *entries(): IterableIterator<[T, T]> {
      for (const value of this.#values) {
         yield [value, value];
      }
   }

   keys(): IterableIterator<T> {
      return this.values();
   }

   *values(): IterableIterator<T> {
      for (const value of this.#values) {
         yield value;
      }
   }

   [Symbol.iterator](): IterableIterator<T> {
      return this.values();
   }

   get [Symbol.toStringTag](): string {
      return 'DeepSet';
   }
}