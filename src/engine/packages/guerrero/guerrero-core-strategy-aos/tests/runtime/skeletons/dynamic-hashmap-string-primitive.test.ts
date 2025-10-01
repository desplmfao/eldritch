/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/dynamic-hashmap-string-primitive.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import type { Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { POINTER_SIZE, LITTLE_ENDIAN } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicHashMapStringPrimitive } from '@self/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-string-primitive';
import { PrimitiveView } from '@self/runtime/skeletons/fixed/fixed-primitive';

class MockU32View extends PrimitiveView<number> {
   static override readonly __schema: SchemaLayout = {
      class_name: MockU32View.name,
      total_size: 4,
      alignment: 4,
      has_dynamic_data: false,
      properties: [],
   };

   override get value(): number {
      return this.__view.getUint32(this.__byte_offset, LITTLE_ENDIAN);
   }

   override set value(v: number) {
      this.__view.setUint32(this.__byte_offset, v, LITTLE_ENDIAN);
   }
}

class MockMapStringU32 extends DynamicHashMapStringPrimitive<number, MockU32View> {
   static override readonly __schema: SchemaLayout = {
      class_name: MockMapStringU32.name,
      total_size: POINTER_SIZE,
      alignment: POINTER_SIZE,
      has_dynamic_data: true,
      properties: [],
   };

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator
   ) {
      super(buffer, byte_offset, allocator, MockU32View);
   }

   get $value_size(): number {
      return 4;
   }

   get $value_alignment(): number {
      return 4;
   }

   $read_value(b: DataView, o: Pointer): number {
      return b.getUint32(o, LITTLE_ENDIAN)
   };

   $write_value(b: DataView, o: Pointer, v: number) {
      b.setUint32(o, v, LITTLE_ENDIAN)
   };
}

describe('runtime skeletons - DynamicHashMapStringPrimitive', () => {
   const ALLOCATOR_POOL_SIZE = 1024 * 64;
   const VIEW_CONTAINER_BUFFER_SIZE = 256;

   let allocator: TlsfAllocator;
   let view_container_buffer: ArrayBuffer;
   let dyn_map: MockMapStringU32;

   beforeEach(() => {
      const allocator_pool_buffer = new ArrayBuffer(ALLOCATOR_POOL_SIZE);

      allocator = new TlsfAllocator(allocator_pool_buffer, 0, ALLOCATOR_POOL_SIZE);
      view_container_buffer = new ArrayBuffer(VIEW_CONTAINER_BUFFER_SIZE);
      dyn_map = new MockMapStringU32(view_container_buffer, 0, allocator);
   });

   it('should set and get primitive values', () => {
      dyn_map.set('score', 12345);

      expect(dyn_map.size).toBe(1);
      expect(dyn_map.get('score')).toBe(12345);
   });

   it('should update an existing primitive value', () => {
      dyn_map.set('health', 100);
      dyn_map.set('health', 90);

      expect(dyn_map.size).toBe(1);
      expect(dyn_map.get('health')).toBe(90);
   });

   it('should handle many items, causing rehashing', () => {
      for (let i = 0; i < 50; i++) {
         dyn_map.set(`key_${i}`, i);
      }

      expect(dyn_map.size).toBe(50);
      expect(dyn_map.get('key_33')).toBe(33);
   });

   it('should iterate over entries with primitive values', () => {
      dyn_map.set('a', 1);
      dyn_map.set('b', 2);

      const entries = [...dyn_map.entries()];
      expect(entries).toContainEqual(['a', 1]);
      expect(entries).toContainEqual(['b', 2]);
   });

   it('should handle emplace correctly', () => {
      const view = dyn_map.emplace('mana');
      expect(view).toBeInstanceOf(MockU32View);
      expect(dyn_map.has('mana')).toBe(true);

      expect(view.value).toBe(0);
      expect(dyn_map.get('mana')).toBe(0);

      view.value = 50;
      expect(dyn_map.get('mana')).toBe(50);

      const same_view = dyn_map.emplace('mana');
      expect(same_view.value).toBe(50);
   });
});