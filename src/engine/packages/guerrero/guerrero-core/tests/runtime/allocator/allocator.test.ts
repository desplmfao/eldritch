/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/tests/runtime/allocator/allocator.test.ts
 */

import { describe, expect, it, beforeEach } from 'bun:test';

import type { Pointer } from '@eldritch-engine/type-utils/guerrero/index';

import { default_logger } from '@eldritch-engine/logger/logger';

import { TlsfAllocator } from '@self/runtime/allocator/allocator';

import {
   ALIGN_SIZE,
   BLOCK_PAYLOAD_MIN_SIZE,
   MINIMAL_BLOCK_HEADER_SIZE,
   BLOCK_HEADER_FULL_SIZE,
   NULL_BLOCK_SENTINEL_OFFSET,
   GLOBAL_NULL_POINTER,
} from '@self/runtime/allocator/constants';

import {
   block_get_payload_size,
   block_is_free,
   block_is_prev_free,
   block_get_next_free_offset,
   block_get_prev_free_offset,
   block_user_ptr_from_header,
   block_header_from_user_ptr,
   block_get_prev_phys_block_offset,
   block_is_last,
   align_down,
   adjust_request_size,
   block_can_split,
} from '@self/runtime/allocator/block_utils';
import { mapping_insert } from '@self/runtime/allocator/mapping';

interface TestBlockInfo {
   header_offset: Pointer;
   payload_size: number;
   is_free: boolean;
   is_prev_free: boolean;
   prev_phys_block_offset: Pointer;
   next_free_offset?: Pointer;
   prev_free_offset?: Pointer;
   user_ptr_offset: Pointer;
   is_last_block: boolean;
}

function get_block_info(
   buffer_view: ArrayBufferLike,
   block_header_offset: Pointer
): TestBlockInfo {
   const payload_size = block_get_payload_size(buffer_view, block_header_offset);
   const is_free_val = block_is_free(buffer_view, block_header_offset);
   const info: TestBlockInfo = {
      header_offset: block_header_offset,
      payload_size: payload_size,
      is_free: is_free_val,
      is_prev_free: block_is_prev_free(buffer_view, block_header_offset),
      user_ptr_offset: block_user_ptr_from_header(block_header_offset),
      prev_phys_block_offset: block_get_prev_phys_block_offset(buffer_view, block_header_offset),
      is_last_block: block_is_last(buffer_view, block_header_offset),
   };

   if (
      is_free_val
      && !info.is_last_block
      && payload_size >= BLOCK_PAYLOAD_MIN_SIZE
   ) {
      info.next_free_offset = block_get_next_free_offset(buffer_view, block_header_offset);
      info.prev_free_offset = block_get_prev_free_offset(buffer_view, block_header_offset);
   }

   return info;
}

describe('TlsfAllocator', () => {
   const POOL_OFFSET = 0;
   const DEFAULT_POOL_SIZE = 1024;
   const TLSF_INTERNAL_OVERHEAD = MINIMAL_BLOCK_HEADER_SIZE + BLOCK_HEADER_FULL_SIZE;

   let initial_pool_usable_payload: number;

   function setup_allocator_env(
      pool_size: number = DEFAULT_POOL_SIZE,
      offset: Pointer = POOL_OFFSET
   ): {
      allocator: TlsfAllocator,
      buffer: ArrayBuffer,
      initial_usable_payload: number
   } {
      const host_buffer = new ArrayBuffer(pool_size + offset);
      const new_allocator = new TlsfAllocator(host_buffer, offset, pool_size);

      const usable_payload = align_down(pool_size - TLSF_INTERNAL_OVERHEAD, ALIGN_SIZE);
      initial_pool_usable_payload = usable_payload;

      return {
         allocator: new_allocator,
         buffer: host_buffer,
         initial_usable_payload: usable_payload
      };
   }

   describe('constructor', () => {
      it('should throw if initial pool size is zero or negative', () => {
         const main_test_buffer = new ArrayBuffer(100);

         expect(() => new TlsfAllocator(main_test_buffer, 0, 0)).toThrow(/pool size .* is too small/);
         expect(() => new TlsfAllocator(main_test_buffer, 0, -10)).toThrow(/pool size .* is too small/);
      });

      it('should correctly initialize a valid pool and set up initial block and sentinel', () => {
         const pool_size = 256;

         const {
            allocator: local_allocator,
            buffer: host_buffer,
            initial_usable_payload: expected_first_block_payload
         } = setup_allocator_env(pool_size);

         expect(local_allocator.region_start_offset_in_buffer).toBe(POOL_OFFSET);
         expect(local_allocator.region_end_offset_in_buffer).toBe(POOL_OFFSET + pool_size);

         const first_block_hdr_offset = POOL_OFFSET;
         const first_block_info = get_block_info(host_buffer, first_block_hdr_offset);

         expect(first_block_info.payload_size).toBe(expected_first_block_payload);
         expect(first_block_info.is_free).toBe(true);
         expect(first_block_info.is_prev_free).toBe(false);

         const sentinel_hdr_offset = first_block_hdr_offset + MINIMAL_BLOCK_HEADER_SIZE + expected_first_block_payload;
         const sentinel_info = get_block_info(host_buffer, sentinel_hdr_offset);

         expect(sentinel_info.payload_size).toBe(0);
         expect(sentinel_info.is_free).toBe(false);
         expect(sentinel_info.is_prev_free).toBe(true);
         expect(sentinel_info.prev_phys_block_offset).toBe(first_block_hdr_offset);
         expect(sentinel_info.is_last_block).toBe(true);

         const { fli, sli } = mapping_insert(expected_first_block_payload);
         const control = local_allocator.control;

         expect(control.fl_bitmap & (1 << fli)).not.toBe(0);
         expect(control.sl_bitmap[fli]! & (1 << sli)).not.toBe(0);
         expect(control.blocks[fli]![sli]).toBe(first_block_hdr_offset);

         expect(first_block_info.next_free_offset).toBe(NULL_BLOCK_SENTINEL_OFFSET);
         expect(first_block_info.prev_free_offset).toBe(NULL_BLOCK_SENTINEL_OFFSET);
      });

      it('should throw if pool size is too small for overhead and min block', () => {
         const main_test_buffer = new ArrayBuffer(64);
         const too_small_size = TLSF_INTERNAL_OVERHEAD + BLOCK_PAYLOAD_MIN_SIZE - 1;

         expect(() => new TlsfAllocator(main_test_buffer, 0, too_small_size))
            .toThrow(/effective pool payload size/);
      });

      it('should throw if effective pool payload is less than min after alignment/overhead', () => {
         const test_size = TLSF_INTERNAL_OVERHEAD + (BLOCK_PAYLOAD_MIN_SIZE - 1);
         const main_test_buffer = new ArrayBuffer(test_size + POOL_OFFSET);

         expect(() => new TlsfAllocator(main_test_buffer, POOL_OFFSET, test_size))
            .toThrow(/effective pool payload size/);
      });
   });

   describe('allocate', () => {
      let allocator: TlsfAllocator;
      let main_buffer: ArrayBufferLike;
      let control: TlsfAllocator['control'];
      let current_initial_usable_payload: number;

      beforeEach(() => {
         const env = setup_allocator_env(DEFAULT_POOL_SIZE);

         allocator = env.allocator;
         main_buffer = env.buffer;
         control = allocator.control;
         current_initial_usable_payload = env.initial_usable_payload;
      });

      it('should return GLOBAL_NULL_POINTER for allocation of 0 bytes', () => {
         expect(allocator.allocate(0)).toBe(GLOBAL_NULL_POINTER);
      });

      it('should allocate a block of BLOCK_PAYLOAD_MIN_SIZE correctly', () => {
         const size_to_alloc = BLOCK_PAYLOAD_MIN_SIZE;
         const user_ptr = allocator.allocate(size_to_alloc);
         expect(user_ptr).not.toBe(GLOBAL_NULL_POINTER);

         const block_hdr = block_header_from_user_ptr(user_ptr);
         const block_info = get_block_info(main_buffer, block_hdr);

         expect(block_info.payload_size).toBe(size_to_alloc);
         expect(block_info.is_free).toBe(false);

         const remainder_hdr = block_hdr + MINIMAL_BLOCK_HEADER_SIZE + size_to_alloc;
         const pool_end_offset = allocator.region_end_offset_in_buffer;

         if (remainder_hdr < pool_end_offset - MINIMAL_BLOCK_HEADER_SIZE) {
            const remainder_info = get_block_info(main_buffer, remainder_hdr);
            expect(remainder_info.is_free).toBe(true);
            expect(remainder_info.is_prev_free).toBe(false);

            const { fli, sli } = mapping_insert(remainder_info.payload_size);
            expect(control.blocks[fli]![sli]).toBe(remainder_hdr);
         }
      });

      it('should allocate multiple blocks correctly', () => {
         const size1 = 32;
         const size2 = 64;

         const ptr1 = allocator.allocate(size1);
         expect(ptr1).not.toBe(GLOBAL_NULL_POINTER);
         const hdr1 = block_header_from_user_ptr(ptr1);
         const info1 = get_block_info(main_buffer, hdr1);
         expect(info1.payload_size).toBe(Math.max(size1, BLOCK_PAYLOAD_MIN_SIZE));
         expect(info1.is_free).toBe(false);

         const ptr2 = allocator.allocate(size2);
         expect(ptr2).not.toBe(GLOBAL_NULL_POINTER);
         const hdr2 = block_header_from_user_ptr(ptr2);
         const info2 = get_block_info(main_buffer, hdr2);
         expect(info2.payload_size).toBe(Math.max(size2, BLOCK_PAYLOAD_MIN_SIZE));
         expect(info2.is_free).toBe(false);
         expect(info2.is_prev_free).toBe(false);

         expect(hdr2).toBe(hdr1 + MINIMAL_BLOCK_HEADER_SIZE + info1.payload_size);
      });

      it('should throw if no suitable block is found (oom)', () => {
         const first_alloc_size = 992;
         allocator.allocate(first_alloc_size);
         expect(() => allocator.allocate(BLOCK_PAYLOAD_MIN_SIZE)).toThrow(/failed to allocate .* OUT OF MEMORY!/);
      });

      it('should split a larger free block and return the trimmed part', () => {
         const initial_pool_size_custom = 512;
         const { allocator: local_allocator, buffer: local_buffer, initial_usable_payload: local_initial_usable_payload } = setup_allocator_env(initial_pool_size_custom);
         const local_control = local_allocator.control;

         const alloc_size = 64;
         const user_ptr = local_allocator.allocate(alloc_size);
         expect(user_ptr).not.toBe(GLOBAL_NULL_POINTER);

         const block_hdr = block_header_from_user_ptr(user_ptr);
         const block_info = get_block_info(local_buffer, block_hdr);
         expect(block_info.payload_size).toBe(alloc_size);
         expect(block_info.is_free).toBe(false);

         const remainder_hdr = block_hdr + MINIMAL_BLOCK_HEADER_SIZE + alloc_size;
         const remainder_info = get_block_info(local_buffer, remainder_hdr);
         const expected_remainder_payload = local_initial_usable_payload - alloc_size - MINIMAL_BLOCK_HEADER_SIZE;
         expect(remainder_info.is_free).toBe(true);
         expect(remainder_info.payload_size).toBe(expected_remainder_payload);
         expect(remainder_info.is_prev_free).toBe(false);

         const { fli, sli } = mapping_insert(expected_remainder_payload);
         expect(local_control.blocks[fli]![sli]).toBe(remainder_hdr);
      });

      it('should allocate the entire usable space if requested (minus sentinel)', () => {
         const pool_size_custom = 128;
         const { allocator: local_allocator, buffer: local_buffer, initial_usable_payload: local_initial_usable_payload } = setup_allocator_env(pool_size_custom);
         const local_control = local_allocator.control;

         const user_ptr = local_allocator.allocate(local_initial_usable_payload);
         expect(user_ptr).not.toBe(GLOBAL_NULL_POINTER);

         const block_hdr = block_header_from_user_ptr(user_ptr);
         const block_info = get_block_info(local_buffer, block_hdr);
         expect(block_info.payload_size).toBe(local_initial_usable_payload);
         expect(block_info.is_free).toBe(false);

         const next_hdr = block_hdr + MINIMAL_BLOCK_HEADER_SIZE + local_initial_usable_payload;
         const next_info = get_block_info(local_buffer, next_hdr);
         expect(next_info.is_last_block).toBe(true);
         expect(next_info.payload_size).toBe(0);
         expect(next_info.is_prev_free).toBe(false);
         expect(local_control.fl_bitmap).toBe(0);
      });
   });

   describe('free', () => {
      let allocator: TlsfAllocator;
      let main_buffer: ArrayBufferLike;
      let control: TlsfAllocator['control'];
      let current_initial_usable_payload: number;

      beforeEach(() => {
         const env = setup_allocator_env(DEFAULT_POOL_SIZE);

         allocator = env.allocator;
         main_buffer = env.buffer;
         control = allocator.control;
         current_initial_usable_payload = env.initial_usable_payload;
      });

      it('should do nothing if freeing a null/zero pointer (GLOBAL_NULL_POINTER)', () => {
         const control_before_json = JSON.stringify(control);
         allocator.free(GLOBAL_NULL_POINTER);
         const control_after_json = JSON.stringify(control);
         expect(control_after_json).toBe(control_before_json);
      });

      it('should free a simple allocated block and coalesce with the initial remainder', () => {
         const alloc_size = 64;
         const user_ptr = allocator.allocate(alloc_size);
         const block_hdr = block_header_from_user_ptr(user_ptr);

         allocator.free(user_ptr);

         const block_info = get_block_info(main_buffer, block_hdr);
         expect(block_info.is_free).toBe(true);
         const expected_merged_size = current_initial_usable_payload;
         expect(block_info.payload_size).toBe(expected_merged_size);
         const { fli, sli } = mapping_insert(expected_merged_size);
         expect(control.blocks[fli]![sli]).toBe(block_hdr);
      });

      it('should coalesce with next free block (which is the initial large remainder)', () => {
         const size1 = 32;
         const ptr1 = allocator.allocate(size1);
         const hdr1 = block_header_from_user_ptr(ptr1);

         allocator.free(ptr1);

         const merged_block_info = get_block_info(main_buffer, hdr1);
         expect(merged_block_info.is_free).toBe(true);
         const expected_merged_size = current_initial_usable_payload;
         expect(merged_block_info.payload_size).toBe(expected_merged_size);
         const { fli, sli } = mapping_insert(expected_merged_size);
         expect(control.blocks[fli]![sli]).toBe(hdr1);
      });

      it('should coalesce with previous and next free blocks correctly', () => {
         const size1 = 32;
         const size2 = 48;
         const size3 = 64;

         const ptr_a = allocator.allocate(size1);
         const hdr_a = block_header_from_user_ptr(ptr_a);
         const ptr_b = allocator.allocate(size2);
         const ptr_c = allocator.allocate(size3);

         allocator.free(ptr_a);
         allocator.free(ptr_c);
         allocator.free(ptr_b);

         const final_block_info = get_block_info(main_buffer, hdr_a);
         expect(final_block_info.is_free).toBe(true);
         expect(final_block_info.payload_size).toBe(current_initial_usable_payload);
         const { fli, sli } = mapping_insert(current_initial_usable_payload);
         expect(control.blocks[fli]![sli]).toBe(hdr_a);
      });

      it('should coalesce with both previous and next free blocks (a-b-c merge, b is freed last)', () => {
         const size_alloc = 32;
         const ptr_a = allocator.allocate(size_alloc);
         const hdr_a = block_header_from_user_ptr(ptr_a);
         const ptr_b = allocator.allocate(size_alloc);
         const ptr_c = allocator.allocate(size_alloc);

         allocator.free(ptr_a);
         allocator.free(ptr_c);
         allocator.free(ptr_b);

         const final_merged_block_info = get_block_info(main_buffer, hdr_a);
         expect(final_merged_block_info.is_free).toBe(true);
         expect(final_merged_block_info.payload_size).toBe(current_initial_usable_payload);
         const { fli, sli } = mapping_insert(current_initial_usable_payload);
         expect(control.blocks[fli]![sli]).toBe(hdr_a);
      });
   });

   describe('complex scenarios and edge cases', () => {
      it('allocate all memory, free all, then allocate again', () => {
         const { allocator, buffer, initial_usable_payload: test_usable_payload } = setup_allocator_env(DEFAULT_POOL_SIZE);
         const control = allocator.control;

         const test_alloc_size = 992;
         const ptr1 = allocator.allocate(test_alloc_size);
         const hdr1_info = get_block_info(buffer, block_header_from_user_ptr(ptr1));
         expect(hdr1_info.payload_size).toBe(test_usable_payload);
         expect(ptr1).not.toBe(GLOBAL_NULL_POINTER);
         expect(control.fl_bitmap).toBe(0);

         allocator.free(ptr1);
         expect(control.fl_bitmap).not.toBe(0);

         const half_size = Math.floor(test_usable_payload / 2);
         const ptr2 = allocator.allocate(half_size);
         expect(ptr2).not.toBe(GLOBAL_NULL_POINTER);
         const info2 = get_block_info(buffer, block_header_from_user_ptr(ptr2));
         const adjusted_half_size = adjust_request_size(half_size, ALIGN_SIZE);
         expect(info2.payload_size).toBe(adjusted_half_size);
      });

      it('fragmentation, coalescing, and re-allocation', () => {
         const custom_pool_size = 512;
         const { allocator, buffer, initial_usable_payload: current_test_usable_payload } = setup_allocator_env(custom_pool_size);

         const p1_size = 32;
         const p2_size = 64;
         const p3_size = 32;
         const p4_size = 128;

         const p1 = allocator.allocate(p1_size);
         const p2 = allocator.allocate(p2_size);
         const p3 = allocator.allocate(p3_size);
         const p4 = allocator.allocate(p4_size);

         expect(p1).not.toBe(GLOBAL_NULL_POINTER);
         expect(p2).not.toBe(GLOBAL_NULL_POINTER);
         expect(p3).not.toBe(GLOBAL_NULL_POINTER);
         expect(p4).not.toBe(GLOBAL_NULL_POINTER);

         allocator.free(p2);
         const info_B_after_free = get_block_info(buffer, block_header_from_user_ptr(p2));
         expect(info_B_after_free.is_free).toBe(true);
         expect(info_B_after_free.payload_size).toBe(p2_size);

         allocator.free(p4);
         const hdr_D = block_header_from_user_ptr(p4);
         const info_D_merged = get_block_info(buffer, hdr_D);
         expect(info_D_merged.is_free).toBe(true);

         let calculated_remainder_payload = current_test_usable_payload;
         calculated_remainder_payload -= (adjust_request_size(p1_size, ALIGN_SIZE) + MINIMAL_BLOCK_HEADER_SIZE);
         calculated_remainder_payload -= (adjust_request_size(p2_size, ALIGN_SIZE) + MINIMAL_BLOCK_HEADER_SIZE);
         calculated_remainder_payload -= (adjust_request_size(p3_size, ALIGN_SIZE) + MINIMAL_BLOCK_HEADER_SIZE);
         calculated_remainder_payload -= (adjust_request_size(p4_size, ALIGN_SIZE) + MINIMAL_BLOCK_HEADER_SIZE);
         const remainder_payload_after_all_allocs = calculated_remainder_payload;

         const expected_DR_size = adjust_request_size(p4_size, ALIGN_SIZE) + MINIMAL_BLOCK_HEADER_SIZE + remainder_payload_after_all_allocs;
         expect(info_D_merged.payload_size).toBe(expected_DR_size);


         const p5_size = 60;
         const adjusted_p5_size = adjust_request_size(p5_size, ALIGN_SIZE);
         const p5 = allocator.allocate(p5_size);
         expect(p5).toBe(p2);

         const p5_block_info = get_block_info(buffer, block_header_from_user_ptr(p5));

         if (block_can_split(buffer, block_header_from_user_ptr(p5), adjusted_p5_size)) {
            expect(p5_block_info.payload_size).toBe(adjusted_p5_size);
         } else {
            expect(p5_block_info.payload_size).toBe(p2_size);
         }

         const p6_size = 100;
         const adjusted_p6_size = adjust_request_size(p6_size, ALIGN_SIZE);
         const p6 = allocator.allocate(p6_size);
         expect(p6).toBe(p4);

         const p6_block_info = get_block_info(buffer, block_header_from_user_ptr(p6));
         expect(p6_block_info.payload_size).toBe(adjusted_p6_size);

         allocator.free(p1);
         allocator.free(p3);
         allocator.free(p5);

         const hdr_A = block_header_from_user_ptr(p1);
         const info_ABC_merged = get_block_info(buffer, hdr_A);
         expect(info_ABC_merged.is_free).toBe(true);

         const p5_actual_size = get_block_info(buffer, block_header_from_user_ptr(p5)).payload_size;

         const expected_ABC_merged_size =
            adjust_request_size(p1_size, ALIGN_SIZE) + MINIMAL_BLOCK_HEADER_SIZE
            + p5_actual_size + MINIMAL_BLOCK_HEADER_SIZE
            + adjust_request_size(p3_size, ALIGN_SIZE);

         expect(info_ABC_merged.payload_size).toBe(expected_ABC_merged_size);

         allocator.free(p6);

         const p8 = allocator.allocate(info_ABC_merged.payload_size);
         expect(p8).toBe(p1);
         expect(get_block_info(buffer, block_header_from_user_ptr(p8)).payload_size).toBe(expected_ABC_merged_size);
      });
   });

   describe('reallocate', () => {
      let allocator: TlsfAllocator;
      let main_buffer: ArrayBufferLike;

      beforeEach(() => {
         ({ allocator, buffer: main_buffer } = setup_allocator_env(DEFAULT_POOL_SIZE));
      });

      it('should behave like allocate if old_ptr is 0', () => {
         const size = 64;
         const ptr = allocator.reallocate(GLOBAL_NULL_POINTER, size);
         expect(ptr).not.toBe(GLOBAL_NULL_POINTER);

         const block_info = get_block_info(main_buffer, block_header_from_user_ptr(ptr));
         const expected_size = adjust_request_size(size, ALIGN_SIZE);
         expect(block_info.payload_size).toBe(expected_size);
         expect(block_info.is_free).toBe(false);
      });

      it('should behave like free if new_size is 0', () => {
         const ptr1 = allocator.allocate(64);
         expect(ptr1).not.toBe(GLOBAL_NULL_POINTER);

         const block_hdr1 = block_header_from_user_ptr(ptr1);
         const ptr2 = allocator.reallocate(ptr1, 0);
         expect(ptr2).toBe(GLOBAL_NULL_POINTER);
         expect(block_is_free(main_buffer, block_hdr1)).toBe(true);
      });

      it('should return the same pointer if new_size results in same adjusted size', () => {
         const size = 60;
         const ptr1 = allocator.allocate(size);
         expect(ptr1).not.toBe(GLOBAL_NULL_POINTER);

         const payload_ptr1 = get_block_info(main_buffer, block_header_from_user_ptr(ptr1)).payload_size;
         const ptr2 = allocator.reallocate(ptr1, size);
         expect(ptr2).toBe(ptr1);
         expect(get_block_info(main_buffer, block_header_from_user_ptr(ptr2)).payload_size).toBe(payload_ptr1);
      });

      it('should grow an allocation (alloc-copy-free path when next block is used)', () => {
         const initial_size = 32;
         const obstacle_size = BLOCK_PAYLOAD_MIN_SIZE;

         const ptr1 = allocator.allocate(initial_size);
         expect(ptr1).not.toBe(GLOBAL_NULL_POINTER);
         const ptr1_actual_payload = get_block_info(main_buffer, block_header_from_user_ptr(ptr1)).payload_size;

         const view = new DataView(main_buffer);

         for (let i = 0; i < initial_size; i += 4) {
            view.setUint32(ptr1 + i, 0xDEADBEE0 + i, true);
         }

         const ptr_obstacle = allocator.allocate(obstacle_size);
         expect(ptr_obstacle).not.toBe(GLOBAL_NULL_POINTER);

         const ptr1_hdr = block_header_from_user_ptr(ptr1);
         expect(block_header_from_user_ptr(ptr_obstacle))
            .toBe(ptr1_hdr + MINIMAL_BLOCK_HEADER_SIZE + ptr1_actual_payload);

         const new_size = 128;
         const adjusted_new_size = adjust_request_size(new_size, ALIGN_SIZE);
         const ptr2 = allocator.reallocate(ptr1, new_size);
         expect(ptr2).not.toBe(GLOBAL_NULL_POINTER);
         expect(ptr2).not.toBe(ptr1);

         const info2 = get_block_info(main_buffer, block_header_from_user_ptr(ptr2));
         expect(info2.payload_size).toBe(adjusted_new_size);
         expect(info2.is_free).toBe(false);

         for (let i = 0; i < initial_size; i += 4) {
            expect(view.getUint32(ptr2 + i, true)).toBe(0xDEADBEE0 + i);
         }

         expect(block_is_free(main_buffer, block_header_from_user_ptr(ptr1))).toBe(true);

         allocator.free(ptr_obstacle);
      });

      it('should grow an allocation in place by merging with the next free block', () => {
         const initial_size = 32;
         const ptr1 = allocator.allocate(initial_size);
         expect(ptr1).not.toBe(GLOBAL_NULL_POINTER);

         const ptr1_hdr = block_header_from_user_ptr(ptr1);
         const ptr1_actual_payload = get_block_info(main_buffer, ptr1_hdr).payload_size;

         const view = new DataView(main_buffer);
         for (let i = 0; i < initial_size; i += 4) {
            view.setUint32(ptr1 + i, 0xFEEDBEEF + i, true);
         }

         const next_block_hdr_initial = ptr1_hdr + MINIMAL_BLOCK_HEADER_SIZE + ptr1_actual_payload;
         const next_block_initial_info = get_block_info(main_buffer, next_block_hdr_initial);
         expect(next_block_initial_info.is_free).toBe(true);
         expect(next_block_initial_info.is_last_block).toBe(false);

         const new_size = 128;
         const adjusted_new_size = adjust_request_size(new_size, ALIGN_SIZE);
         const required_additional_payload = adjusted_new_size - ptr1_actual_payload;
         const available_from_next_for_payload = MINIMAL_BLOCK_HEADER_SIZE + next_block_initial_info.payload_size;

         if (available_from_next_for_payload < required_additional_payload) {
            default_logger.info('', `skipping 'grow by merge' test part: next free block not large enough. required additional: ${required_additional_payload}, available from next: ${available_from_next_for_payload}`);

            const ptr2_fallback = allocator.reallocate(ptr1, new_size);
            expect(ptr2_fallback).not.toBe(GLOBAL_NULL_POINTER);
            expect(ptr2_fallback).not.toBe(ptr1);

            return;
         }

         const ptr2 = allocator.reallocate(ptr1, new_size);
         expect(ptr2).not.toBe(GLOBAL_NULL_POINTER);
         expect(ptr2).toBe(ptr1);

         const info2 = get_block_info(main_buffer, block_header_from_user_ptr(ptr2));
         expect(info2.payload_size).toBe(adjusted_new_size);
         expect(info2.is_free).toBe(false);

         for (let i = 0; i < initial_size; i += 4) {
            expect(view.getUint32(ptr2 + i, true)).toBe(0xFEEDBEEF + i);
         }

         const remainder_hdr_after_ptr2 = block_header_from_user_ptr(ptr2) + MINIMAL_BLOCK_HEADER_SIZE + info2.payload_size;
         const pool_end_offset = allocator.region_end_offset_in_buffer;

         if (
            remainder_hdr_after_ptr2 < pool_end_offset - MINIMAL_BLOCK_HEADER_SIZE
            && !block_is_last(main_buffer, remainder_hdr_after_ptr2)
         ) {
            const remainder_info_after_ptr2 = get_block_info(main_buffer, remainder_hdr_after_ptr2);

            expect(remainder_info_after_ptr2.is_free).toBe(true);
         }
      });

      it('should shrink an allocation using block_trim_used if possible', () => {
         const initial_size = 128;
         const ptr1 = allocator.allocate(initial_size);
         expect(ptr1).not.toBe(GLOBAL_NULL_POINTER);

         const view = new DataView(main_buffer);

         for (let i = 0; i < 64; i += 4) {
            view.setUint32(ptr1 + i, 0xCAFEBABE + i, true);
         }

         const new_size = 64;
         const adjusted_new_size = adjust_request_size(new_size, ALIGN_SIZE);
         const can_split_for_trim = block_can_split(main_buffer, block_header_from_user_ptr(ptr1), adjusted_new_size);
         const ptr2 = allocator.reallocate(ptr1, new_size);
         expect(ptr2).not.toBe(GLOBAL_NULL_POINTER);

         const info2 = get_block_info(main_buffer, block_header_from_user_ptr(ptr2));

         if (can_split_for_trim) {
            expect(ptr2).toBe(ptr1);
            expect(info2.payload_size).toBe(adjusted_new_size);
            expect(info2.is_free).toBe(false);

            const remainder_hdr = block_header_from_user_ptr(ptr2) + MINIMAL_BLOCK_HEADER_SIZE + adjusted_new_size;

            const pool_end_offset = allocator.region_end_offset_in_buffer;

            if (
               remainder_hdr < pool_end_offset - MINIMAL_BLOCK_HEADER_SIZE
               && !block_is_last(main_buffer, remainder_hdr)
            ) {
               const remainder_info = get_block_info(main_buffer, remainder_hdr);

               expect(remainder_info.is_free).toBe(true);
            }
         } else {
            expect(ptr2).not.toBe(ptr1);
            expect(info2.payload_size).toBe(adjusted_new_size);
            expect(info2.is_free).toBe(false);
            expect(block_is_free(main_buffer, block_header_from_user_ptr(ptr1))).toBe(true);
         }

         for (let i = 0; i < new_size; i += 4) {
            expect(view.getUint32(ptr2 + i, true)).toBe(0xCAFEBABE + i);
         }
      });

      it('should throw if reallocation fails due to oom, leaving original block intact', () => {
         const size1_req = Math.floor(DEFAULT_POOL_SIZE / 2);
         const ptr1 = allocator.allocate(size1_req);
         expect(ptr1).not.toBe(GLOBAL_NULL_POINTER);

         const size1_actual = get_block_info(main_buffer, block_header_from_user_ptr(ptr1)).payload_size;

         const view = new DataView(main_buffer);
         view.setUint32(ptr1, 0xABCD, true);

         expect(() => allocator.reallocate(ptr1, DEFAULT_POOL_SIZE)).toThrow(/failed to allocate .* OUT OF MEMORY!/);

         const info1_after_fail = get_block_info(main_buffer, block_header_from_user_ptr(ptr1));
         expect(info1_after_fail.is_free).toBe(false);
         expect(info1_after_fail.payload_size).toBe(size1_actual);
         expect(view.getUint32(ptr1, true)).toBe(0xABCD);
      });

      it('reallocate a block to be very small, potentially smaller than BLOCK_PAYLOAD_MIN_SIZE request', () => {
         const ptr1 = allocator.allocate(100);
         expect(ptr1).not.toBe(GLOBAL_NULL_POINTER);

         const view = new DataView(main_buffer);
         view.setUint32(ptr1, 0x1234, true);
         view.setUint32(ptr1 + 4, 0x5678, true);

         const new_requested_size = 4;
         const expected_final_size = BLOCK_PAYLOAD_MIN_SIZE;

         const ptr2 = allocator.reallocate(ptr1, new_requested_size);
         expect(ptr2).not.toBe(GLOBAL_NULL_POINTER);

         const info2 = get_block_info(main_buffer, block_header_from_user_ptr(ptr2));
         expect(info2.payload_size).toBe(expected_final_size);
         expect(view.getUint32(ptr2, true)).toBe(0x1234);

         if (ptr1 !== ptr2) {
            expect(block_is_free(main_buffer, block_header_from_user_ptr(ptr1))).toBe(true);
         }
      });
   });
});