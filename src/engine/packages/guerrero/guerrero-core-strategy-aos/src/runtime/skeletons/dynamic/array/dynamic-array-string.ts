/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/array/dynamic-array-string.ts
 */

import type { IView, IViewConstructor, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { IGuerreroArray } from '@eldritch-engine/type-utils/guerrero/interfaces';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER, } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { GUERRERO_SCHEMA_PLACEHOLDER } from '@eldritch-engine/guerrero-core/runtime/placeholder';

import { DynamicArray } from '@self/runtime/skeletons/dynamic/array/dynamic-array';
import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';

export class DynamicArrayString extends DynamicArray<DynamicString, string> implements IGuerreroArray<string> {

   static override readonly __schema: SchemaLayout = GUERRERO_SCHEMA_PLACEHOLDER;

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer,
      //
      is_new_instance: boolean = false
   ) {
      /// #if SAFETY
      if ((byte_offset % DynamicArrayString.__schema.alignment) !== 0) {
         throw new Error(`${DynamicArrayString.__schema.class_ctor?.name} byte_offset ${byte_offset} is not aligned to ${DynamicArrayString.__schema.alignment}`);
      }
      /// #endif

      super(
         buffer,
         byte_offset,
         allocator,
         //
         DynamicString,
         //
         owner_constructor,
         owner_allocation_ptr,
         //
         is_new_instance
      );

      return new Proxy(this, DynamicArray.$create_proxy_handler<DynamicString, string>()) as DynamicArrayString;
   }

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

   override push(
      ...values: string[]
   ): number {
      for (const value of values) {
         const new_element_view = this.$push_new_slot();

         new_element_view.value = value;
      }

      return this.length;
   }

   override pop(): string | undefined {
      const current_length = this.length;

      if (current_length === 0) {
         return;
      }

      const last_element_view = this.$get_element_view(current_length - 1)!;
      const value = last_element_view.value;
      last_element_view.free();

      this.$set_length(current_length - 1);

      return value;
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

   override *[Symbol.iterator](): IterableIterator<string> {
      for (let i = 0; i < this.length; i++) {
         yield this.get(i)!;
      }
   }

   //
   //

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

   override $copy_from(
      source: this | Iterable<string>
   ): void {
      while (this.length > 0) {
         this.pop();
      }

      for (const val of source) {
         this.push(val);
      }
   }
}

export interface DynamicArrayString extends IGuerreroArray<string> {
   [index: number]: string | undefined;
}