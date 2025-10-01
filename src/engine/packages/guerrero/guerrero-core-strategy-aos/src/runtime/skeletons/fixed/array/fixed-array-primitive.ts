/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/fixed/array/fixed-array-primitive.ts
 */

import type { Pointer, IViewConstructor, IView } from '@eldritch-engine/type-utils/guerrero/index';
import type { IGuerreroFixedArray } from '@eldritch-engine/type-utils/guerrero/interfaces';

import type { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

import { FixedArray } from '@self/runtime/skeletons/fixed/array/fixed-array';
import type { PrimitiveView } from '@self/runtime/skeletons/fixed/fixed-primitive';

export abstract class FixedArrayPrimitive<
   P extends PrimitiveView<V>,
   V extends number | bigint | boolean,
   L extends number
> extends FixedArray<P, V, L> implements IGuerreroFixedArray<V, L> {

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator | undefined,
      //
      element_constructor: IViewConstructor<P>,
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

   [n: number]: V;

   //

   abstract override get(
      index: number
   ): V | undefined;

   abstract override set(
      index: number,
      value: V
   ): boolean;

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

   override $copy_from(
      source: this | Iterable<V>
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