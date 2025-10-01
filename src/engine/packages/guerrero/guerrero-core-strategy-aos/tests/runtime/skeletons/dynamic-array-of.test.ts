/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/dynamic-array-of.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import type { IView, Pointer, SchemaLayout, IViewConstructor, IHashable } from '@eldritch-engine/type-utils/guerrero/index';
import { hash_djb2 } from '@eldritch-engine/utils/hash';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER, LITTLE_ENDIAN, POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicArrayOf } from '@self/runtime/skeletons/dynamic/array/dynamic-array-of';
import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';

class MockStructView implements IView, IHashable {
   static readonly __schema: SchemaLayout = {
      class_name: MockStructView.name,
      total_size: 8,
      alignment: 4,
      has_dynamic_data: true,
      properties: [
         {
            property_key: 'id',
            order: 0,
            type: 'u32',
            start_line: 0,
            end_line: 0,
            offset: 0,
            size: 4,
            alignment: 4,
            binary_info: {
               size: 4,
               alignment: 4,
               is_nested_struct: false,
               is_dynamic: false,
               has_dynamic_data: false,
               is_optional: false,
               is_ptr: false
            }
         },
         {
            property_key: 'name',
            order: 1,
            type: 'string',
            start_line: 0,
            end_line: 0,
            offset: 4,
            size: 4,
            alignment: 4,
            binary_info: {
               size: 4,
               alignment: 4,
               is_nested_struct: false,
               is_dynamic: true,
               has_dynamic_data: true,
               is_optional: false,
               is_ptr: true
            }
         }
      ]
   };

   readonly __view: DataView;
   readonly __buffer: ArrayBufferLike;
   readonly __byte_offset: Pointer;
   readonly __allocator: TlsfAllocator;

   #name_view?: DynamicString;

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator
   ) {
      this.__buffer = buffer;
      this.__byte_offset = byte_offset;
      this.__allocator = allocator;
      this.__view = new DataView(buffer);
   }

   get id(): number {
      return this.__view.getUint32(this.__byte_offset + 0, LITTLE_ENDIAN);
   }

   set id(value: number) {
      this.__view.setUint32(this.__byte_offset + 0, value, LITTLE_ENDIAN);
   }

   get name(): DynamicString {
      if (!this.#name_view) {
         this.#name_view = new DynamicString(this.__buffer, this.__byte_offset + 4, this.__allocator);
      }

      return this.#name_view;
   }

   free(): void {
      this.name.free();
   }

   $copy_from(source: MockStructView): void {
      this.id = source.id;
      this.name.value = source.name.value;
   }

   $hash(): number {
      return hash_djb2(this.name.value) ^ this.id;
   }

   $equals(other: this): boolean {
      return this.id === other.id
         && this.name.value === other.name.value;
   }
}

describe('runtime skeletons - DynamicArrayOf<IView>', () => {
   const ALLOCATOR_POOL_SIZE = 1024 * 64;
   const VIEW_CONTAINER_BUFFER_SIZE = 256;

   let allocator: TlsfAllocator;
   let view_container_buffer: ArrayBuffer;
   let dyn_array: DynamicArrayOf<MockStructView>;
   let temp_allocator: TlsfAllocator;

   beforeEach(() => {
      const allocator_pool_buffer = new ArrayBuffer(ALLOCATOR_POOL_SIZE);
      allocator = new TlsfAllocator(allocator_pool_buffer, 0, ALLOCATOR_POOL_SIZE);
      view_container_buffer = new ArrayBuffer(VIEW_CONTAINER_BUFFER_SIZE);

      dyn_array = new DynamicArrayOf(view_container_buffer, 0, allocator, MockStructView as IViewConstructor<MockStructView>);

      temp_allocator = new TlsfAllocator(new ArrayBuffer(1024), 0, 1024);
   });

   const create_source_view = (id: number, name: string): MockStructView => {
      const source_buffer = new ArrayBuffer(MockStructView.__schema.total_size);
      const view = new MockStructView(source_buffer, 0, temp_allocator);

      view.id = id;
      view.name.value = name;

      return view;
   };

   it('should initialize as an empty array', () => {
      expect(dyn_array.length).toBe(0);
      expect(dyn_array[0]).toBeUndefined();
      expect(dyn_array.$control_block_ptr).toBe(GLOBAL_NULL_POINTER);
   });

   it('should push new views and perform a deep copy of their data', () => {
      const source_view = create_source_view(10, 'alpha');

      dyn_array.push(source_view);

      expect(dyn_array.length).toBe(1);

      const view_in_array = dyn_array[0]!;
      expect(view_in_array).toBeDefined();
      expect(view_in_array.id).toBe(10);
      expect(view_in_array.name.value).toBe('alpha');

      source_view.id = 99;
      source_view.name.value = 'beta';

      const view_in_array_again = dyn_array[0]!;
      expect(view_in_array_again.id).toBe(10);
      expect(view_in_array_again.name.value).toBe('alpha');
   });

   it('should get and set views by index, performing a deep copy', () => {
      const source_view1 = create_source_view(1, 'one');
      const source_view2 = create_source_view(2, 'two');
      dyn_array.push(source_view1, source_view2);

      const retrieved_view = dyn_array.get(0)!;
      expect(retrieved_view.id).toBe(1);
      expect(retrieved_view.name.value).toBe('one');

      const new_source_view = create_source_view(99, 'ninety-nine');

      const set_success = dyn_array.set(0, new_source_view);
      expect(set_success).toBe(true);
      expect(dyn_array.length).toBe(2);

      const updated_view_in_array = dyn_array[0]!;
      expect(updated_view_in_array.id).toBe(99);
      expect(updated_view_in_array.name.value).toBe('ninety-nine');

      new_source_view.id = 100;
      expect(updated_view_in_array.id).toBe(99);

      const set_failure = dyn_array.set(10, new_source_view);
      expect(set_failure).toBe(false);
   });

   it('should remove and return the last element with pop, transferring ownership', () => {
      const v1 = create_source_view(1, 'one');
      const v2 = create_source_view(2, 'two');
      dyn_array.push(v1, v2);
      expect(dyn_array.length).toBe(2);

      const popped_view = dyn_array.pop();
      expect(popped_view).toBeDefined();
      expect(popped_view!.id).toBe(2);
      expect(popped_view!.name.value).toBe('two');
      expect(dyn_array.length).toBe(1);
      expect(dyn_array[1]).toBeUndefined();

      const popped_view_name_ptr = popped_view!.name.$control_block_ptr;
      expect(allocator.is_valid_memory_range(popped_view_name_ptr, 1)).toBe(true);

      popped_view!.free();
      expect(allocator.is_valid_memory_range(popped_view_name_ptr, 1)).toBe(false);

      const popped_view_2 = dyn_array.pop();
      expect(popped_view_2!.id).toBe(1);
      expect(dyn_array.length).toBe(0);
      popped_view_2!.free();

      expect(dyn_array.pop()).toBeUndefined();
   });

   it('should free old elements when using $copy_from to prevent memory leaks', () => {
      dyn_array.push(create_source_view(1, 'leaked?'));
      dyn_array.push(create_source_view(2, 'hope not'));

      const string_ptr_1 = dyn_array[0]!.name.$control_block_ptr;
      const string_ptr_2 = dyn_array[1]!.name.$control_block_ptr;
      expect(string_ptr_1).not.toBe(GLOBAL_NULL_POINTER);
      expect(string_ptr_2).not.toBe(GLOBAL_NULL_POINTER);

      dyn_array.$copy_from([]);

      expect(dyn_array.length).toBe(0);
      expect(allocator.is_valid_memory_range(string_ptr_1, 1)).toBe(false);
      expect(allocator.is_valid_memory_range(string_ptr_2, 1)).toBe(false);
   });

   it('should be iterable and support spread syntax', () => {
      const sources = [
         create_source_view(1, 'a'),
         create_source_view(2, 'b'),
         create_source_view(3, 'c'),
      ];
      dyn_array.push(...sources);

      const collected: { id: number, name: string }[] = [];

      for (const item of dyn_array) {
         collected.push({
            id: item.id,
            name: item.name.value
         });
      }

      expect(collected).toEqual([
         { id: 1, name: 'a' },
         { id: 2, name: 'b' },
         { id: 3, name: 'c' },
      ]);

      const spread_array = [...dyn_array];
      expect(spread_array.length).toBe(3);
      expect(spread_array[1]!.id).toBe(2);
      expect(spread_array[1]!.name.value).toBe('b');
   });

   describe('indexOf and includes', () => {
      beforeEach(() => {
         dyn_array.push(create_source_view(10, 'A'));
         dyn_array.push(create_source_view(20, 'B'));
         dyn_array.push(create_source_view(30, 'C'));
         dyn_array.push(create_source_view(20, 'B')); // duplicate
      });

      it('should find the first index of a struct using $equals', () => {
         const search_for = create_source_view(20, 'B');
         expect(dyn_array.indexOf(search_for)).toBe(1);
      });

      it('should return -1 if the struct is not found', () => {
         const search_for = create_source_view(99, 'Z');
         expect(dyn_array.indexOf(search_for)).toBe(-1);
      });

      it('should respect the fromIndex parameter', () => {
         const search_for = create_source_view(20, 'B');
         expect(dyn_array.indexOf(search_for, 2)).toBe(3);
      });

      it('should return true from includes() if the struct exists', () => {
         const search_for = create_source_view(30, 'C');
         expect(dyn_array.includes(search_for)).toBe(true);
      });

      it('should return false from includes() if the struct does not exist', () => {
         const search_for = create_source_view(99, 'Z');
         expect(dyn_array.includes(search_for)).toBe(false);
      });
   });

   it('should free all memory, including nested dynamic data, when free() is called', () => {
      const v1 = create_source_view(1, "item one");
      const v2 = create_source_view(2, "item two");
      dyn_array.push(v1, v2);

      const control_ptr = dyn_array.$control_block_ptr;
      const elements_ptr = dyn_array.$get_elements_buffer_ptr();
      const str1_ptr = dyn_array[0]!.name.$control_block_ptr;
      const str2_ptr = dyn_array[1]!.name.$control_block_ptr;

      expect(control_ptr).not.toBe(GLOBAL_NULL_POINTER);
      expect(elements_ptr).not.toBe(GLOBAL_NULL_POINTER);
      expect(str1_ptr).not.toBe(GLOBAL_NULL_POINTER);
      expect(str2_ptr).not.toBe(GLOBAL_NULL_POINTER);

      dyn_array.free();

      expect(dyn_array.$control_block_ptr).toBe(GLOBAL_NULL_POINTER);
      expect(dyn_array.length).toBe(0);

      const new_alloc = allocator.allocate(1);
      expect(new_alloc).not.toBe(GLOBAL_NULL_POINTER);
      allocator.free(new_alloc);
   });

   it('should handle multiple instances without interference', () => {
      const arr1 = new DynamicArrayOf(view_container_buffer, 0, allocator, MockStructView as IViewConstructor<MockStructView>);
      const arr2 = new DynamicArrayOf(view_container_buffer, POINTER_SIZE, allocator, MockStructView as IViewConstructor<MockStructView>);

      arr1.push(create_source_view(1, 'a1'));
      arr1.push(create_source_view(2, 'a2'));

      arr2.push(create_source_view(101, 'b1'));
      arr2.push(create_source_view(102, 'b2'));
      arr2.push(create_source_view(103, 'b3'));

      expect(arr1.length).toBe(2);
      expect(arr2.length).toBe(3);
      expect(arr1[1]!.name.value).toBe('a2');
      expect(arr2[2]!.name.value).toBe('b3');

      arr1.pop()!.free();
      expect(arr1.length).toBe(1);
      expect(arr2.length).toBe(3);
      expect(arr1[0]!.id).toBe(1);

      arr2.free();
      expect(arr2.length).toBe(0);
      expect(arr1.length).toBe(1);
      expect(arr1[0]!.id).toBe(1);
      expect(arr1[0]!.name.value).toBe('a1');
   });
});