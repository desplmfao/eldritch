/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/fixed-array-primitive.test.ts
 */

import { describe, it, expect, beforeEach, spyOn } from 'bun:test';

import type { IView, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { LITTLE_ENDIAN } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { FixedArrayPrimitive } from '@self/runtime/skeletons/fixed/array/fixed-array-primitive';
import { PrimitiveView } from '@self/runtime/skeletons/fixed/fixed-primitive';

class MockF32View extends PrimitiveView<number> {

   static override readonly __schema: SchemaLayout = {
      class_name: MockF32View.name,
      total_size: 4,
      alignment: 4,
      has_dynamic_data: false,
      properties: []
   };

   override get value(): number {
      return this.__view.getFloat32(this.__byte_offset, LITTLE_ENDIAN);
   }

   override set value(v: number) {
      this.__view.setFloat32(this.__byte_offset, v, LITTLE_ENDIAN);
   }
}

class MockVec3View extends FixedArrayPrimitive<MockF32View, number, 3> {

   static override readonly __schema: SchemaLayout = {
      class_name: MockVec3View.name,
      total_size: 12,
      alignment: 4,
      has_dynamic_data: false,
      properties: []
   };

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator?: TlsfAllocator
   ) {
      super(
         buffer,
         byte_offset,
         allocator,
         //
         MockF32View,
         3
      );
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

   get [0](): number {
      return this.get(0)!;
   }

   set [0](v: number) {
      this.set(0, v);
   }

   get [1](): number {
      return this.get(1)!;
   }

   set [1](v: number) {
      this.set(1, v);
   }

   get [2](): number {
      return this.get(2)!;
   }

   set [2](v: number) {
      this.set(2, v);
   }
}

describe('runtime skeletons - FixedArrayPrimitive', () => {
   let allocator: TlsfAllocator;
   let test_view_buffer: ArrayBuffer;
   let vec3_array: MockVec3View;

   beforeEach(() => {
      const allocator_pool_buffer = new ArrayBuffer(1024 * 16);
      allocator = new TlsfAllocator(allocator_pool_buffer);
      test_view_buffer = new ArrayBuffer(256);
      vec3_array = new MockVec3View(test_view_buffer, 0, undefined);
   });

   it('should initialize with correct length', () => {
      expect(vec3_array.length).toBe(3);
   });

   it('should allow getting and setting elements', () => {
      vec3_array[0] = 1.1;
      vec3_array[1] = 2.2;
      vec3_array[2] = 3.3;

      expect(vec3_array[0]).toBeCloseTo(1.1);
      expect(vec3_array[1]).toBeCloseTo(2.2);
      expect(vec3_array[2]).toBeCloseTo(3.3);
      expect(vec3_array.get(1)).toBeCloseTo(2.2);
   });

   it('should be iterable with for...of and spread', () => {
      vec3_array[0] = 10;
      vec3_array[1] = 20;
      vec3_array[2] = 30;

      const collected: number[] = [];
      for (const val of vec3_array) {
         collected.push(val);
      }
      expect(collected).toEqual([10, 20, 30]);
      expect([...vec3_array]).toEqual([10, 20, 30]);
   });

   describe('iterators', () => {
      beforeEach(() => {
         vec3_array[0] = 10;
         vec3_array[1] = 20;
         vec3_array[2] = 30;
      });

      it('values() should yield all values', () => {
         expect([...vec3_array.values()]).toEqual([10, 20, 30]);
      });

      it('keys() should yield all indices', () => {
         expect([...vec3_array.keys()]).toEqual([0, 1, 2]);
      });

      it('entries() should yield [index, value] pairs', () => {
         expect([...vec3_array.entries()]).toEqual([[0, 10], [1, 20], [2, 30]]);
      });
   });

   describe('indexOf and includes', () => {
      beforeEach(() => {
         vec3_array[0] = 10;
         vec3_array[1] = 20;
         vec3_array[2] = 10;
      });

      it('should find the index of a value', () => {
         expect(vec3_array.indexOf(20)).toBe(1);
      });

      it('should return -1 for a non-existent value', () => {
         expect(vec3_array.indexOf(99)).toBe(-1);
      });

      it('should respect fromIndex', () => {
         expect(vec3_array.indexOf(10, 1)).toBe(2);
      });

      it('should return true from includes() if value exists', () => {
         expect(vec3_array.includes(10)).toBe(true);
      });
   });

   it('$copy_from should copy values', () => {
      const source_buffer = new ArrayBuffer(MockVec3View.__schema.total_size);
      const source_vec3 = new MockVec3View(source_buffer, 0, undefined);
      source_vec3[0] = 7;
      source_vec3[1] = 8;
      source_vec3[2] = 9;

      vec3_array.$copy_from(source_vec3);

      expect(vec3_array[0]).toBe(7);
      expect(vec3_array[1]).toBe(8);
      expect(vec3_array[2]).toBe(9);
   });

   it('free() should be a no-op for primitive elements without dynamic data', () => {
      const allocator_free_spy = spyOn(allocator, 'free');
      vec3_array.free();
      expect(allocator_free_spy).not.toHaveBeenCalled();
      allocator_free_spy.mockRestore();
   });
});