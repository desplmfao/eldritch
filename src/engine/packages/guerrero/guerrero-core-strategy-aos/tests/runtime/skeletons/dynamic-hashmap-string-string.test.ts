/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/dynamic-hashmap-string-string.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

import { DynamicHashMapStringString } from '@self/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-string-string';
import { POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

describe('runtime skeletons - DynamicHashMapStringString', () => {
   const ALLOCATOR_POOL_SIZE = 1024 * 64;
   const VIEW_CONTAINER_BUFFER_SIZE = 256;

   let allocator: TlsfAllocator;
   let view_container_buffer: ArrayBuffer;
   let dyn_map: DynamicHashMapStringString;

   beforeEach(() => {
      const allocator_pool_buffer = new ArrayBuffer(ALLOCATOR_POOL_SIZE);

      allocator = new TlsfAllocator(allocator_pool_buffer, 0, ALLOCATOR_POOL_SIZE);
      view_container_buffer = new ArrayBuffer(VIEW_CONTAINER_BUFFER_SIZE);
      dyn_map = new DynamicHashMapStringString(view_container_buffer, 0, allocator);
   });

   it('should initialize with size 0', () => {
      expect(dyn_map.size).toBe(0);
   });

   it('should set and get string values', () => {
      dyn_map.set('key1', 'value1');
      expect(dyn_map.size).toBe(1);
      expect(dyn_map.get('key1')).toBe('value1');
   });

   it('should update an existing string value', () => {
      dyn_map.set('key1', 'first');
      dyn_map.set('key1', 'second');
      expect(dyn_map.size).toBe(1);
      expect(dyn_map.get('key1')).toBe('second');
   });

   it('should return undefined for a non-existent key', () => {
      expect(dyn_map.get('nonexistent')).toBeUndefined();
   });

   it('should delete a key-value pair', () => {
      dyn_map.set('key1', 'value1');
      expect(dyn_map.has('key1')).toBe(true);

      const was_deleted = dyn_map.delete('key1');
      expect(was_deleted).toBe(true);
      expect(dyn_map.has('key1')).toBe(false);
      expect(dyn_map.size).toBe(0);
   });

   it('should iterate over entries, keys, and values with native strings', () => {
      dyn_map.set('a', 'alpha');
      dyn_map.set('b', 'beta');
      dyn_map.set('c', 'gamma');

      const entries = [...dyn_map.entries()];
      expect(entries).toContainEqual(['a', 'alpha']);
      expect(entries).toContainEqual(['b', 'beta']);
      expect(entries).toContainEqual(['c', 'gamma']);
      expect(entries.length).toBe(3);

      const keys = [...dyn_map.keys()];
      expect(keys).toContain('a');
      expect(keys).toContain('b');
      expect(keys).toContain('c');
      expect(keys.length).toBe(3);

      const values = [...dyn_map.values()];
      expect(values).toContain('alpha');
      expect(values).toContain('beta');
      expect(values).toContain('gamma');
      expect(values.length).toBe(3);

      const spread_entries = [...dyn_map];
      expect(spread_entries).toEqual(entries);
   });

   it('should clear all entries', () => {
      dyn_map.set('a', '1');
      dyn_map.set('b', '2');
      dyn_map.clear();

      expect(dyn_map.size).toBe(0);
      expect(dyn_map.has('a')).toBe(false);
   });

   it('should copy from a native Map<string, string>', () => {
      const native_map = new Map([['x', 'xylophone'], ['y', 'yacht']]);
      dyn_map.$copy_from(native_map);

      expect(dyn_map.size).toBe(2);
      expect(dyn_map.get('x')).toBe('xylophone');
      expect(dyn_map.get('y')).toBe('yacht');
   });

   it('should handle emplace correctly', () => {
      const view = dyn_map.emplace('new_key');
      expect(view).toBeDefined();
      expect(dyn_map.has('new_key')).toBe(true);
      expect(dyn_map.get('new_key')).toBe('');

      view.value = 'emplaced_value';
      expect(dyn_map.get('new_key')).toBe('emplaced_value');
   });

   describe('low-level pointer manipulation', () => {
      it('should allow swapping the data of two maps by swapping their control pointers', () => {
         const map1 = new DynamicHashMapStringString(view_container_buffer, 0, allocator);
         const map2 = new DynamicHashMapStringString(view_container_buffer, POINTER_SIZE, allocator);

         map1.set('a', '1');
         map1.set('b', '2');
         map2.set('x', '100');

         expect(map1.size).toBe(2);
         expect(map2.size).toBe(1);
         expect(map1.get('a')).toBe('1');
         expect(map2.get('x')).toBe('100');

         const ptr1 = map1.$control_block_ptr;
         const ptr2 = map2.$control_block_ptr;

         map1.$control_block_ptr = ptr2;
         map2.$control_block_ptr = ptr1;

         expect(map1.size).toBe(1);
         expect(map2.size).toBe(2);
         expect(map1.get('x')).toBe('100');
         expect(map2.get('a')).toBe('1');
         expect(map1.has('a')).toBe(false);
         expect(map2.has('x')).toBe(false);

         map1.free();
         map2.free();
      });
   });
});