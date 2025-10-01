/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/dynamic-hashmap-primitive-primitive.test.ts
 */

import { describe, it, expect, beforeEach, spyOn } from 'bun:test';

import type { Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { LITTLE_ENDIAN, POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicHashMapPrimitivePrimitive } from '@self/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-primitive-primitive';
import { PrimitiveView } from '@self/runtime/skeletons/fixed/fixed-primitive';


class MockI16View extends PrimitiveView<number> {

   static override readonly __schema: SchemaLayout = {
      class_name: MockI16View.name,
      total_size: 2,
      alignment: 2,
      has_dynamic_data: false,
      properties: []
   };

   override get value(): number {
      return this.__view.getInt16(this.__byte_offset, LITTLE_ENDIAN);
   }

   override set value(v: number) {
      this.__view.setInt16(this.__byte_offset, v, LITTLE_ENDIAN);
   }
}

class MockF64View extends PrimitiveView<number> {

   static override readonly __schema: SchemaLayout = {
      class_name: MockF64View.name,
      total_size: 8,
      alignment: 8,
      has_dynamic_data: false,
      properties: []
   };

   override get value(): number {
      return this.__view.getFloat64(this.__byte_offset, LITTLE_ENDIAN);
   }

   override set value(v: number) {
      this.__view.setFloat64(this.__byte_offset, v, LITTLE_ENDIAN);
   }
}

class MockMapI16ToF64 extends DynamicHashMapPrimitivePrimitive<number, MockI16View, number, MockF64View> {

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator
   ) {
      super(buffer, byte_offset, allocator, MockI16View, MockF64View);
   }

   get $key_size(): number {
      return 2;
   }

   get $key_alignment(): number {
      return 2;
   }

   $read_key(b: DataView, o: Pointer): number {
      return new MockI16View(b.buffer, o).value;
   }

   $write_key(b: DataView, o: Pointer, v: number): void {
      new MockI16View(b.buffer, o).value = v;
   };

   $hash_key(key: number): number {
      return key | 0;
   }

   get $value_size(): number {
      return 8;
   }

   get $value_alignment(): number {
      return 8;
   }

   $read_value(b: DataView, o: Pointer): number {
      return new MockF64View(b.buffer, o).value;
   }

   $write_value(b: DataView, o: Pointer, v: number): void {
      new MockF64View(b.buffer, o).value = v;
   }
}


describe('runtime skeletons - DynamicHashMapPrimitivePrimitive', () => {
   let allocator: TlsfAllocator;
   let dyn_map: MockMapI16ToF64;

   beforeEach(() => {
      allocator = new TlsfAllocator(new ArrayBuffer(1024 * 64));
      dyn_map = new MockMapI16ToF64(new ArrayBuffer(POINTER_SIZE), 0, allocator);
   });

   it('should set and get primitive values', () => {
      dyn_map.set(100, 123.456);
      dyn_map.set(-200, -789.123);

      expect(dyn_map.size).toBe(2);
      expect(dyn_map.get(100)).toBeCloseTo(123.456);
      expect(dyn_map.get(-200)).toBeCloseTo(-789.123);
   });

   it('should update an existing primitive value', () => {
      dyn_map.set(50, 1.0);
      dyn_map.set(50, 2.5);

      expect(dyn_map.size).toBe(1);
      expect(dyn_map.get(50)).toBe(2.5);
   });

   it('should handle many items, causing rehashing', () => {
      for (let i = -25; i < 25; i++) {
         dyn_map.set(i, i * 1.1);
      }

      expect(dyn_map.size).toBe(50);
      expect(dyn_map.get(10)).toBeCloseTo(11.0);
      expect(dyn_map.get(-10)).toBeCloseTo(-11.0);
   });

   it('should iterate over entries with primitive values', () => {
      dyn_map.set(1, 1.1);
      dyn_map.set(2, 2.2);

      const entries = new Map(dyn_map.entries());
      expect(entries.get(1)).toBeCloseTo(1.1);
      expect(entries.get(2)).toBeCloseTo(2.2);
   });

   it('should handle emplace correctly', () => {
      const view = dyn_map.emplace(42);
      expect(view).toBeInstanceOf(MockF64View);
      expect(dyn_map.has(42)).toBe(true);

      expect(view.value).toBe(0);
      expect(dyn_map.get(42)).toBe(0);

      view.value = 3.14;
      expect(dyn_map.get(42)).toBe(3.14);

      const same_view = dyn_map.emplace(42);
      expect(same_view.value).toBe(3.14);
   });

   it('should clear all items and free their memory', () => {
      dyn_map.set(1, 1.1);
      dyn_map.set(2, 2.2);
      dyn_map.set(3, 3.3);

      const free_spy = spyOn(allocator, 'free');
      dyn_map.clear();

      expect(dyn_map.size).toBe(0);
      expect(dyn_map.has(1)).toBe(false);
      expect(dyn_map.has(2)).toBe(false);
      expect(dyn_map.has(3)).toBe(false);

      expect(free_spy.mock.calls.length).toBe(3);
      free_spy.mockRestore();
   });
});