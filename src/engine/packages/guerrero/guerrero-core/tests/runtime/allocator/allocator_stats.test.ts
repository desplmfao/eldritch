/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/tests/runtime/allocator/allocator_stats.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { TlsfAllocator } from '@self/runtime/allocator/allocator';

import {
   ALIGN_SIZE,
   MINIMAL_BLOCK_HEADER_SIZE,
   BLOCK_HEADER_FULL_SIZE,
   GLOBAL_NULL_POINTER,
} from '@self/runtime/allocator/constants';

import { adjust_request_size, align_down } from '@self/runtime/allocator/block_utils';

//
//

/// #if TLSF_STATS
describe('TlsfAllocator statistics', () => {
   const POOL_SIZE = 1024 * 4;
   const POOL_OVERHEAD = MINIMAL_BLOCK_HEADER_SIZE + BLOCK_HEADER_FULL_SIZE;

   let allocator: TlsfAllocator;
   let main_buffer: ArrayBuffer;
   let expected_initial_free_payload: number;

   beforeEach(() => {
      main_buffer = new ArrayBuffer(POOL_SIZE);
      allocator = new TlsfAllocator(main_buffer);
      expected_initial_free_payload = align_down(POOL_SIZE - POOL_OVERHEAD, ALIGN_SIZE);
   });

   describe('constructor', () => {
      it('should initialize statistics correctly', () => {
         const stats = allocator.get_statistics();

         expect(stats.pool_total_bytes).toBe(POOL_SIZE);
         expect(stats.pool_overhead_bytes).toBe(POOL_OVERHEAD);

         expect(stats.payload_bytes_in_use).toBe(0);
         expect(stats.overhead_bytes_in_use).toBe(0);
         expect(stats.total_bytes_in_use).toBe(0);
         expect(stats.num_allocations_active).toBe(0);

         expect(stats.num_free_blocks_active).toBe(1);
         expect(stats.payload_bytes_free).toBe(expected_initial_free_payload);
         expect(stats.overhead_bytes_free).toBe(BLOCK_HEADER_FULL_SIZE);
         expect(stats.total_bytes_free).toBe(expected_initial_free_payload + BLOCK_HEADER_FULL_SIZE);

         expect(stats.peak_num_allocations).toBe(0);
         expect(stats.peak_payload_bytes_in_use).toBe(0);

         expect(stats.total_allocate_calls).toBe(0);
         expect(stats.total_free_calls).toBe(0);
         expect(stats.total_reallocate_calls).toBe(0);
      });
   });

   describe('allocate', () => {
      it('should update stats correctly on a successful allocation (with split)', () => {
         const size = 64;
         const adjusted_size = adjust_request_size(size, ALIGN_SIZE);
         allocator.allocate(size);

         const stats = allocator.get_statistics();
         expect(stats.total_allocate_calls).toBe(1);
         expect(stats.successful_allocate_calls).toBe(1);
         expect(stats.failed_allocate_calls).toBe(0);
         expect(stats.num_allocations_active).toBe(1);
         expect(stats.payload_bytes_in_use).toBe(adjusted_size);
         expect(stats.overhead_bytes_in_use).toBe(MINIMAL_BLOCK_HEADER_SIZE);
         expect(stats.total_bytes_in_use).toBe(adjusted_size + MINIMAL_BLOCK_HEADER_SIZE);
         expect(stats.peak_num_allocations).toBe(1);
         expect(stats.peak_payload_bytes_in_use).toBe(adjusted_size);

         expect(stats.num_free_blocks_active).toBe(1);
         const expected_free_payload = expected_initial_free_payload - adjusted_size - MINIMAL_BLOCK_HEADER_SIZE;
         expect(stats.payload_bytes_free).toBe(expected_free_payload);
         expect(stats.overhead_bytes_free).toBe(BLOCK_HEADER_FULL_SIZE);
         expect(stats.total_bytes_free).toBe(expected_free_payload + BLOCK_HEADER_FULL_SIZE);
      });

      it('should update stats correctly on a failed allocation', () => {
         expect(() => allocator.allocate(POOL_SIZE)).toThrow(/OUT OF MEMORY/);

         const stats = allocator.get_statistics();
         expect(stats.total_allocate_calls).toBe(1);
         expect(stats.failed_allocate_calls).toBe(1);
         expect(stats.successful_allocate_calls).toBe(0);
         expect(stats.num_allocations_active).toBe(0);
         expect(stats.total_bytes_in_use).toBe(0);
      });
   });

   describe('free', () => {
      it('should update stats correctly on a successful free (with coalesce)', () => {
         const size = 128;
         const ptr = allocator.allocate(size);
         allocator.free(ptr);

         const stats = allocator.get_statistics();
         expect(stats.total_free_calls).toBe(1);
         expect(stats.successful_free_calls).toBe(1);
         expect(stats.num_allocations_active).toBe(0);
         expect(stats.total_bytes_in_use).toBe(0);
         expect(stats.num_free_blocks_active).toBe(1);
         expect(stats.payload_bytes_free).toBe(expected_initial_free_payload);
         expect(stats.total_bytes_free).toBe(expected_initial_free_payload + BLOCK_HEADER_FULL_SIZE);
      });

      it('should increment call count but not success count on freeing a null pointer', () => {
         allocator.free(GLOBAL_NULL_POINTER);
         const stats = allocator.get_statistics();

         expect(stats.total_free_calls).toBe(1);
         expect(stats.successful_free_calls).toBe(0);
      });
   });

   describe('reallocate', () => {
      it('should update stats correctly when shrinking in place', () => {
         const ptr = allocator.allocate(128);
         const stats_before = allocator.get_statistics();

         const new_size = 64;
         const adjusted_new_size = adjust_request_size(new_size, ALIGN_SIZE);
         allocator.reallocate(ptr, new_size);

         const stats_after = allocator.get_statistics();
         expect(stats_after.total_reallocate_calls).toBe(1);
         expect(stats_after.num_allocations_active).toBe(1);
         expect(stats_after.payload_bytes_in_use).toBe(adjusted_new_size);
         expect(stats_after.num_free_blocks_active).toBe(stats_before.num_free_blocks_active);
      });

      it('should update stats correctly when growing in place by merging', () => {
         const ptr1 = allocator.allocate(64);
         const ptr2 = allocator.allocate(64);
         allocator.free(ptr2);
         const stats_before = allocator.get_statistics();

         const new_size = 100;
         allocator.reallocate(ptr1, new_size);

         const stats_after = allocator.get_statistics();
         expect(stats_after.total_reallocate_calls).toBe(1);
         expect(stats_after.num_allocations_active).toBe(1);
         expect(stats_after.num_free_blocks_active).toBe(stats_before.num_free_blocks_active);
      });

      it('should update stats correctly when moving (alloc-copy-free)', () => {
         const ptr1 = allocator.allocate(64);
         const ptr2 = allocator.allocate(64); // Obstacle
         const stats_before = allocator.get_statistics();

         allocator.reallocate(ptr1, 128);

         const stats_after = allocator.get_statistics();
         expect(stats_after.total_reallocate_calls).toBe(1);
         expect(stats_after.total_allocate_calls).toBe(3);
         expect(stats_after.total_free_calls).toBe(1);
         expect(stats_after.num_allocations_active).toBe(2);
      });
   });

   describe('peak values', () => {
      it('should track peak allocations and payload correctly', () => {
         const size = 64;
         const adjusted_size = adjust_request_size(size, ALIGN_SIZE);

         const p1 = allocator.allocate(size);
         const p2 = allocator.allocate(size);
         const p3 = allocator.allocate(size);

         let stats = allocator.get_statistics();
         expect(stats.num_allocations_active).toBe(3);
         expect(stats.peak_num_allocations).toBe(3);
         expect(stats.payload_bytes_in_use).toBe(adjusted_size * 3);
         expect(stats.peak_payload_bytes_in_use).toBe(adjusted_size * 3);

         allocator.free(p2);

         stats = allocator.get_statistics();
         expect(stats.num_allocations_active).toBe(2);
         expect(stats.peak_num_allocations).toBe(3);
         expect(stats.payload_bytes_in_use).toBe(adjusted_size * 2);
         expect(stats.peak_payload_bytes_in_use).toBe(adjusted_size * 3);

         const p4 = allocator.allocate(size);
         stats = allocator.get_statistics();
         expect(stats.num_allocations_active).toBe(3);
         expect(stats.peak_num_allocations).toBe(3);
         expect(stats.payload_bytes_in_use).toBe(adjusted_size * 3);
         expect(stats.peak_payload_bytes_in_use).toBe(adjusted_size * 3);

         const p5 = allocator.allocate(size * 2);
         const adjusted_large_size = adjust_request_size(size * 2, ALIGN_SIZE);
         stats = allocator.get_statistics();
         expect(stats.num_allocations_active).toBe(4);
         expect(stats.peak_num_allocations).toBe(4);
         const new_total_payload = adjusted_size * 3 + adjusted_large_size;
         expect(stats.payload_bytes_in_use).toBe(new_total_payload);
         expect(stats.peak_payload_bytes_in_use).toBe(new_total_payload);
      });
   });
});
/// #endif