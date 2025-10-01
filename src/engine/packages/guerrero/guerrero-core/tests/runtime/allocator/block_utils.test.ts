/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/tests/runtime/allocator/block_utils.test.ts
 */

import { describe, expect, it } from 'bun:test';

import type { Pointer } from '@eldritch-engine/type-utils/guerrero/index';

import {
   block_set_payload_size,
   block_get_payload_size,
   block_is_free,
   block_set_free,
   block_set_used,
   block_is_prev_free,
   block_set_prev_free,
   block_set_prev_used,
   block_is_last,
   block_header_from_user_ptr,
   block_user_ptr_from_header,
   block_set_next_free_offset,
   block_get_next_free_offset,
   block_set_prev_free_offset,
   block_get_prev_free_offset,
   block_set_prev_phys_block_offset,
   block_get_prev_phys_block_offset,
   block_next_header_offset,
   block_prev_header_offset,
   block_link_next,
   block_mark_as_free,
   block_mark_as_used,
   align_up,
   adjust_request_size,
   block_can_split,
   block_split,
   block_absorb,
   align_ptr,
   align_down
} from '@self/runtime/allocator/block_utils';

import {
   OFFSET_SIZE,
   BLOCK_HEADER_FREE_BIT,
   BLOCK_HEADER_PREV_FREE_BIT,
   BLOCK_USER_PTR_TO_HEADER_OFFSET,
   MINIMAL_BLOCK_HEADER_SIZE,
   ALIGN_SIZE,
   BLOCK_PAYLOAD_MIN_SIZE,
   MIN_PHYSICAL_BLOCK_SIZE,
   POINTER_SIZE,
   SIZE_T_SIZE,
   BLOCK_PAYLOAD_MAX_SIZE,
   LITTLE_ENDIAN
} from '@self/runtime/allocator/constants';

function create_test_env(size: number = 256): {
   buffer: ArrayBuffer,
   view: DataView
} {
   const buffer = new ArrayBuffer(size);
   const view = new DataView(buffer);

   return { buffer, view };
}

describe('tlsf block utilities', () => {
   describe('size and status bit manipulation', () => {
      it('should set and get payload size correctly, preserving flags', () => {
         const { buffer, view } = create_test_env();

         const block_header_offset: Pointer = 0;
         const payload_size = 128;

         view.setUint32(block_header_offset + OFFSET_SIZE, BLOCK_HEADER_FREE_BIT | BLOCK_HEADER_PREV_FREE_BIT, LITTLE_ENDIAN);
         block_set_payload_size(buffer, block_header_offset, payload_size);

         let current_size_val = view.getUint32(block_header_offset + OFFSET_SIZE, LITTLE_ENDIAN);
         expect(current_size_val).toBe(payload_size | BLOCK_HEADER_FREE_BIT | BLOCK_HEADER_PREV_FREE_BIT);
         expect(block_get_payload_size(buffer, block_header_offset)).toBe(payload_size);

         view.setUint32(block_header_offset + OFFSET_SIZE, payload_size, LITTLE_ENDIAN);
         block_set_payload_size(buffer, block_header_offset, payload_size + 16);

         current_size_val = view.getUint32(block_header_offset + OFFSET_SIZE, LITTLE_ENDIAN);
         expect(current_size_val).toBe(payload_size + 16);
         expect(block_get_payload_size(buffer, block_header_offset)).toBe(payload_size + 16);
      });

      it('should correctly report payload size when all flags are set', () => {
         const { buffer, view } = create_test_env();

         const block_header_offset: Pointer = 10;
         const payload_size = 256;
         const flags = BLOCK_HEADER_FREE_BIT | BLOCK_HEADER_PREV_FREE_BIT;

         view.setUint32(block_header_offset + OFFSET_SIZE, payload_size | flags, LITTLE_ENDIAN);
         expect(block_get_payload_size(buffer, block_header_offset)).toBe(payload_size);
      });


      it('should set and check FREE status bit', () => {
         const { buffer } = create_test_env();

         const block_header_offset: Pointer = 0;

         block_set_payload_size(buffer, block_header_offset, 64);
         expect(block_is_free(buffer, block_header_offset)).toBe(false);

         block_set_free(buffer, block_header_offset);
         expect(block_is_free(buffer, block_header_offset)).toBe(true);
         expect(block_get_payload_size(buffer, block_header_offset)).toBe(64);

         block_set_used(buffer, block_header_offset);
         expect(block_is_free(buffer, block_header_offset)).toBe(false);
         expect(block_get_payload_size(buffer, block_header_offset)).toBe(64);
      });

      it('should set and check PREV_FREE status bit', () => {
         const { buffer } = create_test_env();

         const block_header_offset: Pointer = 0;

         block_set_payload_size(buffer, block_header_offset, 32);
         expect(block_is_prev_free(buffer, block_header_offset)).toBe(false);

         block_set_prev_free(buffer, block_header_offset);
         expect(block_is_prev_free(buffer, block_header_offset)).toBe(true);
         expect(block_get_payload_size(buffer, block_header_offset)).toBe(32);

         block_set_prev_used(buffer, block_header_offset);
         expect(block_is_prev_free(buffer, block_header_offset)).toBe(false);
         expect(block_get_payload_size(buffer, block_header_offset)).toBe(32);
      });

      it('block_is_last should identify sentinel blocks (payload size 0)', () => {
         const { buffer } = create_test_env();

         const block1_hdr: Pointer = 0;
         const block2_hdr: Pointer = 32;

         block_set_payload_size(buffer, block1_hdr, 0);
         block_set_payload_size(buffer, block2_hdr, 16);
         expect(block_is_last(buffer, block1_hdr)).toBe(true);
         expect(block_is_last(buffer, block2_hdr)).toBe(false);
      });
   });

   describe('pointer conversions', () => {
      it('should convert between user pointer and block header offset correctly', () => {
         const user_ptr: Pointer = 100;
         const expected_header_offset = user_ptr - BLOCK_USER_PTR_TO_HEADER_OFFSET;

         expect(block_header_from_user_ptr(user_ptr)).toBe(expected_header_offset);
         expect(block_user_ptr_from_header(expected_header_offset)).toBe(user_ptr);
         expect(block_user_ptr_from_header(block_header_from_user_ptr(user_ptr))).toBe(user_ptr);
      });

      it('should handle zero offset for pointer conversions', () => {
         const user_ptr_zero: Pointer = BLOCK_USER_PTR_TO_HEADER_OFFSET;

         expect(block_header_from_user_ptr(user_ptr_zero)).toBe(0);
         expect(block_user_ptr_from_header(0)).toBe(user_ptr_zero);
      });
   });

   describe('free List pointer manipulation (for free blocks)', () => {
      it('should set and get next_free_offset', () => {
         const { buffer } = create_test_env();

         const block_header_offset: Pointer = POINTER_SIZE + SIZE_T_SIZE;
         const next_free: Pointer = 0xABCD;

         block_set_next_free_offset(buffer, block_header_offset, next_free);
         expect(block_get_next_free_offset(buffer, block_header_offset)).toBe(next_free);
      });

      it('should set and get prev_free_offset', () => {
         const { buffer } = create_test_env();

         const block_header_offset: Pointer = 0;
         const prev_free: Pointer = 0x1234;

         block_set_prev_free_offset(buffer, block_header_offset, prev_free);
         expect(block_get_prev_free_offset(buffer, block_header_offset)).toBe(prev_free);
      });
   });

   describe('physical block navigation and linking', () => {
      it('should set and get prev_phys_block_offset', () => {
         const { buffer } = create_test_env();

         const block_header_offset: Pointer = MINIMAL_BLOCK_HEADER_SIZE + 64;
         const prev_phys_block_hdr: Pointer = 16;

         block_set_prev_phys_block_offset(buffer, block_header_offset, prev_phys_block_hdr);
         expect(block_get_prev_phys_block_offset(buffer, block_header_offset)).toBe(prev_phys_block_hdr);
      });

      it('block_next_header_offset should calculate offset of the next physical block', () => {
         const { buffer } = create_test_env();

         const current_block_hdr: Pointer = 16;
         const payload_size = 64;

         block_set_payload_size(buffer, current_block_hdr, payload_size);
         const expected_next_hdr = current_block_hdr + MINIMAL_BLOCK_HEADER_SIZE + payload_size;
         expect(block_next_header_offset(buffer, current_block_hdr)).toBe(expected_next_hdr);
      });

      it('block_prev_header_offset should return prev_phys_block_offset if prev is free', () => {
         const { buffer } = create_test_env();

         const prev_block_hdr: Pointer = 0;
         const current_block_hdr: Pointer = MINIMAL_BLOCK_HEADER_SIZE + 64;

         block_set_prev_phys_block_offset(buffer, current_block_hdr, prev_block_hdr);
         block_set_prev_free(buffer, current_block_hdr);
         expect(block_prev_header_offset(buffer, current_block_hdr)).toBe(prev_block_hdr);
      });

      it('block_prev_header_offset should throw if prev block is not free', () => {
         const { buffer } = create_test_env();

         const current_block_hdr: Pointer = MINIMAL_BLOCK_HEADER_SIZE + 64;

         block_set_prev_used(buffer, current_block_hdr);
         expect(() => block_prev_header_offset(buffer, current_block_hdr))
            .toThrow(/previous block must be free/);
      });


      it('block_link_next should set prev_phys_block_offset on the next block', () => {
         const { buffer } = create_test_env();

         const current_block_hdr: Pointer = 0;
         const payload_size = 64;

         block_set_payload_size(buffer, current_block_hdr, payload_size);

         const next_block_hdr_actual = block_link_next(buffer, current_block_hdr);
         const expected_next_hdr = current_block_hdr + MINIMAL_BLOCK_HEADER_SIZE + payload_size;
         expect(next_block_hdr_actual).toBe(expected_next_hdr);
         expect(block_get_prev_phys_block_offset(buffer, next_block_hdr_actual)).toBe(current_block_hdr);
      });

      it('block_mark_as_free should set flags and link', () => {
         const { buffer } = create_test_env();

         const block_to_free_hdr: Pointer = 0;
         const payload_size = 64;

         block_set_payload_size(buffer, block_to_free_hdr, payload_size);

         const next_block_initial_offset = block_to_free_hdr + MINIMAL_BLOCK_HEADER_SIZE + payload_size;
         block_set_prev_phys_block_offset(buffer, next_block_initial_offset, 9999);
         block_mark_as_free(buffer, block_to_free_hdr);
         expect(block_is_free(buffer, block_to_free_hdr)).toBe(true);

         const next_block_hdr = block_next_header_offset(buffer, block_to_free_hdr);
         expect(block_is_prev_free(buffer, next_block_hdr)).toBe(true);
         expect(block_get_prev_phys_block_offset(buffer, next_block_hdr)).toBe(block_to_free_hdr);
      });

      it('block_mark_as_used should set flags and update next', () => {
         const { buffer } = create_test_env();

         const block_to_use_hdr: Pointer = 0;
         const payload_size = 128;
         block_set_payload_size(buffer, block_to_use_hdr, payload_size);
         block_set_free(buffer, block_to_use_hdr);

         const next_block_hdr = block_next_header_offset(buffer, block_to_use_hdr);
         block_set_prev_free(buffer, next_block_hdr);
         block_mark_as_used(buffer, block_to_use_hdr);
         expect(block_is_free(buffer, block_to_use_hdr)).toBe(false);
         expect(block_is_prev_free(buffer, next_block_hdr)).toBe(false);
      });

      it('block_mark_as_free when next block is sentinel', () => {
         const { buffer } = create_test_env(128);

         const block_hdr: Pointer = 0;
         const payload_size = 32;
         block_set_payload_size(buffer, block_hdr, payload_size);

         const sentinel_hdr = block_next_header_offset(buffer, block_hdr);
         block_set_payload_size(buffer, sentinel_hdr, 0);
         block_set_prev_phys_block_offset(buffer, sentinel_hdr, block_hdr);
         block_set_prev_used(buffer, sentinel_hdr);

         block_mark_as_free(buffer, block_hdr);
         expect(block_is_free(buffer, block_hdr)).toBe(true);
         expect(block_is_prev_free(buffer, sentinel_hdr)).toBe(true);
         expect(block_get_prev_phys_block_offset(buffer, sentinel_hdr)).toBe(block_hdr);
      });

   });

   describe('alignment utilities', () => {
      it('align_up should work correctly for various values and alignments', () => {
         expect(align_up(0, 4)).toBe(0);
         expect(align_up(1, 4)).toBe(4);
         expect(align_up(4, 4)).toBe(4);
         expect(align_up(7, 4)).toBe(8);
         expect(align_up(8, 4)).toBe(8);
         expect(align_up(9, 4)).toBe(12);
         expect(align_up(12, ALIGN_SIZE)).toBe(16);
         expect(align_up(13, ALIGN_SIZE)).toBe(16);
         expect(align_up(15, 8)).toBe(16);
         expect(align_up(16, 8)).toBe(16);

         expect(() => align_up(7, 3)).toThrow('alignment must be a power of two and non-zero');
         expect(() => align_up(7, 0)).toThrow('alignment must be a power of two and non-zero');
         expect(() => align_up(7, -4)).toThrow('alignment must be a power of two and non-zero');
      });

      it('align_down should work correctly', () => {
         expect(align_down(0, 4)).toBe(0);
         expect(align_down(1, 4)).toBe(0);
         expect(align_down(3, 4)).toBe(0);
         expect(align_down(4, 4)).toBe(4);
         expect(align_down(7, 4)).toBe(4);
         expect(align_down(8, ALIGN_SIZE)).toBe(8);
         expect(align_down(15, 8)).toBe(8);
         expect(align_down(16, 8)).toBe(16);

         expect(() => align_down(7, 3)).toThrow('alignment must be a power of two and non-zero');
         expect(() => align_down(7, 0)).toThrow('alignment must be a power of two and non-zero');
      });

      it('align_ptr should work like align_up', () => {
         expect(align_ptr(7, 4)).toBe(8);
         expect(align_ptr(8, 4)).toBe(8);

         expect(() => align_ptr(7, 3)).toThrow('alignment must be a power of two and non-zero');
      });
   });

   describe('size adjustment', () => {
      it('adjust_request_size should align and enforce minimum payload size', () => {
         expect(adjust_request_size(0, ALIGN_SIZE)).toBe(0);
         expect(adjust_request_size(1, ALIGN_SIZE)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
         expect(adjust_request_size(4, ALIGN_SIZE)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
         expect(adjust_request_size(8, ALIGN_SIZE)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
         expect(adjust_request_size(10, ALIGN_SIZE)).toBe(16);
         expect(adjust_request_size(12, ALIGN_SIZE)).toBe(16);
         expect(adjust_request_size(13, ALIGN_SIZE)).toBe(16);

         expect(adjust_request_size(1, 8)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
         expect(adjust_request_size(9, 8)).toBe(16);
         expect(adjust_request_size(BLOCK_PAYLOAD_MIN_SIZE - 1, ALIGN_SIZE)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
         expect(adjust_request_size(BLOCK_PAYLOAD_MIN_SIZE, ALIGN_SIZE)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
         expect(adjust_request_size(BLOCK_PAYLOAD_MIN_SIZE + 1, ALIGN_SIZE)).toBe(align_up(BLOCK_PAYLOAD_MIN_SIZE + 1, ALIGN_SIZE));
      });

      it('adjust_request_size should handle alignment parameter correctly', () => {
         const custom_align = 16;

         expect(adjust_request_size(1, custom_align)).toBe(custom_align);
         expect(adjust_request_size(10, custom_align)).toBe(custom_align);
         expect(adjust_request_size(17, custom_align)).toBe(32);
      });

      it('adjust_request_size should align and enforce minimum payload size for typical cases', () => {
         expect(adjust_request_size(0, ALIGN_SIZE)).toBe(0);
         expect(adjust_request_size(1, ALIGN_SIZE)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
         expect(adjust_request_size(4, ALIGN_SIZE)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
         expect(adjust_request_size(8, ALIGN_SIZE)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
         expect(adjust_request_size(10, ALIGN_SIZE)).toBe(16);
         expect(adjust_request_size(12, ALIGN_SIZE)).toBe(16);
         expect(adjust_request_size(13, ALIGN_SIZE)).toBe(16);

         expect(adjust_request_size(1, 8)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
         expect(adjust_request_size(9, 8)).toBe(16);
         expect(adjust_request_size(BLOCK_PAYLOAD_MIN_SIZE - 1, ALIGN_SIZE)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
         expect(adjust_request_size(BLOCK_PAYLOAD_MIN_SIZE, ALIGN_SIZE)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
         expect(adjust_request_size(BLOCK_PAYLOAD_MIN_SIZE + 1, ALIGN_SIZE)).toBe(align_up(BLOCK_PAYLOAD_MIN_SIZE + 1, ALIGN_SIZE));
      });

      it('adjust_request_size should handle alignment parameter correctly', () => {
         const custom_align = 16;

         expect(adjust_request_size(1, custom_align)).toBe(custom_align);
         expect(adjust_request_size(10, custom_align)).toBe(custom_align);
         expect(adjust_request_size(17, custom_align)).toBe(32);
      });

      it('adjust_request_size should return 0 if requested size (after alignment) meets or exceeds BLOCK_PAYLOAD_MAX_SIZE', () => {
         expect(adjust_request_size(BLOCK_PAYLOAD_MAX_SIZE, ALIGN_SIZE)).toBe(0);

         if (BLOCK_PAYLOAD_MAX_SIZE > ALIGN_SIZE) {
            expect(adjust_request_size(BLOCK_PAYLOAD_MAX_SIZE - (ALIGN_SIZE - 1), ALIGN_SIZE)).toBe(0);
         }

         expect(adjust_request_size(BLOCK_PAYLOAD_MAX_SIZE + 1, ALIGN_SIZE)).toBe(0);
         expect(adjust_request_size(BLOCK_PAYLOAD_MAX_SIZE + ALIGN_SIZE, ALIGN_SIZE)).toBe(0);

         const size_just_under_max = BLOCK_PAYLOAD_MAX_SIZE - ALIGN_SIZE;

         if (size_just_under_max >= BLOCK_PAYLOAD_MIN_SIZE) {
            expect(adjust_request_size(size_just_under_max, ALIGN_SIZE)).toBe(size_just_under_max);
         } else {
            expect(adjust_request_size(size_just_under_max, ALIGN_SIZE)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
         }

         const slightly_smaller_unaligned = BLOCK_PAYLOAD_MAX_SIZE - (ALIGN_SIZE + 1);

         if (slightly_smaller_unaligned > 0) {
            const expected_aligned_slightly_smaller = align_up(slightly_smaller_unaligned, ALIGN_SIZE);

            if (expected_aligned_slightly_smaller < BLOCK_PAYLOAD_MAX_SIZE) {
               if (expected_aligned_slightly_smaller >= BLOCK_PAYLOAD_MIN_SIZE) {
                  expect(adjust_request_size(slightly_smaller_unaligned, ALIGN_SIZE)).toBe(expected_aligned_slightly_smaller);
               } else {
                  expect(adjust_request_size(slightly_smaller_unaligned, ALIGN_SIZE)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
               }
            } else {
               expect(adjust_request_size(slightly_smaller_unaligned, ALIGN_SIZE)).toBe(0);
            }
         }
      });
   });

   describe('block splitting and merging', () => {
      it('block_can_split identifies if a block can be split', () => {
         const { buffer } = create_test_env(512);

         const block_hdr = 0;
         const request_payload_size = 32;

         block_set_payload_size(buffer, block_hdr, 47);
         expect(block_can_split(buffer, block_hdr, request_payload_size)).toBe(false);

         block_set_payload_size(buffer, block_hdr, request_payload_size + MIN_PHYSICAL_BLOCK_SIZE);
         expect(block_can_split(buffer, block_hdr, request_payload_size)).toBe(true);

         block_set_payload_size(buffer, block_hdr, 100);
         expect(block_can_split(buffer, block_hdr, request_payload_size)).toBe(true);
      });

      it('block_can_split should handle edge case for remainder being exactly MIN_PAYLOAD_SIZE', () => {
         const { buffer } = create_test_env(512);

         const block_hdr = 0;
         const request_payload_size = 64;
         const current_payload_size = request_payload_size + MINIMAL_BLOCK_HEADER_SIZE + BLOCK_PAYLOAD_MIN_SIZE;

         block_set_payload_size(buffer, block_hdr, current_payload_size);
         expect(block_can_split(buffer, block_hdr, request_payload_size)).toBe(true);

         block_set_payload_size(buffer, block_hdr, current_payload_size - 1);
         expect(block_can_split(buffer, block_hdr, request_payload_size)).toBe(false);
      });


      it('block_split should split a block correctly', () => {
         const { buffer } = create_test_env(512);

         const original_block_hdr = 0;
         const original_payload_size = 100;
         const request_payload_size = 32;

         block_set_payload_size(buffer, original_block_hdr, original_payload_size);

         const remainder_block_hdr = block_split(buffer, original_block_hdr, request_payload_size);
         expect(block_get_payload_size(buffer, original_block_hdr)).toBe(request_payload_size);

         const expected_remainder_hdr_offset = original_block_hdr + MINIMAL_BLOCK_HEADER_SIZE + request_payload_size;
         expect(remainder_block_hdr).toBe(expected_remainder_hdr_offset);

         const expected_remainder_payload_size = original_payload_size - request_payload_size - MINIMAL_BLOCK_HEADER_SIZE;
         expect(block_get_payload_size(buffer, remainder_block_hdr)).toBe(expected_remainder_payload_size);
         expect(block_is_free(buffer, remainder_block_hdr)).toBe(true);

         const block_after_remainder_hdr = block_next_header_offset(buffer, remainder_block_hdr);
         expect(block_get_prev_phys_block_offset(buffer, block_after_remainder_hdr)).toBe(remainder_block_hdr);
         expect(block_is_prev_free(buffer, block_after_remainder_hdr)).toBe(true);
         expect(block_next_header_offset(buffer, original_block_hdr)).toBe(remainder_block_hdr);
      });

      it('block_split where remainder is exactly minimum valid size', () => {
         const { buffer } = create_test_env(512);

         const original_block_hdr = 0;
         const request_payload_size = 60;
         const original_payload_size = request_payload_size + MINIMAL_BLOCK_HEADER_SIZE + BLOCK_PAYLOAD_MIN_SIZE;

         block_set_payload_size(buffer, original_block_hdr, original_payload_size);

         const remainder_block_hdr = block_split(buffer, original_block_hdr, request_payload_size);
         expect(block_get_payload_size(buffer, original_block_hdr)).toBe(request_payload_size);
         expect(block_get_payload_size(buffer, remainder_block_hdr)).toBe(BLOCK_PAYLOAD_MIN_SIZE);
         expect(block_is_free(buffer, remainder_block_hdr)).toBe(true);
      });

      it('block_split should throw if resulting remainder is too small (defensive, pre-checked by block_can_split)', () => {
         const { buffer } = create_test_env(512);

         const original_block_hdr = 0;
         const original_payload_size = MINIMAL_BLOCK_HEADER_SIZE + BLOCK_PAYLOAD_MIN_SIZE - 1 + 32;
         const request_payload_size = 32;

         block_set_payload_size(buffer, original_block_hdr, original_payload_size);

         expect(() => block_split(buffer, original_block_hdr, request_payload_size))
            .toThrow(/invalid remaining_payload_size/);
      });


      it('block_absorb should merge next block into previous block', () => {
         const { buffer } = create_test_env(512);

         const prev_block_hdr = 0;
         const prev_payload_size = 60;

         block_set_payload_size(buffer, prev_block_hdr, prev_payload_size);
         block_set_free(buffer, prev_block_hdr);
         block_set_prev_used(buffer, prev_block_hdr);

         const block_to_absorb_hdr = block_next_header_offset(buffer, prev_block_hdr);
         const to_absorb_payload_size = 40;
         block_set_payload_size(buffer, block_to_absorb_hdr, to_absorb_payload_size);
         block_set_prev_phys_block_offset(buffer, block_to_absorb_hdr, prev_block_hdr);

         const after_absorbed_hdr = block_next_header_offset(buffer, block_to_absorb_hdr);
         block_set_payload_size(buffer, after_absorbed_hdr, 20);
         block_set_prev_phys_block_offset(buffer, after_absorbed_hdr, block_to_absorb_hdr);

         const result_block_hdr = block_absorb(buffer, prev_block_hdr, block_to_absorb_hdr);
         expect(result_block_hdr).toBe(prev_block_hdr);

         const expected_new_prev_payload_size = prev_payload_size + MINIMAL_BLOCK_HEADER_SIZE + to_absorb_payload_size;
         expect(block_get_payload_size(buffer, prev_block_hdr)).toBe(expected_new_prev_payload_size);
         expect(block_is_free(buffer, prev_block_hdr)).toBe(true);
         expect(block_is_prev_free(buffer, prev_block_hdr)).toBe(false);
         expect(block_get_prev_phys_block_offset(buffer, after_absorbed_hdr)).toBe(prev_block_hdr);
         expect(block_next_header_offset(buffer, prev_block_hdr)).toBe(after_absorbed_hdr);
      });

      it('block_absorb where absorbed block is minimum payload size', () => {
         const { buffer } = create_test_env(512);

         const prev_block_hdr = 16;
         const prev_payload_size = 32;
         block_set_payload_size(buffer, prev_block_hdr, prev_payload_size);

         const block_to_absorb_hdr = block_next_header_offset(buffer, prev_block_hdr);
         const to_absorb_payload_size = BLOCK_PAYLOAD_MIN_SIZE;
         block_set_payload_size(buffer, block_to_absorb_hdr, to_absorb_payload_size);
         block_set_prev_phys_block_offset(buffer, block_to_absorb_hdr, prev_block_hdr);

         const after_absorbed_hdr = block_next_header_offset(buffer, block_to_absorb_hdr);
         block_set_payload_size(buffer, after_absorbed_hdr, 0);
         block_set_prev_phys_block_offset(buffer, after_absorbed_hdr, block_to_absorb_hdr);

         block_absorb(buffer, prev_block_hdr, block_to_absorb_hdr);
         const expected_new_payload_size = prev_payload_size + MINIMAL_BLOCK_HEADER_SIZE + to_absorb_payload_size;
         expect(block_get_payload_size(buffer, prev_block_hdr)).toBe(expected_new_payload_size);
         expect(block_next_header_offset(buffer, prev_block_hdr)).toBe(after_absorbed_hdr);
      });
   });
});