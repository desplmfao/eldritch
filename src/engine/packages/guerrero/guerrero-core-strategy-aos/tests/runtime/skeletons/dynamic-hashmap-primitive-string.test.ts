/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/dynamic-hashmap-primitive-string.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import type { Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { LITTLE_ENDIAN, POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';
import { DynamicHashMapPrimitiveString } from '@self/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-primitive-string';
import { PrimitiveView } from '@self/runtime/skeletons/fixed/fixed-primitive';


class MockU64View extends PrimitiveView<bigint> {

   static override readonly __schema: SchemaLayout = {
      class_name: MockU64View.name,
      total_size: 8,
      alignment: 8,
      has_dynamic_data: false,
      properties: []
   };

   override get value(): bigint {
      return this.__view.getBigUint64(this.__byte_offset, LITTLE_ENDIAN);
   }

   override set value(v: bigint) {
      this.__view.setBigUint64(this.__byte_offset, v, LITTLE_ENDIAN);
   }
}

class MockMapU64ToString extends DynamicHashMapPrimitiveString<bigint, MockU64View> {

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator
   ) {
      super(buffer, byte_offset, allocator, MockU64View, DynamicString);
   }

   get $key_size(): number {
      return 8;
   }

   get $key_alignment(): number {
      return 8;
   }

   $read_key(b: DataView, o: Pointer): bigint {
      return new MockU64View(b.buffer, o).value;
   };

   $write_key(b: DataView, o: Pointer, v: bigint): void {
      new MockU64View(b.buffer, o).value = v;
   };

   $hash_key(key: bigint): number {
      const upper = Number((key >> 32n) & 0xFFFFFFFFn);
      const lower = Number(key & 0xFFFFFFFFn);

      return (upper ^ lower) | 0;
   }
}

describe('runtime skeletons - DynamicHashMapPrimitiveString', () => {
   let allocator: TlsfAllocator;
   let dyn_map: MockMapU64ToString;

   beforeEach(() => {
      allocator = new TlsfAllocator(new ArrayBuffer(1024 * 64));
      dyn_map = new MockMapU64ToString(new ArrayBuffer(POINTER_SIZE), 0, allocator);
   });

   it('should set and get string values with bigint keys', () => {
      const key1 = 12345678901234567890n;
      const key2 = 9876543210987654321n;
      dyn_map.set(key1, 'value one');
      dyn_map.set(key2, 'value two');

      expect(dyn_map.size).toBe(2);
      expect(dyn_map.get(key1)).toBe('value one');
      expect(dyn_map.get(key2)).toBe('value two');
   });

   it('should update an existing string value', () => {
      const key = 1n;
      dyn_map.set(key, 'first');
      dyn_map.set(key, 'second');

      expect(dyn_map.size).toBe(1);
      expect(dyn_map.get(key)).toBe('second');
   });

   it('should handle many items, causing rehashing', () => {
      for (let i = 0; i < 50; i++) {
         dyn_map.set(BigInt(i), `value_${i}`);
      }

      expect(dyn_map.size).toBe(50);
      expect(dyn_map.get(33n)).toBe('value_33');
   });

   it('should handle emplace correctly', () => {
      const key = 100n;
      const view = dyn_map.emplace(key);
      expect(view).toBeInstanceOf(DynamicString);
      expect(dyn_map.has(key)).toBe(true);

      expect(view.value).toBe('');
      expect(dyn_map.get(key)).toBe('');

      view.value = 'a new string';
      expect(dyn_map.get(key)).toBe('a new string');

      const same_view = dyn_map.emplace(key);
      expect(same_view.value).toBe('a new string');
   });
});