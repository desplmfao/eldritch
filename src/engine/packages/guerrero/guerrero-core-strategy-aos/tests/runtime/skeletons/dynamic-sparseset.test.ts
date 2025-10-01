/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/runtime/skeletons/dynamic-sparseset.test.ts
 */

import { describe, it, expect, beforeEach, spyOn } from 'bun:test';

import type { IViewConstructor, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { IGuerreroArray } from '@eldritch-engine/type-utils/guerrero/interfaces';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER, POINTER_SIZE, LITTLE_ENDIAN } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';
import { DynamicArray } from '@self/runtime/skeletons/dynamic/array/dynamic-array';
import { DynamicArrayPrimitive } from '@self/runtime/skeletons/dynamic/array/dynamic-array-primitive';

import { DynamicSparseSet } from '@self/runtime/skeletons/dynamic/dynamic-sparseset'
import { PrimitiveView } from '@self/runtime/skeletons/fixed/fixed-primitive';

// TODO: make this use substitute aliasing when shit works better lol

class U32View extends PrimitiveView<number> {
   static override readonly __schema: SchemaLayout = {
      class_name: U32View.name,
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

class DynamicArrayOfU32 extends DynamicArrayPrimitive<U32View, number> implements IGuerreroArray<number> {
   constructor(
      buffer: ArrayBufferLike,
      byte_offset: number,
      allocator: TlsfAllocator
   ) {
      super(
         buffer,
         byte_offset,
         allocator,
         U32View
      );

      return new Proxy(this, DynamicArray.$create_proxy_handler<U32View, number>()) as DynamicArrayOfU32;
   }

   get(index: number): number | undefined {
      return this.$get_element_view(index)?.value;
   };

   set(index: number, value: number): boolean {
      const v = this.$get_element_view(index);

      if (v) {
         v.value = value;

         return true;
      }

      return false;
   }

   push(...values: number[]): number {
      for (const v of values) {
         this.$push_new_slot().value = v;
      }

      return this.length;
   }
}

interface DynamicArrayOfU32 {
   [index: number]: number | undefined;
}

class TestSparseSet extends DynamicSparseSet {
   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator
   ) {
      super(buffer, byte_offset, allocator, DynamicArrayOfU32 as IViewConstructor<IGuerreroArray<number>>);
   }
}

describe('runtime skeletons - DynamicSparseSet', () => {
   let allocator: TlsfAllocator;
   let sparse_set: DynamicSparseSet;

   beforeEach(() => {
      const pool_buffer = new ArrayBuffer(1024 * 128);
      allocator = new TlsfAllocator(pool_buffer, 0, pool_buffer.byteLength);

      const view_container_buffer = new ArrayBuffer(4);
      sparse_set = new TestSparseSet(view_container_buffer, 0, allocator);
   });

   it('should initialize empty', () => {
      expect(sparse_set.size).toBe(0);
      expect(sparse_set.has(0)).toBe(false);
   });

   it('should add a number', () => {
      expect(sparse_set.add(10)).toBe(true);
      expect(sparse_set.size).toBe(1);
      expect(sparse_set.has(10)).toBe(true);
   });

   it('should not add a duplicate number', () => {
      expect(sparse_set.add(10)).toBe(true);
      expect(sparse_set.add(10)).toBe(false);
      expect(sparse_set.size).toBe(1);
   });

   it('should grow the sparse array when adding a large number', () => {
      expect(sparse_set.add(1000)).toBe(true);
      expect(sparse_set.size).toBe(1);
      expect(sparse_set.has(1000)).toBe(true);
      expect(sparse_set.$sparse.length).toBeGreaterThanOrEqual(1001);
   });

   it('should delete an number using swap-and-pop', () => {
      sparse_set.add(10);
      sparse_set.add(20);
      sparse_set.add(30);
      expect(sparse_set.size).toBe(3);

      expect([...sparse_set]).toEqual([10, 20, 30]);
      expect(sparse_set.$sparse.get(10)).toBe(0);
      expect(sparse_set.$sparse.get(20)).toBe(1);
      expect(sparse_set.$sparse.get(30)).toBe(2);

      const was_deleted = sparse_set.delete(20);
      expect(was_deleted).toBe(true);
      expect(sparse_set.size).toBe(2);
      expect(sparse_set.has(20)).toBe(false);
      expect(sparse_set.has(10)).toBe(true);
      expect(sparse_set.has(30)).toBe(true);

      expect([...sparse_set]).toEqual([10, 30]);
      expect(sparse_set.$sparse.get(10)).toBe(0);
      expect(sparse_set.$sparse.get(30)).toBe(1);
   });

   it('should correctly delete the last added number', () => {
      sparse_set.add(10);
      sparse_set.add(20);
      sparse_set.delete(20);
      expect(sparse_set.size).toBe(1);
      expect(sparse_set.has(20)).toBe(false);
      expect([...sparse_set]).toEqual([10]);
   });

   it('should return false when deleting a non-existent number', () => {
      sparse_set.add(10);
      expect(sparse_set.delete(99)).toBe(false);
      expect(sparse_set.size).toBe(1);
   });

   it('should be iterable and provide set-like iterators', () => {
      sparse_set.add(5);
      sparse_set.add(2);
      sparse_set.add(8);

      // symbol.iterator
      const elements = [...sparse_set];
      expect(elements.sort()).toEqual([2, 5, 8].sort());

      // values()
      const values = [...sparse_set.values()].sort();
      expect(values).toEqual([2, 5, 8]);

      // keys()
      const keys = [...sparse_set.keys()].sort();
      expect(keys).toEqual([2, 5, 8]);

      // entries()
      const entries = [...sparse_set.entries()].sort((a, b) => a[0] - b[0]);
      expect(entries).toEqual([[2, 2], [5, 5], [8, 8]]);
   });

   it('should clear all numbers', () => {
      sparse_set.add(1);
      sparse_set.add(2);
      sparse_set.clear();
      expect(sparse_set.size).toBe(0);
      expect(sparse_set.has(1)).toBe(false);
      expect([...sparse_set].length).toBe(0);
   });

   it('should copy from a native array', () => {
      const native_array = [11, 22, 33];
      sparse_set.$copy_from(native_array);
      expect(sparse_set.size).toBe(3);
      expect(sparse_set.has(22)).toBe(true);
      expect([...sparse_set].sort()).toEqual([11, 22, 33]);
   });

   it('should free all memory', () => {
      sparse_set.add(10);
      sparse_set.add(20);
      const free_spy = spyOn(allocator, 'free');
      sparse_set.free();

      expect(free_spy.mock.calls.length).toBe(5);
      free_spy.mockRestore();

      expect(sparse_set.size).toBe(0);
      expect(sparse_set.$control_block_ptr).toBe(GLOBAL_NULL_POINTER);
   });

   describe('low-level pointer manipulation', () => {
      it('should allow swapping the data of two sets by swapping their control pointers', () => {
         const view_container = new ArrayBuffer(8);
         const set1 = new TestSparseSet(view_container, 0, allocator);
         const set2 = new TestSparseSet(view_container, POINTER_SIZE, allocator);

         set1.add(10);
         set1.add(20);
         set2.add(100);

         expect(set1.size).toBe(2);
         expect(set2.size).toBe(1);
         expect(set1.has(10)).toBe(true);
         expect(set2.has(100)).toBe(true);

         const ptr1 = set1.$control_block_ptr;
         const ptr2 = set2.$control_block_ptr;

         set1.$control_block_ptr = ptr2;
         set2.$control_block_ptr = ptr1;

         expect(set1.size).toBe(1);
         expect(set2.size).toBe(2);
         expect(set1.has(100)).toBe(true);
         expect(set2.has(10)).toBe(true);
         expect(set1.has(10)).toBe(false);
         expect(set2.has(100)).toBe(false);

         set1.free();
         set2.free();
      });

      it('should correctly invalidate cached array views after pointer set', () => {
         const view_container = new ArrayBuffer(8);
         const set1 = new TestSparseSet(view_container, 0, allocator);
         const set2 = new TestSparseSet(view_container, POINTER_SIZE, allocator);

         set1.add(5);
         const dense_view_before = set1.$dense; // cache the view
         expect(dense_view_before.length).toBe(1);

         set2.add(99);
         const ptr2 = set2.$control_block_ptr;

         set1.$control_block_ptr = ptr2;
         expect(set1.size).toBe(1);
         expect(set1.has(99)).toBe(true);
         expect(set1.has(5)).toBe(false);
         // access after pointer swap should give the new correct view
         expect(set1.$dense.length).toBe(1);
         expect(set1.$dense.get(0)).toBe(99);

         set2.free();
      });
   });
});