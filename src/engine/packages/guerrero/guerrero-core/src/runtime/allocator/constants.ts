/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/runtime/allocator/constants.ts
 */

import type { Pointer } from '@eldritch-engine/type-utils/guerrero/index';

/** the tlsf implementation version */
export const TLSF_VERSION = '4.0';

/**
 * log2 of the number of sub-divisions for each power-of-two size class
 *
 * this constant determines the granularity of block sizes
 *
 * a higher value creates more, smaller subdivisions, reducing internal fragmentation at the cost of increased memory overhead for the allocator's control structure (specifically `sl_bitmap` and `blocks`)
 *
 * a value of 5 is a common and well-balanced choice from the original tlsf implementation, resulting in 2^5 = 32 subdivisions
 *
 * trade-offs:
 * - higher value: less wasted space per allocation (lower internal fragmentation), but more memory used by tlsf itself
 * - lower value: more wasted space per allocation, but less memory used by tlsf
 */
export const SL_INDEX_COUNT_LOG2 = 5;

/**
 * log2 of the base alignment for all allocations
 *
 * all allocation pointers and block sizes will be multiples of `(1 << ALIGN_SIZE_LOG2)`
 *
 * for modern 64-bit systems and javascript environments where `number` can be a 64-bit float, an 8-byte alignment is standard for performance
 * and correctness, as it accommodates types like `f64` and `u64` (`bigint`) without causing hardware exceptions or performance penalties
 *
 * we use 3, which corresponds to 8-byte alignment (2^3 = 8).
 */
export const ALIGN_SIZE_LOG2 = 3;

/**
 * defines the upper limit on allocation sizes by controlling the number of first-level lists.
 * the maximum supportable allocation size will be `(1 << FL_INDEX_MAX)`.
 *
 * this value must be chosen carefully.
 * 
 * while javascript's `arraybuffer` can be larger, this constant limits the size of a *single* allocation that tlsf can track
 *
 * `30` corresponds to a max allocation size of 2^30 = 1 gibibyte, which is a reasonable upper bound for a single contiguous block in many applications
 *
 * and any higher just completely crashes the entire runtime on bun
 */
export const FL_INDEX_MAX = 30;

/**
 * base alignment for all allocations, in bytes
 *
 * calculated as `2^ALIGN_SIZE_LOG2`
 */
export const ALIGN_SIZE = 1 << ALIGN_SIZE_LOG2;

/**
 * the number of second-level lists per first-level list
 *
 * calculated as `2^SL_INDEX_COUNT_LOG2`
 */
export const SL_INDEX_COUNT = 1 << SL_INDEX_COUNT_LOG2;

/**
 * bit shift to calculate the first-level index (fli) from an allocation size
 */
export const FL_INDEX_SHIFT = SL_INDEX_COUNT_LOG2 + ALIGN_SIZE_LOG2;

/**
 * total number of first-level lists required to cover all allocation sizes up to `FL_INDEX_MAX`
 */
export const FL_INDEX_COUNT = FL_INDEX_MAX - FL_INDEX_SHIFT + 2;

/**
 * size threshold below which all blocks are mapped to the first f-level list (`fli = 0`)
 */
export const SMALL_BLOCK_SIZE = 1 << FL_INDEX_SHIFT;

/**
 * bit in the size field indicating the block is free (lsb: ...001)
 */
export const BLOCK_HEADER_FREE_BIT = 1;

/**
 * bit in the size field indicating the previous physical block is free (second lsb: ...010)
 */
export const BLOCK_HEADER_PREV_FREE_BIT = 2;

/**
 * size of the `size_with_flags` field in the block header, in bytes
 */
export const SIZE_T_SIZE = 4;

/**
 * size of a `pointer` (offset) stored in the block header, in bytes
 */
export const POINTER_SIZE = 4;

/**
 * offset to the `prev_phys_block` field from the block's base offset
 *
 * `block_header_t { pointer prev_phys_block; ... }`
 */
export const OFFSET_PREV_PHYS_BLOCK = 0;

/**
 * offset to the `size_with_flags` field from the block's base offset
 *
 * `block_header_t { ...; size_t size_with_flags; ... }`
 */
export const OFFSET_SIZE = POINTER_SIZE;

/**
 * minimal header size for any block (used or free), containing `prev_phys_block` and `size_with_flags`
 */
export const MINIMAL_BLOCK_HEADER_SIZE = POINTER_SIZE + SIZE_T_SIZE;

/**
 * offset from a block's base to the start of the user-writable data area
 *
 * this accounts for the `MINIMAL_BLOCK_HEADER_SIZE`
 *
 * ```
 *   block_header_offset                      user_ptr_offset
 *   |                                        |
 *   v                                        v
 *   +------------------+-------------------+----------------------------+
 *   | prev_phys_block  | size_with_flags   | user data area (payload)   |
 *   | (pointer_size)   | (size_t_size)     | ...                        |
 *   +------------------+-------------------+----------------------------+
 *   <-------------------------------------->
 *           BLOCK_USER_PTR_TO_HEADER_OFFSET
 * ```
 */
export const BLOCK_USER_PTR_TO_HEADER_OFFSET = MINIMAL_BLOCK_HEADER_SIZE;

/**
 * minimum payload size of a *free* block. it must be large enough to store the free list pointers
 *
 * `sizeof(block_header_t.next_free) + sizeof(block_header_t.prev_free)`
 *
 * the original c implementation also includes `size_t` here, but the pointers are what matter
 */
export const BLOCK_PAYLOAD_MIN_SIZE = POINTER_SIZE + POINTER_SIZE;

/**
 * total size of the full header structure for a *free* block
 *
 * this includes the minimal header plus the free list pointers
 *
 * ```
 *   block_header_offset
 *   |
 *   v
 *   +------------------+-------------------+------------------+------------------+
 *   | prev_phys_block  | size_with_flags   | next_free        | prev_free        |
 *   +------------------+-------------------+------------------+------------------+
 *   <------------------ block_header_full_size ---------------------------------->
 * ```
 */
export const BLOCK_HEADER_FULL_SIZE = MINIMAL_BLOCK_HEADER_SIZE + POINTER_SIZE + POINTER_SIZE;

/**
 * offset to the `next_free` field from a block's base offset (only valid if block is free)
 */
export const OFFSET_NEXT_FREE = MINIMAL_BLOCK_HEADER_SIZE;

/**
 * offset to the `prev_free` field from a block's base offset (only valid if block is free)
 */
export const OFFSET_PREV_FREE = MINIMAL_BLOCK_HEADER_SIZE + POINTER_SIZE;

/**
 * the smallest possible physical block size that can be managed
 *
 * a remaining free block after a split must be at least this large
 *
 * it consists of the minimal header plus the minimum payload required for a free block
 */
export const MIN_PHYSICAL_BLOCK_SIZE = MINIMAL_BLOCK_HEADER_SIZE + BLOCK_PAYLOAD_MIN_SIZE;

/**
 * maximum size of a block's payload that this allocator can handle
 */
export const BLOCK_PAYLOAD_MAX_SIZE = 1 << FL_INDEX_MAX;

/**
 * defines the endianness for multi-byte data access
 */
export const LITTLE_ENDIAN = true;

/**
 * the maximum value for a 32-bit unsigned integer, used for sentinel checks
 */
export const MAX_UINT32 = 0xFFFFFFFF; // 2**32 - 1

/**
 * the canonical null pointer value, representing no allocation or an invalid pointer
 */
export const GLOBAL_NULL_POINTER: Pointer = 0;

/**
 * an internal sentinel value to represent the end of a free list
 */
export const NULL_BLOCK_SENTINEL_OFFSET: Pointer = -1;

/// #if SAFETY
/**
 * asserts that our chosen integer sizes are within a reasonable range
 */
function tlsf_static_assert_size_t_consistency(): void {
   if (
      !(
         SIZE_T_SIZE * 8 >= 32
         && SIZE_T_SIZE * 8 <= 64
      )
   ) {
      throw new Error('static assertion failed: size_t_size * 8 must be between 32 and 64');
   }
}

/**
 * asserts that the number of second-level lists can fit within a 32-bit integer bitmap
 */
function tlsf_static_assert_sl_index_count_fit(): void {
   const SL_BITMAP_TYPE_SIZE_BITS = 32;

   if (!(SL_BITMAP_TYPE_SIZE_BITS >= SL_INDEX_COUNT)) {
      throw new Error('static assertion failed: sl_bitmap_type_size_bits must be >= sl_index_count');
   }
}

/**
 * asserts that the derived `align_size` is consistent with the size of the smallest buckets
 */
function tlsf_static_assert_align_size_derivation(): void {
   if (!(ALIGN_SIZE === SMALL_BLOCK_SIZE / SL_INDEX_COUNT)) {
      throw new Error('static assertion failed: align_size derivation incorrect');
   }
}

/**
 * asserts that our minimum block payload is a multiple of the alignment size
 */
function tlsf_static_assert_min_payload_alignment(): void {
   if (BLOCK_PAYLOAD_MIN_SIZE % ALIGN_SIZE !== 0) {
      throw new Error('static assertion failed: block_payload_min_size must be a multiple of align_size');
   }
}

/**
 * asserts that our minimum physical block is a multiple of the alignment size
 */
function tlsf_static_assert_min_physical_block_alignment(): void {
   if (MIN_PHYSICAL_BLOCK_SIZE % ALIGN_SIZE !== 0) {
      throw new Error('static assertion failed: min_physical_block_size must be a multiple of align_size');
   }
}

/**
 * asserts that the first-level index count is a positive number
 */
function tlsf_static_assert_fl_index_count_positive(): void {
   if (FL_INDEX_COUNT <= 0) {
      throw new Error('static assertion failed: fl_index_count must be positive. check fl_index_max and fl_index_shift');
   }
}

/**
 * asserts that block header offsets are consistent
 */
function tlsf_static_assert_header_offsets(): void {
   if (OFFSET_SIZE !== OFFSET_PREV_PHYS_BLOCK + POINTER_SIZE) {
      throw new Error('static assertion failed: inconsistent header offsets for size');
   }

   if (MINIMAL_BLOCK_HEADER_SIZE !== OFFSET_SIZE + SIZE_T_SIZE) {
      throw new Error('static assertion failed: inconsistent header offsets for minimal_block_header_size');
   }
}

tlsf_static_assert_size_t_consistency();
tlsf_static_assert_sl_index_count_fit();
tlsf_static_assert_align_size_derivation();
tlsf_static_assert_min_payload_alignment();
tlsf_static_assert_min_physical_block_alignment();
tlsf_static_assert_fl_index_count_positive();
tlsf_static_assert_header_offsets();
/// #endif