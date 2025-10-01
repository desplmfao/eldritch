/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/dynamic-set-string.test.ts
 */

import { describe, it, expect, beforeEach, spyOn } from 'bun:test';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER, POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicSetString } from '@self/runtime/skeletons/dynamic/set/dynamic-set-string';

describe('runtime skeletons - DynamicSetString', () => {
   const ALLOCATOR_POOL_SIZE = 1024 * 64;
   const VIEW_CONTAINER_BUFFER_SIZE = 256;

   let allocator: TlsfAllocator;
   let view_container_buffer: ArrayBuffer;
   let dyn_set: DynamicSetString;

   beforeEach(() => {
      const allocator_pool_buffer = new ArrayBuffer(ALLOCATOR_POOL_SIZE);

      allocator = new TlsfAllocator(allocator_pool_buffer, 0, ALLOCATOR_POOL_SIZE);
      view_container_buffer = new ArrayBuffer(VIEW_CONTAINER_BUFFER_SIZE);
      dyn_set = new DynamicSetString(view_container_buffer, 0, allocator);
   });

   it('should initialize with size 0', () => {
      expect(dyn_set.size).toBe(0);
   });

   it('should add string values and update size', () => {
      dyn_set.add('hello');
      expect(dyn_set.size).toBe(1);
      expect(dyn_set.has('hello')).toBe(true);

      dyn_set.add('world');
      expect(dyn_set.size).toBe(2);
      expect(dyn_set.has('world')).toBe(true);
   });

   it('should not add a duplicate value', () => {
      dyn_set.add('test');
      dyn_set.add('test');
      expect(dyn_set.size).toBe(1);
   });

   it('should return false for a non-existent value', () => {
      expect(dyn_set.has('nonexistent')).toBe(false);
   });

   it('should delete a value', () => {
      dyn_set.add('to_delete');
      expect(dyn_set.has('to_delete')).toBe(true);

      const was_deleted = dyn_set.delete('to_delete');
      expect(was_deleted).toBe(true);
      expect(dyn_set.has('to_delete')).toBe(false);
      expect(dyn_set.size).toBe(0);
   });

   it('should return false when deleting a non-existent value', () => {
      const was_deleted = dyn_set.delete('not_present');
      expect(was_deleted).toBe(false);
   });

   it('should iterate over values, keys, and entries', () => {
      dyn_set.add('a').add('b').add('c');

      const values = [...dyn_set.values()];
      expect(values).toContain('a');
      expect(values).toContain('b');
      expect(values).toContain('c');
      expect(values.length).toBe(3);

      const keys = [...dyn_set.keys()];
      expect(keys).toEqual(values);

      const entries = [...dyn_set.entries()];
      expect(entries).toContainEqual(['a', 'a']);
      expect(entries).toContainEqual(['b', 'b']);
      expect(entries).toContainEqual(['c', 'c']);
      expect(entries.length).toBe(3);

      const spread_values = [...dyn_set];
      expect(spread_values.sort()).toEqual(values.sort());
   });

   it('should clear all entries', () => {
      dyn_set.add('a').add('b');
      dyn_set.clear();

      expect(dyn_set.size).toBe(0);
      expect(dyn_set.has('a')).toBe(false);
   });

   it('should copy from a native Set<string>', () => {
      const native_set = new Set(['x', 'y', 'z']);
      dyn_set.$copy_from(native_set);

      expect(dyn_set.size).toBe(3);
      expect(dyn_set.has('x')).toBe(true);
      expect(dyn_set.has('y')).toBe(true);
      expect(dyn_set.has('z')).toBe(true);
   });

   it('should copy from another DynamicSetString', () => {
      const source_set = new DynamicSetString(new ArrayBuffer(4), 0, allocator);
      source_set.add('source1').add('source2');

      dyn_set.$copy_from(source_set);
      expect(dyn_set.size).toBe(2);
      expect(dyn_set.has('source1')).toBe(true);

      source_set.add('source3');
      expect(dyn_set.size).toBe(2);
      expect(dyn_set.has('source3')).toBe(false);

      source_set.free();
   });

   it('should handle many items, causing rehashing', () => {
      const count = 50;

      for (let i = 0; i < count; i++) {
         dyn_set.add(`item_${i}`);
      }

      expect(dyn_set.size).toBe(count);

      for (let i = 0; i < count; i++) {
         expect(dyn_set.has(`item_${i}`)).toBe(true);
      }

      expect(dyn_set.has('item_50')).toBe(false);
   });

   it('should free all memory', () => {
      dyn_set.add('a').add('b').add('c');
      const control_ptr_before = dyn_set.$control_block_ptr;
      expect(control_ptr_before).not.toBe(GLOBAL_NULL_POINTER);

      const free_spy = spyOn(allocator, 'free');
      dyn_set.free();
      expect(dyn_set.size).toBe(0);
      const control_ptr_after = dyn_set.$control_block_ptr;
      expect(control_ptr_after).toBe(GLOBAL_NULL_POINTER);

      expect(free_spy.mock.calls.length).toBe(3 + 3 + 1 + 1);
      free_spy.mockRestore();

      const test_alloc = allocator.allocate(100);
      expect(test_alloc).not.toBe(GLOBAL_NULL_POINTER);
   });

   describe('low-level pointer manipulation', () => {
      it('should allow swapping the data of two sets by swapping their control pointers', () => {
         const set1 = new DynamicSetString(view_container_buffer, 0, allocator);
         const set2 = new DynamicSetString(view_container_buffer, POINTER_SIZE, allocator);

         set1.add('a').add('b');
         set2.add('x');

         expect(set1.size).toBe(2);
         expect(set2.size).toBe(1);
         expect(set1.has('a')).toBe(true);
         expect(set2.has('x')).toBe(true);

         const ptr1 = set1.$control_block_ptr;
         const ptr2 = set2.$control_block_ptr;

         set1.$control_block_ptr = ptr2;
         set2.$control_block_ptr = ptr1;

         expect(set1.size).toBe(1);
         expect(set2.size).toBe(2);
         expect(set1.has('x')).toBe(true);
         expect(set2.has('a')).toBe(true);
         expect(set1.has('a')).toBe(false);
         expect(set2.has('x')).toBe(false);

         set1.free();
         set2.free();
      });
   });
});