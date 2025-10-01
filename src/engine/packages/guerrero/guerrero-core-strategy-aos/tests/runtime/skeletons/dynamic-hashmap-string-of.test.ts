/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/dynamic-hashmap-string-of.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import type { IView, Pointer, SchemaLayout, PropertyLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER, LITTLE_ENDIAN, POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';
import { DynamicHashMapStringOf } from '@self/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-string-of';

class MockStructView implements IView {
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
}

describe('runtime skeletons - DynamicHashMapStringOf', () => {
   const ALLOCATOR_POOL_SIZE = 1024 * 128;
   const VIEW_CONTAINER_BUFFER_SIZE = 256;

   let allocator: TlsfAllocator;
   let view_container_buffer: ArrayBuffer;
   let dyn_map: DynamicHashMapStringOf<MockStructView>;

   beforeEach(() => {
      const allocator_pool_buffer = new ArrayBuffer(ALLOCATOR_POOL_SIZE);
      allocator = new TlsfAllocator(allocator_pool_buffer, 0, ALLOCATOR_POOL_SIZE);
      view_container_buffer = new ArrayBuffer(VIEW_CONTAINER_BUFFER_SIZE);

      dyn_map = new DynamicHashMapStringOf(view_container_buffer, 0, allocator, MockStructView);
   });

   // This helper is for `set`, which requires a source view. The more ergonomic `emplace` is preferred for new items.
   const create_source_view = (id: number, name: string): MockStructView => {
      const source_buffer = new ArrayBuffer(MockStructView.__schema.total_size);
      const view = new MockStructView(source_buffer, 0, temp_allocator);
      view.id = id;
      view.name.value = name;
      return view;
   };

   // The temp allocator is only needed for the `create_source_view` helper used in a couple of tests.
   // Most tests should prefer `emplace`.
   const temp_allocator = new TlsfAllocator(new ArrayBuffer(8192), 0, 8192);

   it('should initialize with size 0', () => {
      expect(dyn_map.size).toBe(0);
   });

   it('should set and get a value, performing a deep copy', () => {
      const source_view = create_source_view(101, 'alpha');
      dyn_map.set('key1', source_view);

      expect(dyn_map.size).toBe(1);
      expect(dyn_map.has('key1')).toBe(true);

      const retrieved_view = dyn_map.get('key1');
      expect(retrieved_view).toBeDefined();
      expect(retrieved_view!.id).toBe(101);
      expect(retrieved_view!.name.value).toBe('alpha');

      source_view.id = 999;
      source_view.name.value = 'changed';

      const retrieved_view_again = dyn_map.get('key1')!;
      expect(retrieved_view_again.id).toBe(101);
      expect(retrieved_view_again.name.value).toBe('alpha');

      source_view.free();
   });

   it('should update an existing value and free old value data', () => {
      const view1 = create_source_view(1, 'one');
      dyn_map.set('key1', view1);

      const old_name_ptr = dyn_map.get('key1')!.name.$control_block_ptr;
      expect(old_name_ptr).not.toBe(GLOBAL_NULL_POINTER);

      const view2 = create_source_view(2, 'two');
      dyn_map.set('key1', view2);

      expect(dyn_map.size).toBe(1);
      const retrieved = dyn_map.get('key1')!;
      expect(retrieved.id).toBe(2);
      expect(retrieved.name.value).toBe('two');

      const test_alloc = allocator.allocate(10);
      allocator.free(test_alloc);
      view1.free();
      view2.free();
   });

   it('should return undefined for non-existent keys', () => {
      expect(dyn_map.get('non-existent-key')).toBeUndefined();
   });

   it('should delete a key-value pair and free associated memory', () => {
      dyn_map.emplace('key_to_delete').id = 1;
      expect(dyn_map.size).toBe(1);

      const was_deleted = dyn_map.delete('key_to_delete');
      expect(was_deleted).toBe(true);
      expect(dyn_map.size).toBe(0);
      expect(dyn_map.has('key_to_delete')).toBe(false);

      const was_deleted_again = dyn_map.delete('key_to_delete');
      expect(was_deleted_again).toBe(false);
   });


   it('should clear all items and free their memory', () => {
      dyn_map.emplace('a').id = 1;
      dyn_map.emplace('b').id = 2;
      expect(dyn_map.size).toBe(2);

      dyn_map.clear();
      expect(dyn_map.size).toBe(0);
      expect(dyn_map.has('a')).toBe(false);
      expect(dyn_map.has('b')).toBe(false);
   });

   it('should free the entire map structure', () => {
      dyn_map.emplace('a').id = 1;
      dyn_map.emplace('b').id = 2;
      const control_ptr = dyn_map.$control_block_ptr;
      expect(control_ptr).not.toBe(GLOBAL_NULL_POINTER);

      dyn_map.free();
      const control_ptr_after_free = dyn_map.$control_block_ptr;
      expect(control_ptr_after_free).toBe(GLOBAL_NULL_POINTER);
      expect(dyn_map.size).toBe(0);
   });

   it('should allow being cleared and then immediately reused', () => {
      dyn_map.emplace('a').id = 1;
      dyn_map.emplace('b').id = 2;
      dyn_map.clear();
      expect(dyn_map.size).toBe(0);

      const new_view = dyn_map.emplace('c');
      new_view.id = 3;
      new_view.name.value = 'three';
      expect(dyn_map.size).toBe(1);
      expect(dyn_map.has('c')).toBe(true);
      expect(dyn_map.get('c')!.id).toBe(3);
   });

   it('multiple instances should not interfere', () => {
      const map1 = new DynamicHashMapStringOf(view_container_buffer, 0, allocator, MockStructView);
      const map2 = new DynamicHashMapStringOf(view_container_buffer, POINTER_SIZE, allocator, MockStructView);

      const v_a = map1.emplace('a');
      v_a.id = 1; v_a.name.value = 'one';
      const v_x = map2.emplace('x');
      v_x.id = 101; v_x.name.value = 'alpha';
      const v_y = map2.emplace('y');
      v_y.id = 102; v_y.name.value = 'beta';

      expect(map1.size).toBe(1);
      expect(map2.size).toBe(2);
      expect(map1.get('a')!.id).toBe(1);
      expect(map2.get('y')!.id).toBe(102);

      map1.delete('a');
      expect(map1.size).toBe(0);
      expect(map2.size).toBe(2);
      expect(map2.get('x')!.name.value).toBe('alpha');
   });

   it('should emplace a new value correctly', () => {
      const new_view = dyn_map.emplace('new_key');
      expect(new_view).toBeDefined();
      expect(dyn_map.size).toBe(1);
      expect(dyn_map.has('new_key')).toBe(true);

      new_view.id = 42;
      new_view.name.value = 'emplaced';

      const retrieved = dyn_map.get('new_key')!;
      expect(retrieved.id).toBe(42);
      expect(retrieved.name.value).toBe('emplaced');
   });

   describe('key and value edge cases', () => {
      it('should handle empty string as a key', () => {
         dyn_map.emplace('').id = 1;
         expect(dyn_map.size).toBe(1);
         expect(dyn_map.has('')).toBe(true);
         expect(dyn_map.get('')!.id).toBe(1);
         dyn_map.emplace('a');
         expect(dyn_map.has('')).toBe(true);

         dyn_map.delete('');
         expect(dyn_map.has('')).toBe(false);
         expect(dyn_map.size).toBe(1);
      });

      it('should handle whitespace-only strings as keys', () => {
         const key = '   \t   \n ';
         dyn_map.emplace(key).id = 1;
         expect(dyn_map.size).toBe(1);
         expect(dyn_map.has(key)).toBe(true);
         expect(dyn_map.get(key)!.id).toBe(1);
      });

      it('should handle extremely long keys', () => {
         const long_key = 'a'.repeat(1000);
         dyn_map.emplace(long_key).id = 1;

         expect(dyn_map.has(long_key)).toBe(true);
         expect(dyn_map.get(long_key)!.id).toBe(1);

         dyn_map.delete(long_key);
         expect(dyn_map.has(long_key)).toBe(false);
      });

      it('should handle values with very large dynamic string content', () => {
         const large_string = 'b'.repeat(5000);
         dyn_map.emplace('large_value').name.value = large_string;

         const retrieved = dyn_map.get('large_value')!;
         expect(retrieved).toBeDefined();
         expect(retrieved.name.value).toBe(large_string);
      });

      it('should correctly replace a value with one of a different dynamic size', () => {
         const key = 'size_swap';
         const view = dyn_map.emplace(key);
         view.id = 1; view.name.value = 'small';

         view.id = 2; view.name.value = 'this is a much larger string value';
         expect(dyn_map.get(key)!.name.value).toBe('this is a much larger string value');
         expect(dyn_map.get(key)!.id).toBe(2);

         view.id = 3; view.name.value = 'tiny';
         expect(dyn_map.get(key)!.name.value).toBe('tiny');
         expect(dyn_map.get(key)!.id).toBe(3);
      });

   });

   describe('rehashing and collision scenarios', () => {
      const colliding_keys = ['Aa', 'BB', 'FB', 'Ea'];

      it('should handle keys that cause hash collisions', () => {
         dyn_map.emplace(colliding_keys[0]!).id = 1;
         dyn_map.emplace(colliding_keys[1]!).id = 2;
         dyn_map.emplace('non-colliding').id = 3;

         expect(dyn_map.size).toBe(3);
         expect(dyn_map.get(colliding_keys[0]!)!.id).toBe(1);
         expect(dyn_map.get(colliding_keys[1]!)!.id).toBe(2);
         expect(dyn_map.get('non-colliding')!.id).toBe(3);
      });

      it('should correctly delete items from the middle of a collision chain', () => {
         dyn_map.emplace(colliding_keys[0]!).id = 1;
         dyn_map.emplace(colliding_keys[1]!).id = 2;
         dyn_map.emplace(colliding_keys[2]!).id = 3;

         expect(dyn_map.size).toBe(3);
         expect(dyn_map.delete(colliding_keys[1]!)).toBe(true);
         expect(dyn_map.size).toBe(2);

         expect(dyn_map.has(colliding_keys[1]!)).toBe(false);
         expect(dyn_map.has(colliding_keys[0]!)).toBe(true);
         expect(dyn_map.has(colliding_keys[2]!)).toBe(true);
         expect(dyn_map.get(colliding_keys[0]!)!.id).toBe(1);
         expect(dyn_map.get(colliding_keys[2]!)!.id).toBe(3);
      });

      it('should handle rehashing with collision chains present', () => {
         dyn_map.emplace(colliding_keys[0]!).id = 1;
         dyn_map.emplace(colliding_keys[1]!).id = 2;

         for (let i = 0; i < 20; i++) {
            const view = dyn_map.emplace(`key_${i}`);
            view.id = 100 + i; view.name.value = `val_${i}`;
         }

         expect(dyn_map.size).toBe(22);
         expect(dyn_map.get(colliding_keys[0]!)!.id).toBe(1);
         expect(dyn_map.get(colliding_keys[1]!)!.id).toBe(2);
         expect(dyn_map.get('key_15')!.id).toBe(115);
      });

      it('should handle rehashing with many deletions', () => {
         const count = 30;

         for (let i = 0; i < count; i++) {
            const view = dyn_map.emplace(`key_${i}`);
            view.id = i; view.name.value = `val_${i}`;
         }

         for (let i = 0; i < count; i += 2) {
            dyn_map.delete(`key_${i}`);
         }

         expect(dyn_map.size).toBe(count / 2);

         for (let i = 0; i < count; i++) {
            const view = dyn_map.emplace(`new_key_${i}`);
            view.id = 100 + i; view.name.value = `new_val_${i}`;
         }

         for (let i = 1; i < count; i += 2) {
            expect(dyn_map.has(`key_${i}`)).toBe(true);
            expect(dyn_map.get(`key_${i}`)!.id).toBe(i);
         }

         for (let i = 0; i < count; i++) {
            expect(dyn_map.has(`new_key_${i}`)).toBe(true);
            expect(dyn_map.get(`new_key_${i}`)!.id).toBe(100 + i);
         }
      });
   });

   describe('stress and chaos tests', () => {
      it('should function correctly on a fragmented memory pool', () => {
         const frags: Pointer[] = [];

         for (let i = 0; i < 100; i++) {
            frags.push(allocator.allocate(16 + (i % 5) * 4));
         }

         for (let i = 0; i < 100; i += 2) {
            allocator.free(frags[i]!);
         }

         dyn_map.emplace('test1').id = 1;
         dyn_map.emplace('test2').id = 2;

         expect(dyn_map.size).toBe(2);
         expect(dyn_map.get('test1')!.id).toBe(1);

         for (let i = 1; i < 100; i += 2) {
            allocator.free(frags[i]!);
         }
      });

      it('should pass a "chaos" test of random operations', () => {
         const native_map = new Map<string, { id: number; name: string }>();

         const key_pool = Array.from({ length: 50 }, (_, i) => `key_${i}`);
         const operations = 5000;

         for (let i = 0; i < operations; i++) {
            const op_type = Math.random();
            const key = key_pool[Math.floor(Math.random() * key_pool.length)]!;

            if (op_type < 0.5) {
               const id = Math.floor(Math.random() * 1000);
               const name = `val_${id}`;
               const view = dyn_map.emplace(key);

               view.id = id;
               view.name.value = name;

               native_map.set(key, { id, name });
            } else if (op_type < 0.8) {
               dyn_map.delete(key);

               native_map.delete(key);
            } else {
               const expected_exists = native_map.has(key);
               expect(dyn_map.has(key)).toBe(expected_exists);

               if (expected_exists) {
                  const expected_val = native_map.get(key)!;
                  const actual_val = dyn_map.get(key)!;
                  expect(actual_val.id).toBe(expected_val.id);
                  expect(actual_val.name.value).toBe(expected_val.name);
               }
            }
         }

         expect(dyn_map.size).toBe(native_map.size);

         for (const [key, value] of native_map.entries()) {
            expect(dyn_map.has(key)).toBe(true);

            const actual_val = dyn_map.get(key)!;
            expect(actual_val.id).toBe(value.id);
            expect(actual_val.name.value).toBe(value.name);
         }
      });
   });
});