/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/union.test.ts
 */

import { describe, it, expect, beforeEach, spyOn } from 'bun:test';

import type { IView, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { str, u32, t } from '@eldritch-engine/type-utils/guerrero/markers';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { LITTLE_ENDIAN } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { align_offset } from '@eldritch-engine/guerrero-core/layout/calculator';

import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';

class MockStructA implements IView {

   static readonly __schema: SchemaLayout = {
      class_name: MockStructA.name,
      total_size: 4,
      alignment: 4,
      has_dynamic_data: false,
      properties: [],
   };

   readonly __view: DataView;
   readonly __buffer: ArrayBufferLike;
   readonly __byte_offset: Pointer;
   readonly __allocator: TlsfAllocator;

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

   get id(): t<u32> {
      return this.__view.getUint32(this.__byte_offset, LITTLE_ENDIAN);
   }

   set id(v: t<u32>) {
      this.__view.setUint32(this.__byte_offset, v, LITTLE_ENDIAN);
   }

   $copy_from(source: MockStructA): void {
      this.id = source.id;
   }
}

class MockStructB implements IView {

   static readonly __schema: SchemaLayout = {
      class_name: MockStructB.name,
      total_size: 4,
      alignment: 4,
      has_dynamic_data: true,
      properties: [],
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

   get name(): t<str> {
      if (!this.#name_view) {
         this.#name_view = new DynamicString(this.__buffer, this.__byte_offset, this.__allocator);
      }

      return this.#name_view.value;
   }

   set name(v: t<str>) {
      if (!this.#name_view) {
         this.#name_view = new DynamicString(this.__buffer, this.__byte_offset, this.__allocator);
      }

      this.#name_view.value = v;
   }

   free(): void {
      if (!this.#name_view) {
         this.#name_view = new DynamicString(this.__buffer, this.__byte_offset, this.__allocator);
      }

      this.#name_view.free();
   }

   $copy_from(source: MockStructB): void {
      this.name = source.name;
   }
}

class MockComponentWithUnion implements IView {

   static readonly __schema: SchemaLayout = {
      class_name: MockComponentWithUnion.name,
      total_size: 8,
      alignment: 4,
      has_dynamic_data: true,
      properties: [
         {
            property_key: 'data',
            type: 'u32 | MockStructA | MockStructB | null',
            order: 0,
            offset: 0,
            size: 8,
            alignment: 4,
            start_line: 0,
            end_line: 0,
            binary_info: {
               size: 8,
               alignment: 4,
               is_union: true,
               is_optional: true,
               has_dynamic_data: true,
               variants: [
                  {
                     type_string: 'u32',
                     tag: 1,
                     binary_info: {
                        size: 4,
                        alignment: 4,
                        has_dynamic_data: false
                     },
                  },
                  {
                     type_string: 'MockStructA',
                     tag: 2,
                     // @ts-expect-error
                     binary_info: MockStructA.__schema,
                  },
                  {
                     type_string: 'MockStructB',
                     tag: 3,
                     // @ts-expect-error
                     binary_info: MockStructB.__schema,
                  },
               ],
            },
         },
      ],
   };

   readonly __view: DataView;
   readonly __buffer: ArrayBufferLike;
   readonly __byte_offset: Pointer;
   readonly __allocator: TlsfAllocator;

   #data_view_MockStructA: MockStructA | null = null;
   #data_view_MockStructB: MockStructB | null = null;

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

   get data(): t<u32 | MockStructA | MockStructB | null> {
      const prop_schema = MockComponentWithUnion.__schema.properties[0]!;

      const tag = this.__view.getUint8(this.__byte_offset + prop_schema.offset);
      const data_offset = align_offset(this.__byte_offset + prop_schema.offset + 1, prop_schema.alignment);

      switch (tag) {
         case 1: {
            return this.__view.getUint32(data_offset, LITTLE_ENDIAN);
         }

         case 2: {
            if (!this.#data_view_MockStructA) {
               this.#data_view_MockStructA = new MockStructA(
                  this.__buffer,
                  data_offset,
                  this.__allocator
               );
            }

            return this.#data_view_MockStructA;
         }

         case 3: {
            if (!this.#data_view_MockStructB) {
               this.#data_view_MockStructB = new MockStructB(
                  this.__buffer,
                  data_offset,
                  this.__allocator
               );
            }

            return this.#data_view_MockStructB;
         }

         default: {
            return null;
         }
      }
   }

   set data(value: t<u32 | MockStructA | MockStructB | null | undefined>) {
      const prop_schema = MockComponentWithUnion.__schema.properties[0]!;
      const tag_offset = this.__byte_offset + prop_schema.offset;
      const data_offset = align_offset(tag_offset + 1, prop_schema.alignment);
      const data_size = prop_schema.size - (data_offset - tag_offset);

      const current_tag = this.__view.getUint8(tag_offset);

      const free_and_clear_current = () => {
         // free any dynamic data associated with the current variant
         if (current_tag === 3) {
            (this.data as MockStructB)?.free();
         }

         // always zero out the data region to prevent stale data from being misinterpreted
         new Uint8Array(this.__buffer, data_offset, data_size).fill(0);

         // invalidate cached views
         this.#data_view_MockStructA = null;
         this.#data_view_MockStructB = null;
      };

      if (value == null) {
         if (current_tag !== 0) {
            free_and_clear_current();
            this.__view.setUint8(tag_offset, 0);
         }
         return;
      }

      let new_tag = 0;

      if (typeof value === 'number') {
         new_tag = 1;
         if (current_tag !== new_tag) {
            free_and_clear_current();
            this.__view.setUint8(tag_offset, new_tag);
         }
         this.__view.setUint32(data_offset, value, LITTLE_ENDIAN);
      } else if (value instanceof MockStructA) {
         new_tag = 2;
         if (current_tag !== new_tag) {
            free_and_clear_current();
            this.__view.setUint8(tag_offset, new_tag);
         }
         (this.data as MockStructA).$copy_from(value);
      } else if (value instanceof MockStructB) {
         new_tag = 3;
         if (current_tag !== new_tag) {
            free_and_clear_current();
            this.__view.setUint8(tag_offset, new_tag);
         }
         (this.data as MockStructB).$copy_from(value);
      }
   }
}

describe('runtime skeletons - union properties', () => {
   let allocator: TlsfAllocator;
   let component_buffer: ArrayBuffer;
   let component: MockComponentWithUnion;

   beforeEach(() => {
      const pool_buffer = new ArrayBuffer(1024 * 16);

      allocator = new TlsfAllocator(pool_buffer);
      component_buffer = new ArrayBuffer(MockComponentWithUnion.__schema.total_size);
      component = new MockComponentWithUnion(component_buffer, 0, allocator);
   });

   it('should handle setting and getting a primitive variant (u32)', () => {
      component.data = 12345;

      expect(typeof component.data).toBe('number');
      expect(component.data).toBe(12345);
   });

   it('should handle setting and getting a nested struct variant (MockStructA)', () => {
      const source_a = new MockStructA(new ArrayBuffer(4), 0, allocator);
      source_a.id = 99;

      component.data = source_a;
      const data = component.data;

      expect(data).toBeInstanceOf(MockStructA);
      if (data instanceof MockStructA) {
         expect(data.id).toBe(99);

         // verify it's a view and not the source object
         source_a.id = 101;
         expect(data.id).toBe(99);
      }
   });

   it('should handle setting and getting a null variant', () => {
      component.data = 123;
      expect(component.data).not.toBeUndefined();

      component.data = null;
      expect(component.data).toBeNull();
   });

   it('should handle a struct with dynamic data (MockStructB)', () => {
      const source_b = new MockStructB(new ArrayBuffer(4), 0, allocator);
      source_b.name = 'hello world';

      component.data = source_b;
      const data = component.data;

      expect(data).toBeInstanceOf(MockStructB);

      if (data instanceof MockStructB) {
         expect(data.name).toBe('hello world');
         expect(data.__allocator).toBe(allocator);
      }
   });

   it('should correctly free dynamic data when switching variants', () => {
      const free_spy = spyOn(allocator, 'free');

      const source_b = new MockStructB(new ArrayBuffer(4), 0, allocator);
      source_b.name = 'dynamic data';
      component.data = source_b;

      const data_b = component.data as MockStructB;
      expect(data_b.name).toBe('dynamic data');
      expect(free_spy).not.toHaveBeenCalled();

      component.data = 42;
      expect(component.data).toBe(42);
      expect(free_spy).toHaveBeenCalledTimes(1);

      component.data = null;
      expect(component.data).toBeNull();
      expect(free_spy).toHaveBeenCalledTimes(1);

      const source_b2 = new MockStructB(new ArrayBuffer(4), 0, allocator);
      source_b2.name = 'new string';
      component.data = source_b2;
      expect(free_spy).toHaveBeenCalledTimes(1);

      const source_a = new MockStructA(new ArrayBuffer(4), 0, allocator);
      source_a.id = 101;
      component.data = source_a;
      expect(free_spy).toHaveBeenCalledTimes(2);

      free_spy.mockRestore();
   });
});