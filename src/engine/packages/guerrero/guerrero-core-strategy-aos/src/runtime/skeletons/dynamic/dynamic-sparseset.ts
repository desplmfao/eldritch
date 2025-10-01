/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/dynamic-sparseset.ts
 */

import type { IView, IViewConstructor, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER, LITTLE_ENDIAN } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { GUERRERO_SCHEMA_PLACEHOLDER } from '@eldritch-engine/guerrero-core/runtime/placeholder';

import type { IGuerreroArray, IGuerreroSparseSet } from '@eldritch-engine/type-utils/guerrero/interfaces';

export const OFFSET_COUNT = 0;
export const OFFSET_DENSE_PTR = 4;
export const OFFSET_SPARSE_PTR = 8;
export const CONTROL_BLOCK_SIZE = 12;

export abstract class DynamicSparseSet implements IGuerreroSparseSet {

   static readonly __schema: SchemaLayout = GUERRERO_SCHEMA_PLACEHOLDER;

   readonly __view: DataView;
   readonly __buffer: ArrayBufferLike;
   readonly __byte_offset: Pointer;
   readonly __allocator: TlsfAllocator;

   readonly __owner_constructor?: IViewConstructor<IView>;
   readonly __owner_allocation_ptr?: Pointer;

   #array_view_constructor: IViewConstructor<IGuerreroArray<number>>;
   #dense_array_view?: IGuerreroArray<number>;
   #sparse_array_view?: IGuerreroArray<number>;

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
      //
      array_view_constructor: IViewConstructor<IGuerreroArray<number>>,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer,
      //
      is_new_instance: boolean = false
   ) {
      this.__buffer = buffer;
      this.__byte_offset = byte_offset;
      this.__allocator = allocator;
      this.__view = new DataView(buffer);
      this.#array_view_constructor = array_view_constructor;

      this.__owner_constructor = owner_constructor;
      this.__owner_allocation_ptr = owner_allocation_ptr;
   }

   get size(): number {
      const ptr = this.$control_block_ptr;

      if (ptr === GLOBAL_NULL_POINTER) {
         return 0;
      }

      return new DataView(this.__allocator.buffer).getUint32(ptr + OFFSET_COUNT, LITTLE_ENDIAN);
   }

   has(
      num: number
   ): boolean {
      if (this.$control_block_ptr === GLOBAL_NULL_POINTER) {
         return false;
      }

      const index = this.$sparse.get(num);

      return index != null
         && index < this.size
         && this.$dense.get(index) === num;
   }

   add(
      num: number
   ): boolean {
      if (this.has(num)) {
         return false;
      }

      this.$initialize();

      if (num >= this.$sparse.length) {
         // @ts-expect-error - this is valid
         this.$sparse.$set_length(num + 1);
      }

      const index = this.size;

      this.$dense.push(num);
      this.$sparse.set(num, index);
      this.$set_size(index + 1);

      return true;
   }

   delete(
      num: number
   ): boolean {
      if (!this.has(num)) {
         return false;
      }

      const index_of_entity_to_remove = this.$sparse.get(num)!;
      const current_size = this.size;
      const new_size = current_size - 1;

      if (index_of_entity_to_remove < new_size) {
         const last_entity = this.$dense.get(new_size)!;

         this.$dense.set(index_of_entity_to_remove, last_entity);
         this.$sparse.set(last_entity, index_of_entity_to_remove);
      }

      this.$set_size(new_size);

      // @ts-expect-error - this is valid
      this.$dense.$set_length(new_size);

      return true;
   }

   clear(): void {
      if (this.$control_block_ptr === GLOBAL_NULL_POINTER) {
         return;
      }

      this.$set_size(0);

      // @ts-expect-error - this is valid
      this.$dense.$set_length(0);
      // @ts-expect-error - this is valid
      this.$sparse.$set_length(0);
   }

   free(): void {
      const ptr = this.$control_block_ptr;

      if (ptr === GLOBAL_NULL_POINTER) {
         return;
      }

      this.$dense.free();
      this.$sparse.free();
      this.__allocator.free(ptr);
      this.$control_block_ptr = GLOBAL_NULL_POINTER;
   }

   *values(): IterableIterator<number> {
      const count = this.size;

      for (let i = 0; i < count; i++) {
         yield this.$dense.get(i)!;
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

   $copy_from(
      source: this | Iterable<number>
   ): void {
      this.clear();

      for (const entity_id of source) {
         this.add(entity_id);
      }
   }

   get $control_block_ptr(): Pointer {
      return this.__view.getUint32(this.__byte_offset, LITTLE_ENDIAN);
   }

   set $control_block_ptr(
      ptr: Pointer
   ) {
      this.__view.setUint32(this.__byte_offset, ptr, LITTLE_ENDIAN);

      this.#dense_array_view = undefined;
      this.#sparse_array_view = undefined;
   }

   get $dense(): IGuerreroArray<number> {
      if (!this.#dense_array_view) {
         this.#dense_array_view = new this.#array_view_constructor(
            this.__allocator.buffer,
            this.$control_block_ptr + OFFSET_DENSE_PTR,
            this.__allocator,
            //
            this.constructor as IViewConstructor,
            this.$control_block_ptr
         );
      }

      return this.#dense_array_view;
   }

   get $sparse(): IGuerreroArray<number> {
      if (!this.#sparse_array_view) {
         this.#sparse_array_view = new this.#array_view_constructor(
            this.__allocator.buffer,
            this.$control_block_ptr + OFFSET_SPARSE_PTR,
            this.__allocator,
            //
            this.constructor as IViewConstructor,
            this.$control_block_ptr
         );
      }

      return this.#sparse_array_view;
   }

   $initialize() {
      if (this.$control_block_ptr !== GLOBAL_NULL_POINTER) {
         return;
      }

      const control_ptr = this.__allocator.allocate(CONTROL_BLOCK_SIZE, this.constructor as IViewConstructor, this.__owner_allocation_ptr);

      if (control_ptr === GLOBAL_NULL_POINTER) {
         throw new Error('out of memory');
      }

      this.$control_block_ptr = control_ptr;

      const view = new DataView(this.__allocator.buffer);

      view.setUint32(control_ptr + OFFSET_COUNT, 0, LITTLE_ENDIAN);
      view.setUint32(control_ptr + OFFSET_DENSE_PTR, 0, LITTLE_ENDIAN);
      view.setUint32(control_ptr + OFFSET_SPARSE_PTR, 0, LITTLE_ENDIAN);
   }

   $set_size(
      new_size: number
   ) {
      const ptr = this.$control_block_ptr;

      if (ptr === GLOBAL_NULL_POINTER) {
         return;
      }

      new DataView(this.__allocator.buffer).setUint32(ptr + OFFSET_COUNT, new_size, LITTLE_ENDIAN);
   }
}