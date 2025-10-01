/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/array/dynamic-array.ts
 */

import type { Pointer, IView, SchemaLayout, IViewConstructor } from '@eldritch-engine/type-utils/guerrero/index';
import type { IGuerreroArray } from '@eldritch-engine/type-utils/guerrero/interfaces';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER, LITTLE_ENDIAN } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

export const OFFSET_LENGTH = 0;
export const OFFSET_CAPACITY = 4;
export const OFFSET_ELEMENTS_PTR = 8;
export const CONTROL_BLOCK_SIZE = 12;

export class DynamicArray<T_Internal extends IView, T_Public> implements IGuerreroArray<T_Public> {

   static __schema: SchemaLayout;

   readonly __view: DataView;
   readonly __buffer: ArrayBufferLike;
   readonly __byte_offset: Pointer;
   readonly __allocator: TlsfAllocator;

   readonly __value_constructor: IViewConstructor<T_Internal>;
   readonly __value_schema: SchemaLayout;

   readonly __owner_constructor?: IViewConstructor<IView>;
   readonly __owner_allocation_ptr?: Pointer;

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
      //
      value_constructor: IViewConstructor<T_Internal>,
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
      this.__value_schema = this.__value_constructor.__schema;

      this.__owner_constructor = owner_constructor;
      this.__owner_allocation_ptr = owner_allocation_ptr;
   }

   [n: number]: T_Public | undefined;

   entries(): IterableIterator<[number, T_Public]> {
      throw new Error('method not implemented');
   }

   keys(): IterableIterator<number> {
      throw new Error('method not implemented');
   }

   values(): IterableIterator<T_Public> {
      throw new Error('method not implemented');
   }

   get(index: number): T_Public | undefined {
      throw new Error('method not implemented');
   }

   set(index: number, value: T_Public): boolean {
      throw new Error('method not implemented');
   }

   push(...values: T_Public[]): number {
      throw new Error('method not implemented');
   }

   pop(): T_Public | undefined {
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

   free(): void {
      throw new Error('method not implemented');
   }

   $copy_from(source: this | IterableIterator<T_Public>): void {
      throw new Error('method not implemented');
   }

   [Symbol.iterator](): IterableIterator<T_Public, T_Public, T_Public> {
      throw new Error('method not implemented');
   }

   get length(): number {
      const ptr = this.$control_block_ptr;

      if (ptr === GLOBAL_NULL_POINTER) {
         return 0;
      }

      const data_buffer = this.__allocator.buffer;

      return new DataView(data_buffer).getUint32(ptr + OFFSET_LENGTH, LITTLE_ENDIAN);
   }

   get $control_block_ptr(): Pointer {
      return this.__view.getUint32(this.__byte_offset, LITTLE_ENDIAN);
   }

   set $control_block_ptr(ptr: Pointer) {
      this.__view.setUint32(this.__byte_offset, ptr, LITTLE_ENDIAN);
   }

   get $capacity(): number {
      const ptr = this.$control_block_ptr;

      if (ptr === GLOBAL_NULL_POINTER) {
         return 0;
      }

      const data_buffer = this.__allocator.buffer;

      return new DataView(data_buffer).getUint32(ptr + OFFSET_CAPACITY, LITTLE_ENDIAN);
   }

   static $create_proxy_handler<T_Internal extends IView, T_Public>(): ProxyHandler<DynamicArray<T_Internal, T_Public> & IGuerreroArray<T_Public>> {
      return {
         get(target, property, receiver) {
            if (typeof property === 'string') {
               const index = Number.parseInt(property, 10);

               if (
                  !Number.isNaN(index)
                  && String(index) === property
               ) {
                  return target.get(index);
               }
            }

            const value = Reflect.get(target, property, receiver);

            return typeof value === 'function' ? value.bind(receiver) : value;
         },

         set(target, property, value, receiver) {
            if (typeof property === 'string') {
               const index = Number.parseInt(property, 10);

               if (
                  !Number.isNaN(index)
                  && String(index) === property
               ) {
                  return target.set(index, value);
               }
            }

            return Reflect.set(target, property, value, receiver);
         },

         has(target, property) {
            if (typeof property === 'string') {
               const index = Number.parseInt(property, 10);

               if (
                  !Number.isNaN(index)
                  && String(index) === property
               ) {
                  return index >= 0
                     && index < target.length;
               }
            }

            return Reflect.has(target, property);
         },

         ownKeys(target) {
            const keys = [];

            for (let i = 0; i < target.length; i++) {
               keys.push(String(i));
            }

            keys.push('length', ...Object.getOwnPropertyNames(Object.getPrototypeOf(target)));

            return keys;
         },

         getOwnPropertyDescriptor(target, property) {
            if (
               typeof property === 'string' &&
               /^\d+$/.test(property)
            ) {
               const index = Number(property);

               if (index < target.length) {
                  return {
                     value: target.get(index),
                     writable: true,
                     enumerable: true,
                     configurable: true,
                  };
               }
            }

            return Reflect.getOwnPropertyDescriptor(target, property);
         },
      };
   }

   $get_element_view(
      index: number,
      //
      is_new_instance: boolean = false
   ): T_Internal | undefined {
      if (
         index < 0
         || index >= this.length
      ) {
         return;
      }

      const elements_ptr = this.$get_elements_buffer_ptr();

      if (elements_ptr === GLOBAL_NULL_POINTER) {
         return;
      }

      const data_buffer = this.__allocator.buffer;
      const element_offset = elements_ptr + (index * this.__value_schema.total_size);

      return new this.__value_constructor(
         data_buffer,
         element_offset,
         this.__allocator,
         //
         undefined,
         undefined,
         //
         is_new_instance
      );
   }

   $push_new_slot(): T_Internal {
      const current_length = this.length;

      if (current_length >= this.$capacity) {
         this.$grow();
      }

      this.$set_length(current_length + 1);

      const new_element_view = this.$get_element_view(current_length, /* is_new_instance */ true)!;

      const element_bytes = new Uint8Array(
         new_element_view.__buffer,
         new_element_view.__byte_offset,
         this.__value_schema.total_size
      );

      element_bytes.fill(0);

      return new_element_view;
   }

   $get_elements_buffer_ptr(): Pointer {
      const ptr = this.$control_block_ptr;

      if (ptr === GLOBAL_NULL_POINTER) {
         return GLOBAL_NULL_POINTER;
      }

      const data_buffer = this.__allocator.buffer;

      return new DataView(data_buffer).getUint32(ptr + OFFSET_ELEMENTS_PTR, LITTLE_ENDIAN);
   }

   $set_length(
      new_length: number
   ): void {
      if (new_length > this.$capacity) {
         this.$grow(new_length);
      }

      const ptr = this.$control_block_ptr;

      if (ptr === GLOBAL_NULL_POINTER) {
         return;
      }

      const data_buffer = this.__allocator.buffer;

      new DataView(data_buffer).setUint32(ptr + OFFSET_LENGTH, new_length, LITTLE_ENDIAN);
   }

   $grow(
      min_capacity?: number
   ): number {
      let new_capacity = Math.max(4, this.$capacity * 2);

      if (min_capacity != null) {
         new_capacity = Math.max(new_capacity, min_capacity);
      }

      const element_stride = this.__value_schema.total_size;
      const new_buffer_size = new_capacity * element_stride;

      const old_elements_ptr = this.$get_elements_buffer_ptr();
      const new_elements_ptr = this.__allocator.allocate(new_buffer_size, this.constructor as IViewConstructor, this.__owner_allocation_ptr);

      if (new_elements_ptr === GLOBAL_NULL_POINTER) {
         throw new Error('failed to grow dynamic array: out of memory');
      }

      const data_buffer = this.__allocator.buffer;

      if (old_elements_ptr !== GLOBAL_NULL_POINTER) {
         const bytes_to_copy = this.length * element_stride;

         if (bytes_to_copy > 0) {
            const src_array = new Uint8Array(data_buffer, old_elements_ptr, bytes_to_copy);
            const dest_array = new Uint8Array(data_buffer, new_elements_ptr, bytes_to_copy);

            dest_array.set(src_array);
         }

         this.__allocator.free(old_elements_ptr);
      } else {
         const new_buffer_bytes = new Uint8Array(data_buffer, new_elements_ptr, new_buffer_size);

         new_buffer_bytes.fill(0);
      }

      let control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         control_ptr = this.__allocator.allocate(CONTROL_BLOCK_SIZE, this.constructor as IViewConstructor, this.__owner_allocation_ptr);

         if (control_ptr === GLOBAL_NULL_POINTER) {
            throw new Error('failed to allocate control block: out of memory');
         }

         this.$control_block_ptr = control_ptr;
         this.$set_length(0);
      }

      const control_view = new DataView(data_buffer);

      control_view.setUint32(control_ptr + OFFSET_CAPACITY, new_capacity, LITTLE_ENDIAN);
      control_view.setUint32(control_ptr + OFFSET_ELEMENTS_PTR, new_elements_ptr, LITTLE_ENDIAN);

      return new_capacity;
   }
}