/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/dynamic-array-string.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

import type { Pointer } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER, POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicArrayString } from '@self/runtime/skeletons/dynamic/array/dynamic-array-string';

describe('runtime skeletons - DynamicArrayString', () => {
   const ALLOCATOR_POOL_SIZE = 1024 * 16;
   const VIEW_CONTAINER_BUFFER_SIZE = 256;

   let allocator: TlsfAllocator;
   let view_container_buffer: ArrayBuffer;

   beforeEach(() => {
      const allocator_pool_buffer = new ArrayBuffer(ALLOCATOR_POOL_SIZE);

      allocator = new TlsfAllocator(allocator_pool_buffer, 0, ALLOCATOR_POOL_SIZE);
      view_container_buffer = new ArrayBuffer(VIEW_CONTAINER_BUFFER_SIZE);
   });

   afterEach(() => { });

   function create_string_view(offset: Pointer): DynamicArrayString {
      if (offset + DynamicArrayString.__schema.total_size > view_container_buffer.byteLength) {
         throw new Error('view container buffer too small for DynamicString at given offset');
      }

      return new DynamicArrayString(view_container_buffer, offset, allocator);
   }

   it('should initialize as an empty array', () => {
      const dyn_array_string = create_string_view(0);
      expect(dyn_array_string.length).toBe(0);
      expect(dyn_array_string[0]).toBeUndefined();
      expect(dyn_array_string.$control_block_ptr).toBe(GLOBAL_NULL_POINTER);
   });

   it('should push strings and update length', () => {
      const dyn_array_string = create_string_view(0);
      dyn_array_string.push('hello');
      expect(dyn_array_string.length).toBe(1);
      expect(dyn_array_string[0]).toBe('hello');

      dyn_array_string.push('world');
      expect(dyn_array_string.length).toBe(2);
      expect(dyn_array_string[0]).toBe('hello');
      expect(dyn_array_string[1]).toBe('world');

      expect(dyn_array_string.$control_block_ptr).not.toBe(GLOBAL_NULL_POINTER);
   });

   it('should get and set values using index access', () => {
      const dyn_array_string = create_string_view(0);
      dyn_array_string.push('a');
      dyn_array_string.push('b');
      dyn_array_string.push('c');

      expect(dyn_array_string[1]).toBe('b');

      dyn_array_string[1] = 'B';
      expect(dyn_array_string[1]).toBe('B');
      expect(dyn_array_string.length).toBe(3);

      const success = dyn_array_string.set(1, 'beta');
      expect(success).toBe(true);
      expect(dyn_array_string[1]).toBe('beta');

      const failure = dyn_array_string.set(99, 'out of bounds');
      expect(failure).toBe(false);
      expect(dyn_array_string.length).toBe(3);
   });

   it('should pop the last string and return it, updating length', () => {
      const dyn_array_string = create_string_view(0);
      dyn_array_string.push('one');
      dyn_array_string.push('two');
      dyn_array_string.push('three');

      expect(dyn_array_string.pop()).toBe('three');
      expect(dyn_array_string.length).toBe(2);
      expect(dyn_array_string[2]).toBeUndefined();

      expect(dyn_array_string.pop()).toBe('two');
      expect(dyn_array_string.length).toBe(1);

      expect(dyn_array_string.pop()).toBe('one');
      expect(dyn_array_string.length).toBe(0);

      expect(dyn_array_string.pop()).toBeUndefined();
      expect(dyn_array_string.length).toBe(0);
   });

   it('should be iterable using for...of and spread syntax', () => {
      const dyn_array_string = create_string_view(0);
      const values = ['x', 'y', 'z'];

      for (const v of values) {
         dyn_array_string.push(v);
      }

      const collected_values: string[] = [];

      for (const item of dyn_array_string) {
         collected_values.push(item);
      }

      expect(collected_values).toEqual(values);

      const spread_values = [...dyn_array_string];
      expect(spread_values).toEqual(values);
   });

   describe('indexOf and includes', () => {
      let dyn_array_string: DynamicArrayString;

      beforeEach(() => {
         dyn_array_string = create_string_view(0);
         dyn_array_string.push('apple', 'banana', 'cherry', 'banana');
      });

      it('should find the first index of a string', () => {
         expect(dyn_array_string.indexOf('banana')).toBe(1);
      });

      it('should return -1 if the string is not found', () => {
         expect(dyn_array_string.indexOf('grape')).toBe(-1);
      });

      it('should respect the fromIndex parameter', () => {
         expect(dyn_array_string.indexOf('banana', 2)).toBe(3);
      });

      it('should return true from includes() if the string exists', () => {
         expect(dyn_array_string.includes('cherry')).toBe(true);
      });

      it('should return false from includes() if the string does not exist', () => {
         expect(dyn_array_string.includes('grape')).toBe(false);
      });
   });

   it('should handle growing beyond initial capacity', () => {
      const dyn_array_string = create_string_view(0);
      const num_items = 10;

      for (let i = 0; i < num_items; i++) {
         dyn_array_string.push(`item_${i}`);
      }

      expect(dyn_array_string.length).toBe(num_items);

      for (let i = 0; i < num_items; i++) {
         expect(dyn_array_string[i]).toBe(`item_${i}`);
      }
   });

   it('should handle empty strings correctly', () => {
      const dyn_array_string = create_string_view(0);
      dyn_array_string.push('');
      dyn_array_string.push('not-empty');

      expect(dyn_array_string.length).toBe(2);
      expect(dyn_array_string[0]).toBe('');
      expect(dyn_array_string[1]).toBe('not-empty');

      dyn_array_string[0] = 'was-empty';
      dyn_array_string[1] = '';

      expect(dyn_array_string[0]).toBe('was-empty');
      expect(dyn_array_string[1]).toBe('');
   });

   it('should free all associated memory upon calling free()', () => {
      // TODO
   });

   it('multiple instances should not interfere with each other', () => {
      const arr1_offset = 0;
      const arr2_offset = POINTER_SIZE;

      const arr1 = new DynamicArrayString(view_container_buffer, arr1_offset, allocator);
      const arr2 = new DynamicArrayString(view_container_buffer, arr2_offset, allocator);

      arr1.push('one');
      arr1.push('two');

      arr2.push('alpha');
      arr2.push('beta');
      arr2.push('gamma');

      expect(arr1.length).toBe(2);
      expect(arr2.length).toBe(3);
      expect([...arr1]).toEqual(['one', 'two']);
      expect([...arr2]).toEqual(['alpha', 'beta', 'gamma']);

      arr1.pop();
      expect(arr1.length).toBe(1);
      expect(arr2.length).toBe(3);
      expect(arr1[0]).toBe('one');

      arr2.free();
      expect(arr2.length).toBe(0);
      expect(arr1.length).toBe(1);
      expect(arr1[0]).toBe('one');
   });

   describe('low-level pointer manipulation', () => {
      it('should allow swapping the data of two arrays by swapping their control pointers', () => {
         const arr1 = new DynamicArrayString(view_container_buffer, 0, allocator);
         const arr2 = new DynamicArrayString(view_container_buffer, POINTER_SIZE, allocator);

         arr1.push('a', 'b');
         arr2.push('x', 'y', 'z');

         expect(arr1.length).toBe(2);
         expect([...arr1]).toEqual(['a', 'b']);
         expect(arr2.length).toBe(3);
         expect([...arr2]).toEqual(['x', 'y', 'z']);

         const ptr1 = arr1.$control_block_ptr;
         const ptr2 = arr2.$control_block_ptr;

         arr1.$control_block_ptr = ptr2;
         arr2.$control_block_ptr = ptr1;

         expect(arr1.length).toBe(3);
         expect([...arr1]).toEqual(['x', 'y', 'z']);
         expect(arr2.length).toBe(2);
         expect([...arr2]).toEqual(['a', 'b']);

         arr1.free();
         arr2.free();
      });

      it('should point to nothing after its pointer is set to null', () => {
         const dyn_array_string = create_string_view(0);
         dyn_array_string.push('hello');
         expect(dyn_array_string.length).toBe(1);

         dyn_array_string.$control_block_ptr = GLOBAL_NULL_POINTER;
         expect(dyn_array_string.length).toBe(0);
         expect(dyn_array_string[0]).toBeUndefined();
      });
   });
});