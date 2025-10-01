/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/fixed/array/fixed-array-of.ts
 */

import type { IView, Pointer, IViewConstructor, IHashable } from '@eldritch-engine/type-utils/guerrero/index';
import type { IGuerreroFixedArray } from '@eldritch-engine/type-utils/guerrero/interfaces';

import type { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

import { FixedArray } from '@self/runtime/skeletons/fixed/array/fixed-array';

export class FixedArrayOf<
   T extends IView & { $copy_from(source: T): void; free?(): void; },
   L extends number
> extends FixedArray<T, T, L> implements IGuerreroFixedArray<T, L> {

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator | undefined,
      //
      element_constructor: IViewConstructor<T>,
      length: L,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer,
      //
      is_new_instance: boolean = false
   ) {
      super(
         buffer,
         byte_offset,
         allocator,
         //
         element_constructor,
         length,
         //
         owner_constructor,
         owner_allocation_ptr,
         //
         is_new_instance
      );
   }

   [n: number]: T;

   override get(
      index: number
   ): T | undefined {
      return this.$get_element_view(index);
   }

   override set(
      index: number,
      value: T
   ): boolean {
      const view = this.$get_element_view(index);

      if (view) {
         view.$copy_from(value);

         return true;
      }

      return false;
   }

   override indexOf(
      search_element: T,
      from_index?: number
   ): number {
      const start = from_index ?? 0;
      const has_equals = typeof (search_element as T & IHashable).$equals === 'function';

      for (let i = start; i < this.length; i++) {
         const element_view = this.$get_element_view(i)!;

         if (has_equals) {
            if ((element_view as T & IHashable).$equals(search_element as T & IHashable)) {
               return i;
            }
         } else {
            const size = this.__value_schema.total_size;
            const source_bytes = new Uint8Array(search_element.__buffer, search_element.__byte_offset, size);
            const target_bytes = new Uint8Array(element_view.__buffer, element_view.__byte_offset, size);

            let match = true;

            for (let j = 0; j < size; j++) {
               if (source_bytes[j] !== target_bytes[j]) {
                  match = false;

                  break;
               }
            }

            if (match) {
               return i;
            }
         }
      }
      return -1;
   }

   override $copy_from(
      source: this | Iterable<T>
   ): void {
      let i = 0;

      for (const value of source) {
         if (i >= this.length) {
            break;
         }

         this.set(i, value);

         i++;
      }
   }
}