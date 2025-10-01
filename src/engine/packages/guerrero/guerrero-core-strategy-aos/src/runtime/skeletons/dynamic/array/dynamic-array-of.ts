/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/array/dynamic-array-of.ts
 */

import type { Pointer, IView, IViewConstructor, IHashable } from '@eldritch-engine/type-utils/guerrero/index';
import type { IGuerreroArray } from '@eldritch-engine/type-utils/guerrero/interfaces';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicArray } from '@self/runtime/skeletons/dynamic/array/dynamic-array';

export class DynamicArrayOf<
   T extends IView & { $copy_from(source: T): void; free?(): void; }
> extends DynamicArray<T, T> {

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
      //
      element_constructor: IViewConstructor<T>,
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
         // 
         owner_constructor,
         owner_allocation_ptr,
         //
         is_new_instance
      );

      return new Proxy(this, DynamicArray.$create_proxy_handler()) as DynamicArrayOf<T>;
   }

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

   override push(
      ...values: T[]
   ): number {
      for (const value of values) {
         const new_slot = this.$push_new_slot();

         new_slot.$copy_from(value);
      }

      return this.length;
   }

   override pop(): T | undefined {
      const current_length = this.length;

      if (current_length === 0) {
         return;
      }

      const last_element_view = this.$get_element_view(current_length - 1)!;

      this.$set_length(current_length - 1);

      return last_element_view;
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
      while (this.length > 0) {
         this.pop()?.free?.();
      }

      for (const val of source) {
         this.push(val);
      }
   }

   override free(): void {
      const ptr = this.$control_block_ptr;

      if (ptr === GLOBAL_NULL_POINTER) {
         return;
      }

      const len = this.length;

      for (let i = 0; i < len; i++) {
         const element = this.$get_element_view(i);

         element?.free?.();
      }

      const elements_ptr = this.$get_elements_buffer_ptr();

      if (elements_ptr !== GLOBAL_NULL_POINTER) {
         this.__allocator.free(elements_ptr);
      }

      this.__allocator.free(ptr);
      this.$control_block_ptr = GLOBAL_NULL_POINTER;
   }

   override *[Symbol.iterator](): IterableIterator<T> {
      for (let i = 0; i < this.length; i++) {
         yield this.get(i)!;
      }
   }
}

export interface DynamicArrayOf<T extends IView & { $copy_from(source: T): void; free?(): void; }> extends IGuerreroArray<T> {
   [index: number]: T | undefined;
}