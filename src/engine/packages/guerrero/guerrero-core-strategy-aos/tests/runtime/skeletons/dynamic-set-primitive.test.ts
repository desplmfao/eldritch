/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/dynamic-set-primitive.test.ts
 */

import { describe, it, expect, beforeEach, spyOn } from 'bun:test';

import type { Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { LITTLE_ENDIAN, POINTER_SIZE, GLOBAL_NULL_POINTER } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicSetPrimitive } from '@self/runtime/skeletons/dynamic/set/dynamic-set-primitive';
import { PrimitiveView } from '@self/runtime/skeletons/fixed/fixed-primitive';


//
//

class MockU32SetKeyView extends PrimitiveView<number> {

   //
   //

   static override readonly __schema: SchemaLayout = {
      class_name: MockU32SetKeyView.name,
      total_size: 4,
      alignment: 4,
      has_dynamic_data: false,
      properties: []
   };

   //
   //

   override get value(): number {
      return this.__view.getUint32(this.__byte_offset, LITTLE_ENDIAN);
   }

   override set value(v: number) {
      this.__view.setUint32(this.__byte_offset, v, LITTLE_ENDIAN);
   }
}

//
//

class MockDynamicSetU32 extends DynamicSetPrimitive<number, MockU32SetKeyView> {

   //
   //

   static override readonly __schema: SchemaLayout = {
      class_name: MockDynamicSetU32.name,
      total_size: POINTER_SIZE,
      alignment: POINTER_SIZE,
      has_dynamic_data: true,
      properties: []
   };

   //
   //

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator
   ) {
      super(buffer, byte_offset, allocator, MockU32SetKeyView);
   }

   get $key_size(): number {
      return 4;
   }

   get $key_alignment(): number {
      return 4;
   }

   $read_key = (b: DataView, o: Pointer): number => b.getUint32(o, LITTLE_ENDIAN);
   $write_key = (b: DataView, o: Pointer, v: number) => b.setUint32(o, v, LITTLE_ENDIAN);

   $hash_key(key: number): number {
      return key | 0;
   }

   $are_keys_equal(key1: number, key2_view: MockU32SetKeyView): boolean {
      return key1 === key2_view.value;
   }
}

describe('runtime skeletons - DynamicSetPrimitive', () => {
   let allocator: TlsfAllocator;
   let dyn_set: MockDynamicSetU32;

   beforeEach(() => {
      const pool_buffer = new ArrayBuffer(1024 * 64);
      allocator = new TlsfAllocator(pool_buffer, 0, pool_buffer.byteLength);

      const view_container_buffer = new ArrayBuffer(4);
      dyn_set = new MockDynamicSetU32(view_container_buffer, 0, allocator);
   });

   it('should initialize empty', () => {
      expect(dyn_set.size).toBe(0);
   });

   it('should add primitive values', () => {
      dyn_set.add(100);
      dyn_set.add(200);
      expect(dyn_set.size).toBe(2);
      expect(dyn_set.has(100)).toBe(true);
      expect(dyn_set.has(200)).toBe(true);
   });

   it('should not add duplicates', () => {
      dyn_set.add(55);
      dyn_set.add(55);
      expect(dyn_set.size).toBe(1);
   });

   it('should delete values', () => {
      dyn_set.add(1).add(2).add(3);
      expect(dyn_set.delete(2)).toBe(true);
      expect(dyn_set.size).toBe(2);
      expect(dyn_set.has(2)).toBe(false);
      expect(dyn_set.has(1)).toBe(true);
      expect(dyn_set.has(3)).toBe(true);
   });

   it('should be iterable', () => {
      const values = [10, 20, 30];

      for (const v of values) {
         dyn_set.add(v);
      }

      const collected = [...dyn_set].sort((a, b) => a - b);
      expect(collected).toEqual(values);
   });

   it('should clear all values and free nodes', () => {
      dyn_set.add(1).add(2);

      const free_spy = spyOn(allocator, 'free');
      dyn_set.clear();

      expect(dyn_set.size).toBe(0);
      expect(dyn_set.has(1)).toBe(false);

      expect(free_spy.mock.calls.length).toBe(2);
      free_spy.mockRestore();
   });

   it('should copy from a native Set', () => {
      const native_set = new Set([11, 22, 33]);
      dyn_set.$copy_from(native_set);
      expect(dyn_set.size).toBe(3);
      expect(dyn_set.has(22)).toBe(true);
   });

   it('should trigger rehashing correctly', () => {
      for (let i = 0; i < 50; i++) {
         dyn_set.add(i * 10);
      }

      expect(dyn_set.size).toBe(50);
      expect(dyn_set.has(330)).toBe(true);
   });

   it('should free all memory efficiently', () => {
      for (let i = 0; i < 10; i++) {
         dyn_set.add(i);
      }

      const control_ptr = dyn_set.$control_block_ptr;
      const buckets_ptr = dyn_set.$read_control_block_field(control_ptr, 8);
      expect(control_ptr).not.toBe(GLOBAL_NULL_POINTER);
      expect(buckets_ptr).not.toBe(GLOBAL_NULL_POINTER);

      const free_spy = spyOn(allocator, 'free');
      dyn_set.free();

      expect(free_spy.mock.calls.length).toBe(10 + 2);
      free_spy.mockRestore();

      expect(dyn_set.size).toBe(0);
      expect(dyn_set.$control_block_ptr).toBe(GLOBAL_NULL_POINTER);
   });

   it('should handle zero value correctly', () => {
      dyn_set.add(0);
      expect(dyn_set.has(0)).toBe(true);
      expect(dyn_set.size).toBe(1);
      dyn_set.delete(0);
      expect(dyn_set.has(0)).toBe(false);
      expect(dyn_set.size).toBe(0);
   });
});