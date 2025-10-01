/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/dynamic-array-primitive.test.ts
 */

import { describe, it, expect, beforeEach, spyOn } from 'bun:test';

import type { IViewConstructor, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { POINTER_SIZE, LITTLE_ENDIAN, GLOBAL_NULL_POINTER } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicArray } from '@self/runtime/skeletons/dynamic/array/dynamic-array';
import { DynamicArrayPrimitive } from '@self/runtime/skeletons/dynamic/array/dynamic-array-primitive';
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

class MockDynamicArrayU32 extends DynamicArrayPrimitive<MockU32View, number> {
   constructor(buffer: ArrayBufferLike, byte_offset: Pointer, allocator: TlsfAllocator) {
      super(buffer, byte_offset, allocator, MockU32View as IViewConstructor<MockU32View>);

      return new Proxy(this, DynamicArray.$create_proxy_handler());
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

interface MockDynamicArrayU32 {
   [index: number]: number | undefined;
}

describe('runtime skeletons - DynamicArrayPrimitive', () => {
   const ALLOCATOR_POOL_SIZE = 1024 * 64;

   let allocator: TlsfAllocator;
   let view_container_buffer: ArrayBuffer;
   let dyn_array: MockDynamicArrayU32;

   beforeEach(() => {
      const allocator_pool_buffer = new ArrayBuffer(ALLOCATOR_POOL_SIZE);

      allocator = new TlsfAllocator(allocator_pool_buffer, 0, ALLOCATOR_POOL_SIZE);
      view_container_buffer = new ArrayBuffer(POINTER_SIZE);
      dyn_array = new MockDynamicArrayU32(view_container_buffer, 0, allocator);
   });

   it('should initialize empty', () => {
      expect(dyn_array.length).toBe(0);
   });

   it('should push values', () => {
      dyn_array.push(10, 20, 30);
      expect(dyn_array.length).toBe(3);
      expect(dyn_array[0]).toBe(10);
      expect(dyn_array[1]).toBe(20);
      expect(dyn_array[2]).toBe(30);
   });

   it('should pop values', () => {
      dyn_array.push(10, 20, 30);
      expect(dyn_array.pop()).toBe(30);
      expect(dyn_array.length).toBe(2);
      expect(dyn_array.pop()).toBe(20);
      expect(dyn_array.length).toBe(1);
      expect(dyn_array.pop()).toBe(10);
      expect(dyn_array.length).toBe(0);
      expect(dyn_array.pop()).toBeUndefined();
   });

   it('should set values by index', () => {
      dyn_array.push(1, 2, 3);
      dyn_array[1] = 99;
      expect(dyn_array[1]).toBe(99);
      expect(dyn_array.length).toBe(3);
   });

   it('should be iterable', () => {
      const values = [100, 200, 300];
      dyn_array.push(...values);
      const collected = [...dyn_array];
      expect(collected).toEqual(values);
   });

   describe('indexOf and includes', () => {
      beforeEach(() => {
         dyn_array.push(10, 20, 30, 20);
      });

      it('should find the first index of a value', () => {
         expect(dyn_array.indexOf(20)).toBe(1);
      });

      it('should return -1 if the value is not found', () => {
         expect(dyn_array.indexOf(99)).toBe(-1);
      });

      it('should respect the fromIndex parameter', () => {
         expect(dyn_array.indexOf(20, 2)).toBe(3);
      });

      it('should return true from includes() if the value exists', () => {
         expect(dyn_array.includes(30)).toBe(true);
      });

      it('should return false from includes() if the value does not exist', () => {
         expect(dyn_array.includes(99)).toBe(false);
      });

      it('should handle fromIndex correctly in includes()', () => {
         expect(dyn_array.includes(10, 1)).toBe(false);
         expect(dyn_array.includes(20, 2)).toBe(true);
      });
   });

   it('should free its memory', () => {
      dyn_array.push(1, 2, 3, 4, 5);

      const control_ptr = dyn_array.$control_block_ptr;
      const elements_ptr = dyn_array.$get_elements_buffer_ptr();
      expect(control_ptr).not.toBe(GLOBAL_NULL_POINTER);
      expect(elements_ptr).not.toBe(GLOBAL_NULL_POINTER);

      dyn_array.free();
      expect(dyn_array.length).toBe(0);
      expect(dyn_array.$control_block_ptr).toBe(GLOBAL_NULL_POINTER);

      const test_alloc = allocator.allocate(100);
      expect(test_alloc).not.toBe(GLOBAL_NULL_POINTER);
   });

   it('free should not require freeing individual elements', () => {
      dyn_array.push(1, 2, 3);
      const free_spy = spyOn(allocator, 'free');
      dyn_array.free();

      expect(free_spy).toHaveBeenCalledTimes(2);
      free_spy.mockRestore();
   });
});