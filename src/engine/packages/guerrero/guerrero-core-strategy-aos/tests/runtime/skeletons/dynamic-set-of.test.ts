/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/dynamic-set-of.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import type { IView, Pointer, SchemaLayout, IHashable } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { LITTLE_ENDIAN, POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';
import { hash_djb2 } from '@eldritch-engine/utils/hash';

import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';
import { DynamicSetOf } from '@self/runtime/skeletons/dynamic/set/dynamic-set-of';

class MockHashableStruct implements IView, IHashable {

   static readonly __schema: SchemaLayout = {
      class_name: MockHashableStruct.name,
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

   get id(): number {
      return this.__view.getUint32(this.__byte_offset, LITTLE_ENDIAN);
   }

   set id(v: number) {
      this.__view.setUint32(this.__byte_offset, v, LITTLE_ENDIAN);
   }

   get tag(): string {
      if (!this.#tag_view) {
         this.#tag_view = new DynamicString(this.__buffer, this.__byte_offset + 4, this.__allocator);
      }

      return this.#tag_view.value;
   }

   set tag(v: string) {
      if (!this.#tag_view) {
         this.#tag_view = new DynamicString(this.__buffer, this.__byte_offset + 4, this.__allocator);
      }

      this.#tag_view.value = v;
   }

   $copy_from(source: MockHashableStruct): void {
      this.id = source.id;
      this.tag = source.tag;
   }

   free(): void {
      this.#tag_view?.free();
   }

   $hash(): number {
      let hash = 17;

      hash = (hash * 31 + (this.id ?? 0)) | 0;
      hash = (hash * 31 + hash_djb2(this.tag ?? '')) | 0;

      return hash;
   }

   $equals(other: MockHashableStruct): boolean {
      return this.id === other.id
         && this.tag === other.tag;
   }
}

describe('runtime skeletons - DynamicSetOf', () => {
   let allocator: TlsfAllocator;
   let dyn_set: DynamicSetOf<MockHashableStruct>;
   let temp_allocator: TlsfAllocator;

   beforeEach(() => {
      allocator = new TlsfAllocator(new ArrayBuffer(1024 * 64));
      temp_allocator = new TlsfAllocator(new ArrayBuffer(1024));
      dyn_set = new DynamicSetOf(new ArrayBuffer(POINTER_SIZE), 0, allocator, MockHashableStruct);
   });

   const create_source_view = (id: number, tag: string): MockHashableStruct => {
      const source_buffer = new ArrayBuffer(MockHashableStruct.__schema.total_size);
      const view = new MockHashableStruct(source_buffer, 0, temp_allocator);
      view.id = id;
      view.tag = tag;
      return view;
   };

   it('should add a new struct by value', () => {
      const source = create_source_view(101, 'alpha');
      dyn_set.add(source);
      expect(dyn_set.size).toBe(1);

      const retrieved = [...dyn_set.values()][0]!;
      expect(retrieved.id).toBe(101);
      expect(retrieved.tag).toBe('alpha');

      source.tag = 'beta';
      expect(retrieved.tag).toBe('alpha');
   });

   it('should not add a duplicate struct based on value equality', () => {
      const source1 = create_source_view(101, 'alpha');
      const source2 = create_source_view(101, 'alpha');
      dyn_set.add(source1);
      dyn_set.add(source2);
      expect(dyn_set.size).toBe(1);
   });

   it('should use $equals for has() check', () => {
      const source1 = create_source_view(101, 'alpha');
      const identical_source = create_source_view(101, 'alpha');
      const different_source = create_source_view(102, 'beta');

      dyn_set.add(source1);
      expect(dyn_set.has(identical_source)).toBe(true);
      expect(dyn_set.has(different_source)).toBe(false);
   });

   it('should delete a struct and free its dynamic data', () => {
      const source = create_source_view(101, 'to be deleted');
      dyn_set.add(source);
      expect(dyn_set.size).toBe(1);

      const was_deleted = dyn_set.delete(source);
      expect(was_deleted).toBe(true);
      expect(dyn_set.size).toBe(0);
      expect(dyn_set.has(source)).toBe(false);
   });

   it('should be iterable', () => {
      dyn_set.add(create_source_view(1, 'a'));
      dyn_set.add(create_source_view(2, 'b'));
      const values = [...dyn_set];
      expect(values.length).toBe(2);
      expect(values.some(v => v.id === 1)).toBe(true);
      expect(values.some(v => v.id === 2)).toBe(true);
   });

   it('should clear all items and free their dynamic data', () => {
      dyn_set.add(create_source_view(1, 'a'));
      dyn_set.add(create_source_view(2, 'b'));
      dyn_set.clear();
      expect(dyn_set.size).toBe(0);
   });
});