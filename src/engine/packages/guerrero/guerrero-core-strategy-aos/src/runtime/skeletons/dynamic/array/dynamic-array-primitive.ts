/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/array/dynamic-array-primitive.ts
 */

import type { Pointer, IViewConstructor, IView } from '@eldritch-engine/type-utils/guerrero/index';

import { GLOBAL_NULL_POINTER } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';
import type { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

import { DynamicArray } from '@self/runtime/skeletons/dynamic/array/dynamic-array';
import type { PrimitiveView } from '@self/runtime/skeletons/fixed/fixed-primitive';

export abstract class DynamicArrayPrimitive<
   P extends PrimitiveView<V>,
   V extends number | bigint | boolean
> extends DynamicArray<P, V> {

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
      //
      value_constructor: IViewConstructor<P>,
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
         value_constructor,
         //
         owner_constructor,
         owner_allocation_ptr,
         //
         is_new_instance
      );
   }

   abstract override get(
      index: number
   ): V | undefined;

   abstract override set(
      index: number,
      value: V
   ): boolean;

   abstract override push(
      ...values: V[]
   ): number;

   override pop(): V | undefined {
      const current_length = this.length;

      if (current_length === 0) {
         return;
      }

      const last_element_view = this.$get_element_view(current_length - 1)!;
      const value = last_element_view.value;

      this.$set_length(current_length - 1);

      return value;
   }

   override indexOf(
      search_element: V,
      from_index?: number
   ): number {
      const start = Math.max(from_index ?? 0, 0);

      for (let i = start; i < this.length; i++) {
         if (this.get(i) === search_element) {
            return i;
         }
      }

      return -1;
   }

   override *[Symbol.iterator](): IterableIterator<V> {
      for (let i = 0; i < this.length; i++) {
         yield this.get(i)!;
      }
   }

   override free(): void {
      const ptr = this.$control_block_ptr;

      if (ptr === GLOBAL_NULL_POINTER) {
         return;
      }

      const elements_ptr = this.$get_elements_buffer_ptr();

      if (elements_ptr !== GLOBAL_NULL_POINTER) {
         this.__allocator.free(elements_ptr);
      }

      this.__allocator.free(ptr);

      this.$control_block_ptr = GLOBAL_NULL_POINTER;
   }

   override $copy_from(
      source: this | Iterable<V>
   ): void {
      while (this.length > 0) {
         this.pop();
      }

      for (const val of source) {
         this.push(val);
      }
   }
}