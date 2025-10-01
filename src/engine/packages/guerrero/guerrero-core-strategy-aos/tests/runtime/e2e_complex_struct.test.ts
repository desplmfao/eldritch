/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/e2e_complex_struct.test.ts
 */

import { describe, it, expect, beforeEach, spyOn } from 'bun:test';

import type { IView, Pointer, SchemaLayout, IViewConstructor, PropertyLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { LITTLE_ENDIAN } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicArray } from '@self/runtime/skeletons/dynamic/array/dynamic-array';
import { DynamicArrayPrimitive } from '@self/runtime/skeletons/dynamic/array/dynamic-array-primitive';
import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';
import { DynamicHashMapStringOf } from '@self/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-string-of';
import { PrimitiveView } from '@self/runtime/skeletons/fixed/fixed-primitive';

class NestedData_g implements IView {

   static readonly __schema: SchemaLayout = {
      class_name: NestedData_g.name,
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
            property_key: 'tag',
            order: 1,
            type: 'str',
            offset: 4,
            size: 4,
            start_line: 0,
            end_line: 0,
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

   $copy_from(source: NestedData_g) {
      this.id = source.id;
      this.tag = source.tag;
   }

   free() {
      new DynamicString(this.__buffer, this.__byte_offset + 4, this.__allocator).free();
   }
}

class U32PrimitiveView extends PrimitiveView<number> {

   static override readonly __schema: SchemaLayout = {
      class_name: U32PrimitiveView.name,
      total_size: 4,
      alignment: 4,
      has_dynamic_data: false,
      properties: [],
   };

   override get value(): number {
      return this.__view.getUint32(this.__byte_offset, true);
   }

   override set value(v: number) {
      this.__view.setUint32(this.__byte_offset, v, true);
   }
}

class MockArrayU32 extends DynamicArrayPrimitive<U32PrimitiveView, number> {

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator
   ) {
      super(buffer, byte_offset, allocator, U32PrimitiveView);

      return new Proxy(this, DynamicArray.$create_proxy_handler<U32PrimitiveView, number>());
   }

   get(index: number): number | undefined {
      return this.$get_element_view(index)?.value;
   }

   set(index: number, value: number): boolean {
      const view = this.$get_element_view(index);

      if (view) {
         view.value = value;

         return true;
      }

      return false;
   }

   push(...values: number[]): number {
      for (const value of values) {
         this.$push_new_slot().value = value;
      }

      return this.length;
   }
}

interface MockArrayU32 {
   [index: number]: number | undefined;
}

class ComplexComponent_g implements IView {

   static readonly __schema: SchemaLayout = {
      class_name: ComplexComponent_g.name,
      total_size: 24,
      alignment: 4,
      has_dynamic_data: true,
      properties: [
         {
            property_key: 'name',
            order: 0,
            type: 'str',
            offset: 0,
            size: 4,
            alignment: 4,
            start_line: 0,
            end_line: 0,
            binary_info: {
               is_dynamic: true,
               has_dynamic_data: true,
               size: 4,
               alignment: 4,
               is_nested_struct: false,
               is_optional: false,
               is_ptr: true
            }
         },
         {
            property_key: 'layers',
            order: 1,
            type: 'u32[]',
            offset: 4,
            size: 4,
            alignment: 4,
            start_line: 0,
            end_line: 0,
            binary_info: {
               is_dynamic: true,
               has_dynamic_data: true,
               size: 4,
               alignment: 4,
               is_nested_struct: false,
               is_optional: false,
               is_ptr: true
            }
         },
         {
            property_key: 'data_map',
            order: 2,
            type: 'map<str, NestedData_g>',
            offset: 8,
            size: 4,
            alignment: 4,
            start_line: 0,
            end_line: 0,
            binary_info: {
               is_dynamic: true,
               has_dynamic_data: true,
               size: 4,
               alignment: 4,
               is_nested_struct: false,
               is_optional: false,
               is_ptr: true
            }
         },
         {
            property_key: 'vector',
            order: 3,
            type: '[f32, 3]',
            offset: 12,
            size: 12,
            alignment: 4,
            start_line: 0,
            end_line: 0,
            binary_info: {
               element_count: 3,
               element_type: 'f32',
               size: 12,
               alignment: 4,
               is_dynamic: false,
               has_dynamic_data: false,
               is_nested_struct: false,
               is_optional: false,
               is_ptr: false
            }
         }
      ]
   };

   readonly __view: DataView;
   readonly __buffer: ArrayBufferLike;
   readonly __byte_offset: Pointer;
   readonly __allocator: TlsfAllocator;

   #name_view?: DynamicString;
   #layers_view?: MockArrayU32;
   #data_map_view?: DynamicHashMapStringOf<NestedData_g>;

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

   get name(): string {
      if (!this.#name_view) {
         this.#name_view = new DynamicString(this.__buffer, this.__byte_offset + 0, this.__allocator);
      }

      return this.#name_view.value;
   }

   set name(v: string) {
      if (!this.#name_view) {
         this.#name_view = new DynamicString(this.__buffer, this.__byte_offset + 0, this.__allocator);
      }

      this.#name_view.value = v;
   }

   get layers(): MockArrayU32 {
      if (!this.#layers_view) {
         this.#layers_view = new MockArrayU32(this.__buffer, this.__byte_offset + 4, this.__allocator);
      }

      return this.#layers_view;
   }

   set layers(v: Iterable<number>) {
      const dest = this.layers;

      while (dest.length > 0) {
         dest.pop();
      }

      for (const item of v) {
         dest.push(item);
      }
   }

   get data_map(): DynamicHashMapStringOf<NestedData_g> {
      if (!this.#data_map_view) {
         this.#data_map_view = new DynamicHashMapStringOf(this.__buffer, this.__byte_offset + 8, this.__allocator, NestedData_g as IViewConstructor<NestedData_g>);
      }

      return this.#data_map_view;
   }

   set data_map(v: Map<string, NestedData_g> | DynamicHashMapStringOf<NestedData_g>) {
      this.data_map.$copy_from(v);
   }

   get vector(): [number, number, number] {
      const arr: [number, number, number] = [0, 0, 0];

      for (let i = 0; i < 3; i++) {
         arr[i] = this.__view.getFloat32(this.__byte_offset + 12 + (i * 4), LITTLE_ENDIAN);
      }

      return arr;
   }

   set vector(v: [number, number, number]) {
      for (let i = 0; i < 3; i++) {
         this.__view.setFloat32(this.__byte_offset + 12 + (i * 4), v[i]!, LITTLE_ENDIAN);
      }
   }

   $copy_from(source: ComplexComponent_g) {
      this.name = source.name;
      this.layers = source.layers;
      this.data_map = source.data_map;
      this.vector = source.vector;
   }

   free() {
      this.#name_view?.free();
      this.#layers_view?.free();
      this.#data_map_view?.free();
   }
}

describe('e2e complex generated struct', () => {
   let allocator: TlsfAllocator;
   let view_container_buffer: ArrayBuffer;
   let component: ComplexComponent_g;
   let temp_allocator: TlsfAllocator;

   beforeEach(() => {
      const pool_buffer = new ArrayBuffer(1024 * 128);

      allocator = new TlsfAllocator(pool_buffer, 0, pool_buffer.byteLength);
      view_container_buffer = new ArrayBuffer(ComplexComponent_g.__schema.total_size);
      component = new ComplexComponent_g(view_container_buffer, 0, allocator);
      temp_allocator = new TlsfAllocator(new ArrayBuffer(1024), 0, 1024);
   });

   const create_nested_source = (id: number, tag: string): NestedData_g => {
      const buf = new ArrayBuffer(NestedData_g.__schema.total_size);
      const view = new NestedData_g(buf, 0, temp_allocator);

      view.id = id;
      view.tag = tag;

      return view;
   }

   it('should correctly set and get all properties', () => {
      component.name = 'MyComplexComponent';
      component.layers = [1, 2, 4, 8];
      component.data_map.set('item1', create_nested_source(101, 'alpha'));
      component.data_map.set('item2', create_nested_source(102, 'beta'));
      component.vector = [1.5, -2.5, 3.0];

      expect(component.name).toBe('MyComplexComponent');
      expect([...component.layers]).toEqual([1, 2, 4, 8]);
      expect(component.data_map.size).toBe(2);
      expect(component.vector).toEqual([1.5, -2.5, 3.0]);

      const retrieved_item = component.data_map.get('item1');
      expect(retrieved_item).toBeDefined();
      expect(retrieved_item!.id).toBe(101);
      expect(retrieved_item!.tag).toBe('alpha');
   });

   it('free() should deallocate all dynamic sub-properties', () => {
      component.name = 'Component To Be Freed';
      component.layers = [1, 2, 3];
      component.data_map.set('a', create_nested_source(1, 'A'));
      component.data_map.set('b', create_nested_source(2, 'B'));
      component.data_map.get('b')!.tag = 'Longer Tag To Ensure Realloc';

      const free_spy = spyOn(allocator, 'free');

      component.free();

      expect(free_spy.mock.calls.length).toBeGreaterThanOrEqual(11);

      free_spy.mockRestore();
   });

   it('$copy_from() should perform a deep copy of all data', () => {
      const source = new ComplexComponent_g(new ArrayBuffer(ComplexComponent_g.__schema.total_size), 0, allocator);

      source.name = 'Source Component';
      source.layers = [10, 20];
      source.data_map.set('src_key', create_nested_source(99, 'source_tag'));
      source.vector = [1, 2, 3];

      component.$copy_from(source);

      expect(component.name).toBe('Source Component');
      expect([...component.layers]).toEqual([10, 20]);
      expect(component.data_map.get('src_key')?.id).toBe(99);
      expect(component.vector).toEqual([1, 2, 3]);

      source.name = 'Modified Source';
      source.layers.push(30);
      source.data_map.get('src_key')!.tag = 'modified_tag';
      source.vector[0] = 999;

      expect(component.name).toBe('Source Component');
      expect([...component.layers]).toEqual([10, 20]);
      expect(component.data_map.get('src_key')?.tag).toBe('source_tag');
      expect(component.vector).toEqual([1, 2, 3]);
   });
});