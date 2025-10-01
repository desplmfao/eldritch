/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/fixed/array/fixed-array.ts
 */

import type { Pointer, IView, SchemaLayout, IViewConstructor } from '@eldritch-engine/type-utils/guerrero/index';
import type { IGuerreroFixedArray } from '@eldritch-engine/type-utils/guerrero/interfaces';

import type { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

export class FixedArray<T_Internal extends IView, T_Public, L extends number> implements IGuerreroFixedArray<T_Public, L> {

   static __schema: SchemaLayout;

   readonly __view: DataView;
   readonly __buffer: ArrayBufferLike;
   readonly __byte_offset: Pointer;
   readonly __allocator?: TlsfAllocator;

   readonly __value_constructor: IViewConstructor<T_Internal>;
   readonly __value_schema: SchemaLayout;
   readonly __length: L;

   readonly __owner_constructor?: IViewConstructor<IView>;
   readonly __owner_allocation_ptr?: Pointer;

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator | undefined,
      //
      value_constructor: IViewConstructor<T_Internal>,
      length: L,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer,
      //
      is_new_instance: boolean = false
   ) {
      /// #if SAFETY
      if (!value_constructor.__schema) {
         throw new Error(`element type '${value_constructor.name}' is missing a static __schema property`);
      }
      /// #endif

      this.__buffer = buffer;
      this.__byte_offset = byte_offset;
      this.__allocator = allocator;
      this.__view = new DataView(buffer);

      this.__value_constructor = value_constructor;
      this.__value_schema = value_constructor.__schema;

      this.__length = length;

      this.__owner_constructor = owner_constructor;
      this.__owner_allocation_ptr = owner_allocation_ptr;
   }

   [n: number]: T_Public;

   get(index: number): T_Public | undefined {
      throw new Error('method not implemented');
   }

   set(index: number, value: T_Public): boolean {
      throw new Error('method not implemented');
   }

   indexOf(search_element: T_Public, from_index?: number): number {
      throw new Error('method not implemented');
   }

   includes(
      search_element: T_Public,
      from_index?: number
   ): boolean {
      return this.indexOf(search_element, from_index) > -1;
   }

   $copy_from(source: this | Iterable<T_Public>): void {
      throw new Error('method not implemented');
   }

   *[Symbol.iterator](): IterableIterator<T_Public> {
      for (let i = 0; i < this.length; i++) {
         yield this.get(i)!;
      }
   }

   *entries(): IterableIterator<[number, T_Public]> {
      for (let i = 0; i < this.length; i++) {
         yield [i, this.get(i)!];
      }
   }

   *keys(): IterableIterator<number> {
      for (let i = 0; i < this.length; i++) {
         yield i;
      }
   }

   values(): IterableIterator<T_Public> {
      return this[Symbol.iterator]();
   }

   get length(): L {
      return this.__length;
   }

   $get_element_view(index: number): T_Internal | undefined {
      if (
         index < 0
         || index >= this.length
      ) {
         return;
      }

      const element_offset = this.__byte_offset + (index * this.__value_schema.total_size);

      return new this.__value_constructor(
         this.__buffer,
         element_offset,
         this.__allocator,
         //
         this.constructor,
         this.__byte_offset,
         //
         /* is_new_instance */ false
      );
   }

   free(): void {
      if (this.__value_schema.has_dynamic_data) {
         for (let i = 0; i < this.length; i++) {
            const element_view = this.$get_element_view(i);

            if (typeof element_view?.free === 'function') {
               element_view.free();
            }
         }
      }
   }
}