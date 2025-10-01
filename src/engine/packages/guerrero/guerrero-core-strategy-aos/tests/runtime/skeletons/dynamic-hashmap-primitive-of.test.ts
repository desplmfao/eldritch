/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/dynamic-hashmap-primitive-of.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import type { IView, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER, LITTLE_ENDIAN, POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';
import { DynamicHashMapPrimitiveOf } from '@self/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-primitive-of';
import { PrimitiveView } from '@self/runtime/skeletons/fixed/fixed-primitive';

class MockU32View extends PrimitiveView<number> {

   static override readonly __schema: SchemaLayout = {
      class_name: MockU32View.name,
      total_size: 4,
      alignment: 4,
      has_dynamic_data: false,
      properties: []
   };

   override get value(): number {
      return this.__view.getUint32(this.__byte_offset, LITTLE_ENDIAN);
   }

   override set value(v: number) {
      this.__view.setUint32(this.__byte_offset, v, LITTLE_ENDIAN);
   }
}

class MockStructValue implements IView {

   static readonly __schema: SchemaLayout = {
      class_name: MockStructValue.name,
      total_size: 8,
      alignment: 4,
      has_dynamic_data: true,
      properties: []
   };

   readonly __view: DataView;
   readonly __buffer: ArrayBufferLike;
   readonly __byte_offset: Pointer;
   readonly __allocator: TlsfAllocator;

   #tag_view?: DynamicString;

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

   //
   //

   get id(): number {
      return this.__view.getUint32(this.__byte_offset, LITTLE_ENDIAN);
   }

   set id(v: number) {
      this.__view.setUint32(this.__byte_offset, v, LITTLE_ENDIAN);
   }

   //
   //

   get tag(): DynamicString {
      if (!this.#tag_view) {
         this.#tag_view = new DynamicString(this.__buffer, this.__byte_offset + 4, this.__allocator);
      }

      return this.#tag_view;
   }

   $copy_from(source: MockStructValue): void {
      this.id = source.id; this.tag.value = source.tag.value;
   }

   free(): void {
      this.tag.free();
   }
}

class MockMapU32ToStruct extends DynamicHashMapPrimitiveOf<number, MockU32View, MockStructValue> {

   //
   //

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator
   ) {
      super(buffer, byte_offset, allocator, MockU32View, MockStructValue);
   }

   //
   //

   get $key_size(): number {
      return 4;
   }

   get $key_alignment(): number {
      return 4;
   }

   $read_key(b: DataView, o: Pointer): number {
      return new MockU32View(b.buffer, o).value;
   }

   $write_key(b: DataView, o: Pointer, v: number): void {
      new MockU32View(b.buffer, o).value = v;
   }

   $hash_key(key: number): number {
      return key | 0;
   }
}

describe('runtime skeletons - DynamicHashMapPrimitiveOf', () => {
   let allocator: TlsfAllocator;
   let dyn_map: MockMapU32ToStruct;

   beforeEach(() => {
      allocator = new TlsfAllocator(new ArrayBuffer(1024 * 64));
      dyn_map = new MockMapU32ToStruct(new ArrayBuffer(POINTER_SIZE), 0, allocator);
   });

   const create_source_view = (id: number, tag: string): MockStructValue => {
      const temp_alloc = new TlsfAllocator(new ArrayBuffer(1024));
      const source_buffer = new ArrayBuffer(MockStructValue.__schema.total_size);
      const view = new MockStructValue(source_buffer, 0, temp_alloc);

      view.id = id;
      view.tag.value = tag;

      return view;
   };

   it('should emplace a new struct and allow modification', () => {
      const view = dyn_map.emplace(101);
      expect(dyn_map.size).toBe(1);
      expect(dyn_map.has(101)).toBe(true);
      expect(view).toBeInstanceOf(MockStructValue);

      view.id = 42;
      view.tag.value = 'emplaced';

      const retrieved = dyn_map.get(101)!;
      expect(retrieved.id).toBe(42);
      expect(retrieved.tag.value).toBe('emplaced');
   });

   it('should set a struct value with deep copy', () => {
      const source = create_source_view(99, 'original');
      dyn_map.set(202, source);
      expect(dyn_map.size).toBe(1);

      const retrieved = dyn_map.get(202)!;
      expect(retrieved.id).toBe(99);
      expect(retrieved.tag.value).toBe('original');

      source.tag.value = 'changed';
      expect(dyn_map.get(202)!.tag.value).toBe('original');
   });

   it('should delete a key-value pair and free the struct\'s dynamic data', () => {
      const view = dyn_map.emplace(303);
      view.tag.value = 'to be freed';
      const tag_ptr = view.tag.$control_block_ptr;
      expect(tag_ptr).not.toBe(GLOBAL_NULL_POINTER);

      const was_deleted = dyn_map.delete(303);
      expect(was_deleted).toBe(true);
      expect(dyn_map.size).toBe(0);

      // attempt to re-allocate the freed memory
      const realloc = allocator.allocate(16);
      expect(realloc).not.toBe(GLOBAL_NULL_POINTER);
   });

   it('should iterate over entries correctly', () => {
      dyn_map.emplace(1).id = 1;
      dyn_map.emplace(2).id = 2;
      dyn_map.emplace(3).id = 3;

      const entries = [...dyn_map.entries()];
      expect(entries.length).toBe(3);
      const retrieved_2 = entries.find(([k, v]) => k === 2);
      expect(retrieved_2).toBeDefined();
      expect(retrieved_2![1].id).toBe(2);
   });
});