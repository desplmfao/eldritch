/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/dynamic-string.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

import type { Pointer } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER, POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';

const text_encoder = new TextEncoder();

describe('runtime skeletons - DynamicString', () => {
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

   function create_string_view(offset: Pointer): DynamicString {
      if (offset + DynamicString.__schema.total_size > view_container_buffer.byteLength) {
         throw new Error('view container buffer too small for DynamicString at given offset');
      }

      return new DynamicString(view_container_buffer, offset, allocator);
   }

   it('should have correct static schema information', () => {
      expect(DynamicString.__schema.class_ctor).toBe(DynamicString);
      expect(DynamicString.__schema.total_size).toBe(POINTER_SIZE);
      expect(DynamicString.__schema.alignment).toBe(POINTER_SIZE);
      expect(DynamicString.__schema.has_dynamic_data).toBe(true);
      expect(DynamicString.__schema.properties.length).toBe(1);
      expect(DynamicString.__schema.properties[0]!.property_key).toBe('value');
   });

   it('should initialize with an empty string and null data pointer', () => {
      const view_instance = create_string_view(0);
      expect(view_instance.value).toBe('');
      expect(view_instance.$control_block_ptr).toBe(GLOBAL_NULL_POINTER);
   });

   it('should set and get a simple string', () => {
      const view_instance = create_string_view(0);
      const test_string = 'Hello, World!';

      view_instance.value = test_string;
      expect(view_instance.value).toBe(test_string);

      const internal_data_ptr = view_instance.$control_block_ptr;
      expect(internal_data_ptr).not.toBe(GLOBAL_NULL_POINTER);
   });

   it('should set to an empty string, freeing previous data', () => {
      const view_instance = create_string_view(0);

      view_instance.value = 'not empty';
      const ptr_before_empty = view_instance.$control_block_ptr;
      expect(ptr_before_empty).not.toBe(GLOBAL_NULL_POINTER);

      view_instance.value = '';
      expect(view_instance.value).toBe('');
      const ptr_after_empty = view_instance.$control_block_ptr;
      expect(ptr_after_empty).toBe(GLOBAL_NULL_POINTER);

      const check_alloc = allocator.allocate(text_encoder.encode('not empty').length + 4);
      expect(check_alloc).not.toBe(GLOBAL_NULL_POINTER);

      if (check_alloc !== GLOBAL_NULL_POINTER) {
         allocator.free(check_alloc);
      }
   });

   it('should handle reallocating from a short string to a long string', () => {
      const view_instance = create_string_view(0);
      const short_string = 'short';
      const long_string = 'this is a much, much, much longer string that definitely requires reallocation';

      view_instance.value = short_string;
      expect(view_instance.value).toBe(short_string);

      const temp_allocs: Pointer[] = [];

      for (let i = 0; i < 5; ++i) {
         const p = allocator.allocate(32);

         if (p !== GLOBAL_NULL_POINTER) {
            temp_allocs.push(p);
         }
      }

      view_instance.value = long_string;
      const ptr2 = view_instance.$control_block_ptr;
      expect(view_instance.value).toBe(long_string);
      expect(ptr2).not.toBe(GLOBAL_NULL_POINTER);

      for (const p of temp_allocs) {
         allocator.free(p);
      }
   });

   it('should handle reallocating from a long string to a short string', () => {
      const view_instance = create_string_view(0);
      const long_string = 'another very long string to start with for this test case';
      const short_string = 'tiny';

      view_instance.value = long_string;
      expect(view_instance.value).toBe(long_string);

      view_instance.value = short_string;
      const ptr2 = view_instance.$control_block_ptr;
      expect(view_instance.value).toBe(short_string);
      expect(ptr2).not.toBe(GLOBAL_NULL_POINTER);
   });

   it('multiple DynamicString instances should manage their data independently', () => {
      const view1 = create_string_view(0);
      const view2 = create_string_view(DynamicString.__schema.total_size);
      const str1 = 'string for view 1';
      const str2 = 'totally different string for view 2';

      view1.value = str1;
      view2.value = str2;

      expect(view1.value).toBe(str1);
      expect(view2.value).toBe(str2);

      view1.value = 'updated view 1';
      expect(view1.value).toBe('updated view 1');
      expect(view2.value).toBe(str2);

      view2.free();
      expect(view2.value).toBe('');
      expect(view1.value).toBe('updated view 1');
   });

   it('free() should clear the string and free allocated memory', () => {
      const view_instance = create_string_view(0);

      view_instance.value = 'some data to be freed';
      const ptr_before_free = view_instance.$control_block_ptr;
      expect(ptr_before_free).not.toBe(GLOBAL_NULL_POINTER);

      view_instance.free();
      expect(view_instance.value).toBe('');
      const ptr_after_free = view_instance.$control_block_ptr;
      expect(ptr_after_free).toBe(GLOBAL_NULL_POINTER);
   });

   it('setting value multiple times with varying lengths', () => {
      const view_instance = create_string_view(0);
      const strings = [
         'a', 'ab', 'abc', 'abcd', 'abcde', 'abcdef', 'abcdefg',
         'abcdefgh'.repeat(5), 'tiny', '',
         'another long one that might cause a move in the allocator pool if fragmented',
         'back to short'
      ];

      for (const str of strings) {
         view_instance.value = str;
         expect(view_instance.value).toBe(str);

         if (str === '') {
            expect(view_instance.$control_block_ptr).toBe(GLOBAL_NULL_POINTER);
         } else {
            expect(view_instance.$control_block_ptr).not.toBe(GLOBAL_NULL_POINTER);
         }
      }
   });

   it('should handle utf-8 characters correctly', () => {
      const view_instance = create_string_view(0);
      const utf8_string = 'こんにちは世界 sección';

      view_instance.value = utf8_string;
      expect(view_instance.value).toBe(utf8_string);

      const ptr = view_instance.$control_block_ptr;
      expect(ptr).not.toBe(GLOBAL_NULL_POINTER);

      const encoded_original = text_encoder.encode(utf8_string);
      const string_data_buffer = allocator.buffer;
      const string_data_view = new DataView(string_data_buffer);

      const stored_length = string_data_view.getUint32(ptr, true);
      expect(stored_length).toBe(encoded_original.byteLength);

      const stored_bytes = new Uint8Array(string_data_buffer, ptr + 4, stored_length);
      expect(stored_bytes).toEqual(encoded_original);
   });

   describe('low-level pointer manipulation', () => {
      it('should allow setting the control pointer to null', () => {
         const view = create_string_view(0);
         view.value = 'hello';
         expect(view.$control_block_ptr).not.toBe(GLOBAL_NULL_POINTER);

         view.$control_block_ptr = GLOBAL_NULL_POINTER;
         expect(view.value).toBe('');
         expect(view.$control_block_ptr).toBe(GLOBAL_NULL_POINTER);
      });

      it('should allow setting the control pointer to a valid allocation', () => {
         const view = create_string_view(0);
         const str = 'manual';
         const encoded = text_encoder.encode(str);
         const size = 4 + encoded.length;

         const ptr = allocator.allocate(size);
         const string_data_view = new DataView(allocator.buffer);
         string_data_view.setUint32(ptr, encoded.length, true);
         new Uint8Array(allocator.buffer, ptr + 4, encoded.length).set(encoded);

         view.$control_block_ptr = ptr;
         expect(view.value).toBe(str);
         expect(view.$control_block_ptr).toBe(ptr);

         view.free();
      });
   });
});