/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/fixed-array-string.test.ts
 */

import { describe, it, expect, beforeEach, spyOn } from 'bun:test';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';
import { FixedArrayString } from '@self/runtime/skeletons/fixed/array/fixed-array-string';

describe('runtime skeletons - FixedArrayString', () => {
   let allocator: TlsfAllocator;
   let test_view_buffer: ArrayBuffer;
   let string_array: FixedArrayString<2>;

   beforeEach(() => {
      const allocator_pool_buffer = new ArrayBuffer(1024 * 16);
      allocator = new TlsfAllocator(allocator_pool_buffer);
      test_view_buffer = new ArrayBuffer(256);
      string_array = new FixedArrayString(test_view_buffer, 0, allocator, 2);
   });

   it('should initialize with correct length', () => {
      expect(string_array.length).toBe(2);
   });

   it('should allow getting and setting string elements', () => {
      string_array.set(0, 'hello');
      string_array.set(1, 'world');

      expect(string_array.get(0)).toBe('hello');
      expect(string_array.get(1)).toBe('world');
   });

   describe('indexOf and includes', () => {
      beforeEach(() => {
         string_array.set(0, 'alpha');
         string_array.set(1, 'beta');
      });

      it('should find index of a string', () => {
         expect(string_array.indexOf('beta')).toBe(1);
      });

      it('should return -1 for non-existent string', () => {
         expect(string_array.indexOf('gamma')).toBe(-1);
      });

      it('should return true from includes()', () => {
         expect(string_array.includes('alpha')).toBe(true);
      });
   });


   it('setting a string should allocate memory for it', () => {
      string_array.set(0, 'test1');
      const dynamic_string_view_element = string_array.$get_element_view(0)!;

      expect(dynamic_string_view_element).toBeInstanceOf(DynamicString);
      expect(dynamic_string_view_element.$control_block_ptr).not.toBe(GLOBAL_NULL_POINTER);
   });

   it('free() should call free on its DynamicString elements', () => {
      string_array.set(0, 'alpha');
      string_array.set(1, 'beta');

      expect(string_array.get(0)).toBe('alpha');
      expect(string_array.get(1)).toBe('beta');

      const free_spy_on_prototype = spyOn(DynamicString.prototype, 'free');
      string_array.free();
      expect(free_spy_on_prototype).toHaveBeenCalledTimes(2);
      free_spy_on_prototype.mockRestore();
   });
});