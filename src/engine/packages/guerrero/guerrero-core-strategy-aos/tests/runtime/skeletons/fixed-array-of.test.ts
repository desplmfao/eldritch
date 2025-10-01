/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/fixed-array-of.test.ts
 */

import { describe, it, expect, beforeEach, spyOn } from 'bun:test';

import type { IView, Pointer, SchemaLayout, IHashable } from '@eldritch-engine/type-utils/guerrero/index';
import { hash_djb2 } from '@eldritch-engine/utils/hash';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { LITTLE_ENDIAN } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';
import { FixedArrayOf } from '@self/runtime/skeletons/fixed/array/fixed-array-of';

class MockNestedStruct implements IView, IHashable {

   static readonly __schema: SchemaLayout = {
      class_name: MockNestedStruct.name,
      total_size: 8,
      alignment: 4,
      has_dynamic_data: true,
      properties: [
         {
            property_key: 'id',
            type: 'u32',
            offset: 0,
            size: 4,
            alignment: 4,
            order: 0,
            start_line: 0,
            end_line: 0,
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
            property_key: 'tag',
            type: 'str',
            offset: 4,
            size: 4,
            alignment: 4,
            order: 1,
            start_line: 0,
            end_line: 0,
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

   $copy_from(source: MockNestedStruct): void {
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

   $equals(other: MockNestedStruct): boolean {
      return this.id === other.id
         && this.tag === other.tag;
   }
}

class MockFixedArrayOfNestedStructs extends FixedArrayOf<MockNestedStruct, 2> {

   static override readonly __schema: SchemaLayout = {
      class_name: MockFixedArrayOfNestedStructs.name,
      total_size: 16,
      alignment: MockNestedStruct.__schema.alignment,
      has_dynamic_data: true,
      properties: []
   };

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator
   ) {
      super(
         buffer,
         byte_offset,
         allocator,
         //
         MockNestedStruct,
         2
      );
   }

   get [0](): MockNestedStruct {
      return this.get(0)!;
   }

   set [0](v: MockNestedStruct) {
      this.set(0, v);
   }

   get [1](): MockNestedStruct {
      return this.get(1)!;
   }

   set [1](v: MockNestedStruct) {
      this.set(1, v);
   }
}

describe('runtime skeletons - FixedArrayOf', () => {
   let allocator: TlsfAllocator;
   let test_view_buffer: ArrayBuffer;
   let struct_array: MockFixedArrayOfNestedStructs;
   let temp_allocator: TlsfAllocator;

   beforeEach(() => {
      const allocator_pool_buffer = new ArrayBuffer(1024 * 16);
      allocator = new TlsfAllocator(allocator_pool_buffer);
      test_view_buffer = new ArrayBuffer(256);
      struct_array = new MockFixedArrayOfNestedStructs(test_view_buffer, 0, allocator);
      temp_allocator = new TlsfAllocator(new ArrayBuffer(1024));
   });

   const create_source_view = (id: number, tag: string): MockNestedStruct => {
      const source_buffer = new ArrayBuffer(MockNestedStruct.__schema.total_size);
      const view = new MockNestedStruct(source_buffer, 0, temp_allocator);
      view.id = id;
      view.tag = tag;
      return view;
   };

   it('should initialize with correct length', () => {
      expect(struct_array.length).toBe(2);
   });

   it('should allow getting and setting struct elements (deep copy)', () => {
      const source_struct = create_source_view(101, 'source');

      struct_array[0] = source_struct;

      expect(struct_array[0]!.id).toBe(101);
      expect(struct_array[0]!.tag).toBe('source');

      source_struct.id = 202;
      source_struct.tag = 'changed_source';

      expect(struct_array[0]!.id).toBe(101);
      expect(struct_array[0]!.tag).toBe('source');
   });

   describe('indexOf and includes', () => {
      beforeEach(() => {
         struct_array[0] = create_source_view(10, 'A');
         struct_array[1] = create_source_view(20, 'B');
      });

      it('should find index of struct with identical values', () => {
         const search_for = create_source_view(20, 'B');
         expect(struct_array.indexOf(search_for)).toBe(1);
      });

      it('should return -1 for a struct not in the array', () => {
         const search_for = create_source_view(99, 'Z');
         expect(struct_array.indexOf(search_for)).toBe(-1);
      });

      it('should return true from includes()', () => {
         const search_for = create_source_view(10, 'A');
         expect(struct_array.includes(search_for)).toBe(true);
      });
   });

   it('free() should call free on its elements if they have a free method', () => {
      struct_array[0]!.id = 1;
      struct_array[0]!.tag = 'tag1';
      struct_array[1]!.id = 2;
      struct_array[1]!.tag = 'tag2';

      const free_spy_on_prototype = spyOn(MockNestedStruct.prototype, 'free');
      struct_array.free();
      expect(free_spy_on_prototype).toHaveBeenCalledTimes(2);
      free_spy_on_prototype.mockRestore();
   });
});