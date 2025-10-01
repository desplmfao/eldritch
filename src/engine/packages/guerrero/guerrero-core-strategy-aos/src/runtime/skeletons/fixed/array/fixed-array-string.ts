/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/fixed/array/fixed-array-string.ts
 */

import type { IView, IViewConstructor, Pointer } from '@eldritch-engine/type-utils/guerrero/index';
import type { IGuerreroFixedArray } from '@eldritch-engine/type-utils/guerrero/interfaces';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

import { FixedArray } from '@self/runtime/skeletons/fixed/array/fixed-array';
import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';

export class FixedArrayString<L extends number> extends FixedArray<DynamicString, string, L> implements IGuerreroFixedArray<string, L> {

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
      //
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
         DynamicString,
         length,
         //
         owner_constructor,
         owner_allocation_ptr,
         //
         is_new_instance
      );
   }

   [n: number]: string;

   override get(
      index: number
   ): string | undefined {
      const view = this.$get_element_view(index);

      return view?.value;
   }

   override set(
      index: number,
      value: string
   ): boolean {
      const view = this.$get_element_view(index);

      if (view) {
         view.value = value;

         return true;
      }

      return false;
   }

   override indexOf(
      search_element: string,
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
      source: this | Iterable<string>
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