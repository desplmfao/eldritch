/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/tests/runtime/allocator/allocator_safety.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { TlsfAllocator } from '@self/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER, POINTER_SIZE } from '@self/runtime/allocator/constants';

/// #if SAFETY
describe('TlsfAllocator safety features', () => {
   const POOL_SIZE = 1024;
   let allocator: TlsfAllocator;
   let buffer: ArrayBuffer;

   beforeEach(() => {
      buffer = new ArrayBuffer(POOL_SIZE);
      allocator = new TlsfAllocator(buffer);
   });

   it('should stomp freed memory with 0xCC pattern', () => {
      const alloc_size = 32;
      const ptr = allocator.allocate(alloc_size);

      expect(ptr).not.toBe(GLOBAL_NULL_POINTER);
      const payload_size = allocator.get_allocation_size(ptr);
      expect(payload_size).toBeGreaterThanOrEqual(alloc_size);

      const view_before_free = new Uint8Array(buffer, ptr, payload_size);
      view_before_free.fill(0xFF);

      for (let i = 0; i < payload_size; i++) {
         expect(view_before_free[i]).toBe(255);
      }

      const was_freed = allocator.free(ptr);
      expect(was_freed).toBe(true);

      const view_after_free = new Uint8Array(buffer, ptr, payload_size);

      const FREE_LIST_POINTERS_SIZE = POINTER_SIZE + POINTER_SIZE;

      for (let i = 0; i < FREE_LIST_POINTERS_SIZE; i++) {
         expect(view_after_free[i]).toBe(255);
      }

      for (let i = FREE_LIST_POINTERS_SIZE; i < payload_size; i++) {
         expect(view_after_free[i]).toBe(204);
      }
   });

   describe('is_valid_memory_range', () => {
      it('should return true for a valid allocation and exact size', () => {
         const ptr = allocator.allocate(32);
         const size = allocator.get_allocation_size(ptr);

         expect(allocator.is_valid_memory_range(ptr, size)).toBe(true);
      });

      it('should return true for a valid allocation and smaller size', () => {
         const ptr = allocator.allocate(32);
         const size = allocator.get_allocation_size(ptr);

         expect(allocator.is_valid_memory_range(ptr, size - 1)).toBe(true);
         expect(allocator.is_valid_memory_range(ptr, 1)).toBe(true);
      });

      it('should return true for a valid allocation of zero size', () => {
         const ptr = allocator.allocate(32);

         expect(allocator.is_valid_memory_range(ptr, 0)).toBe(true);
      });

      it('should return false for a valid allocation but off-by-one size (overflow)', () => {
         const ptr = allocator.allocate(32);
         const size = allocator.get_allocation_size(ptr);

         expect(allocator.is_valid_memory_range(ptr, size + 1)).toBe(false);
      });

      it('should return false for a valid allocation but overflowing size', () => {
         const ptr = allocator.allocate(32);
         const size = allocator.get_allocation_size(ptr);

         expect(allocator.is_valid_memory_range(ptr, size + 100)).toBe(false);
      });

      it('should return false for a pointer that has been freed (use-after-free)', () => {
         const ptr = allocator.allocate(32);
         const size = allocator.get_allocation_size(ptr);

         allocator.free(ptr);

         expect(allocator.is_valid_memory_range(ptr, size)).toBe(false);
         expect(allocator.is_valid_memory_range(ptr, 1)).toBe(false);
      });

      it('should return true for a null pointer with size 0', () => {
         expect(allocator.is_valid_memory_range(GLOBAL_NULL_POINTER, 0)).toBe(true);
      });

      it('should return false for a null pointer with non-zero size', () => {
         expect(allocator.is_valid_memory_range(GLOBAL_NULL_POINTER, 1)).toBe(false);
      });

      it('should return false for a pointer outside the managed region (too high)', () => {
         expect(allocator.is_valid_memory_range(POOL_SIZE + 100, 10)).toBe(false);
      });

      it('should return false for a pointer outside the managed region (too low/negative)', () => {
         expect(allocator.is_valid_memory_range(-10, 10)).toBe(false);
      });

      it('should return false for a pointer inside the region but not a valid user ptr', () => {
         const ptr = allocator.allocate(32);

         expect(allocator.is_valid_memory_range(ptr - 1, 1)).toBe(false);
         expect(allocator.is_valid_memory_range(ptr + 1, 16)).toBe(false);
      });
   });
});
/// #endif