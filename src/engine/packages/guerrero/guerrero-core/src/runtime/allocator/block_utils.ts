/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/runtime/allocator/block_utils.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { Pointer } from '@eldritch-engine/type-utils/guerrero/index';

import {
   BLOCK_HEADER_FREE_BIT,
   BLOCK_HEADER_PREV_FREE_BIT,
   BLOCK_PAYLOAD_MIN_SIZE,
   OFFSET_NEXT_FREE,
   OFFSET_PREV_FREE,
   OFFSET_PREV_PHYS_BLOCK,
   OFFSET_SIZE,
   BLOCK_USER_PTR_TO_HEADER_OFFSET,
   MINIMAL_BLOCK_HEADER_SIZE,
   BLOCK_PAYLOAD_MAX_SIZE,
   LITTLE_ENDIAN,
   MAX_UINT32,
   NULL_BLOCK_SENTINEL_OFFSET,
   BLOCK_HEADER_FULL_SIZE,
   FL_INDEX_COUNT,
   SL_INDEX_COUNT,
} from '@self/runtime/allocator/constants';

import { tlsf_ffs } from '@self/runtime/allocator/bit_utils';
import { mapping_insert, mapping_search } from '@self/runtime/allocator/mapping';

import type { TlsfControl, TlsfStatistics } from '@self/runtime/allocator/types';

/** */
export function block_get_prev_phys_block_offset(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer
): Pointer {
   const view = new DataView(buffer);

   return view.getUint32(block_header_offset + OFFSET_PREV_PHYS_BLOCK, LITTLE_ENDIAN);
}

/** */
export function block_set_prev_phys_block_offset(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer,
   prev_block_header_offset: Pointer
): void {
   const view = new DataView(buffer);

   view.setUint32(block_header_offset + OFFSET_PREV_PHYS_BLOCK, prev_block_header_offset, LITTLE_ENDIAN);
}

/** */
export function block_get_size_raw(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer
): number {
   const view = new DataView(buffer);

   return view.getUint32(block_header_offset + OFFSET_SIZE, LITTLE_ENDIAN);
}

/** */
export function block_set_size_raw(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer,
   size_with_flags: number
): void {
   const view = new DataView(buffer);

   view.setUint32(block_header_offset + OFFSET_SIZE, size_with_flags, LITTLE_ENDIAN);
}

/** */
export function block_get_payload_size(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer
): number {
   return block_get_size_raw(buffer, block_header_offset) & ~(BLOCK_HEADER_FREE_BIT | BLOCK_HEADER_PREV_FREE_BIT);
}

/** */
export function block_set_payload_size(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer,
   new_payload_size: number
): void {
   const old_size_with_flags = block_get_size_raw(buffer, block_header_offset);
   const flags = old_size_with_flags & (BLOCK_HEADER_FREE_BIT | BLOCK_HEADER_PREV_FREE_BIT);

   block_set_size_raw(buffer, block_header_offset, new_payload_size | flags);
}

/** */
export function block_is_free(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer
): boolean {
   return (block_get_size_raw(buffer, block_header_offset) & BLOCK_HEADER_FREE_BIT) !== 0;
}

/** */
export function block_set_free(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer
): void {
   block_set_size_raw(buffer, block_header_offset, block_get_size_raw(buffer, block_header_offset) | BLOCK_HEADER_FREE_BIT);
}

/** */
export function block_set_used(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer
): void {
   block_set_size_raw(buffer, block_header_offset, block_get_size_raw(buffer, block_header_offset) & ~BLOCK_HEADER_FREE_BIT);
}

/** */
export function block_is_prev_free(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer
): boolean {
   return (block_get_size_raw(buffer, block_header_offset) & BLOCK_HEADER_PREV_FREE_BIT) !== 0;
}

/** */
export function block_set_prev_free(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer
): void {
   block_set_size_raw(buffer, block_header_offset, block_get_size_raw(buffer, block_header_offset) | BLOCK_HEADER_PREV_FREE_BIT);
}

/** */
export function block_set_prev_used(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer
): void {
   block_set_size_raw(buffer, block_header_offset, block_get_size_raw(buffer, block_header_offset) & ~BLOCK_HEADER_PREV_FREE_BIT);
}

/** */
export function block_get_next_free_offset(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer
): Pointer {
   const view = new DataView(buffer);
   const offset_val = view.getUint32(block_header_offset + OFFSET_NEXT_FREE, LITTLE_ENDIAN);

   return offset_val === MAX_UINT32 ? NULL_BLOCK_SENTINEL_OFFSET : offset_val;
}

/** */
export function block_set_next_free_offset(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer,
   next_free_header_offset: Pointer
): void {
   const view = new DataView(buffer);
   const value_to_store = next_free_header_offset === NULL_BLOCK_SENTINEL_OFFSET ? MAX_UINT32 : next_free_header_offset;

   view.setUint32(block_header_offset + OFFSET_NEXT_FREE, value_to_store, LITTLE_ENDIAN);
}

/** */
export function block_get_prev_free_offset(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer
): Pointer {
   const view = new DataView(buffer);
   const offset_val = view.getUint32(block_header_offset + OFFSET_PREV_FREE, LITTLE_ENDIAN);

   return offset_val === MAX_UINT32 ? NULL_BLOCK_SENTINEL_OFFSET : offset_val;
}

/** */
export function block_set_prev_free_offset(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer,
   prev_free_header_offset: Pointer
): void {
   const view = new DataView(buffer);
   const value_to_store = prev_free_header_offset === NULL_BLOCK_SENTINEL_OFFSET ? MAX_UINT32 : prev_free_header_offset;

   view.setUint32(block_header_offset + OFFSET_PREV_FREE, value_to_store, LITTLE_ENDIAN);
}

/** converts a user pointer (start of usable data area) to the block_header_offset (start of the conceptual block_header_t structure) */
export function block_header_from_user_ptr(
   user_ptr_offset: Pointer
): Pointer {
   return user_ptr_offset - BLOCK_USER_PTR_TO_HEADER_OFFSET;
}

/** converts a block_header_offset to a user pointer */
export function block_user_ptr_from_header(
   block_header_offset: Pointer
): Pointer {
   return block_header_offset + BLOCK_USER_PTR_TO_HEADER_OFFSET;
}

/** if this is the sentinel block at the end of a pool */
export function block_is_last(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer
): boolean {
   return block_get_payload_size(buffer, block_header_offset) === 0;
}

/**
 * assumes the current block is not the last
 * 
 * @returns the offset of the next physical block's header
 */
export function block_next_header_offset(
   buffer: ArrayBufferLike,
   //
   current_block_header_offset: Pointer
): Pointer {
   const payload_size = block_get_payload_size(buffer, current_block_header_offset);

   // the next block starts immediately after the current block's full span
   // full span = header size + payload size
   return current_block_header_offset + MINIMAL_BLOCK_HEADER_SIZE + payload_size;
}

/**
 * assumes `block_is_prev_free` is true for `current_block_header_offset`
 * 
 * @returns the offset of the previous physical block's header
 */
export function block_prev_header_offset(
   buffer: ArrayBufferLike,
   //
   current_block_header_offset: Pointer
): Pointer {
   /// #if SAFETY
   if (!block_is_prev_free(buffer, current_block_header_offset)) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      {
         const message = 'previous block must be free';

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   return block_get_prev_phys_block_offset(buffer, current_block_header_offset);
}

/**
 * links a block to its next physical neighbor by setting the neighbor's `prev_phys_block` pointer
 * 
 * @returns the offset of the next block's header
 */
export function block_link_next(
   buffer: ArrayBufferLike,
   //
   current_block_header_offset: Pointer
): Pointer {
   const next_block_hdr_offset = block_next_header_offset(buffer, current_block_header_offset);

   block_set_prev_phys_block_offset(buffer, next_block_hdr_offset, current_block_header_offset);

   return next_block_hdr_offset;
}

/** marks a block as free and updates the next physical block's `prev_free` bit */
export function block_mark_as_free(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer
): void {
   const next_block_hdr_offset = block_link_next(buffer, block_header_offset);

   block_set_prev_free(buffer, next_block_hdr_offset);
   block_set_free(buffer, block_header_offset);
}

/** marks a block as used and updates the next physical block's `prev_free` bit (setting it to prev_used) */
export function block_mark_as_used(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer
): void {
   const next_block_hdr_offset = block_next_header_offset(buffer, block_header_offset);

   block_set_prev_used(buffer, next_block_hdr_offset); // mark next block's prev as used
   block_set_used(buffer, block_header_offset);        // mark current block as used
}

/** gets the payload size of a block from a user pointer. this is the size the user requested, not including header overhead */
export function block_get_size_from_user_ptr(
   buffer: ArrayBufferLike,
   //
   user_ptr_offset: Pointer
): number {
   const block_header_offset = block_header_from_user_ptr(user_ptr_offset);

   return block_get_payload_size(buffer, block_header_offset);
}

/** */
export function block_search_suitable(
   control: TlsfControl,
   //
   fli_in: number,
   sli_in: number
): {
   block_hdr_offset: Pointer,
   fli_out: number,
   sli_out: number
} {
   let fl = fli_in;
   let sl = sli_in;

   let sl_map = control.sl_bitmap[fl]! & (~0 << sl);

   if (sl_map === 0) {
      const fl_map = control.fl_bitmap & (~0 << (fl + 1));

      if (fl_map === 0) {
         return {
            block_hdr_offset: NULL_BLOCK_SENTINEL_OFFSET,
            fli_out: fl,
            sli_out: sl
         };
      }

      fl = tlsf_ffs(fl_map);
      sl_map = control.sl_bitmap[fl]!;
   }

   /// #if SAFETY
   if (sl_map === 0) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      {
         const message = `consistency error: sl_map is zero for fl_index ${fl} which should be active in fl_bitmap (${control.fl_bitmap.toString(2)})`;

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   sl = tlsf_ffs(sl_map);

   return {
      block_hdr_offset: control.blocks[fl]![sl]!,
      fli_out: fl,
      sli_out: sl
   };
}

/** */
export function block_remove_free(
   buffer: ArrayBufferLike,
   //
   control: TlsfControl,
   //
   block_hdr_offset: Pointer,
   fl: number,
   sl: number
): void {
   const prev_free_hdr_offset = block_get_prev_free_offset(buffer, block_hdr_offset);
   const next_free_hdr_offset = block_get_next_free_offset(buffer, block_hdr_offset);

   if (next_free_hdr_offset !== NULL_BLOCK_SENTINEL_OFFSET) {
      block_set_prev_free_offset(buffer, next_free_hdr_offset, prev_free_hdr_offset);
   }

   if (prev_free_hdr_offset !== NULL_BLOCK_SENTINEL_OFFSET) {
      block_set_next_free_offset(buffer, prev_free_hdr_offset, next_free_hdr_offset);
   }

   if (control.blocks[fl]![sl] === block_hdr_offset) {
      control.blocks[fl]![sl] = next_free_hdr_offset;

      if (next_free_hdr_offset === NULL_BLOCK_SENTINEL_OFFSET) {
         control.sl_bitmap[fl]! &= ~(1 << sl);

         if (control.sl_bitmap[fl] === 0) {
            control.fl_bitmap &= ~(1 << fl);
         }
      }
   }
}

/** */
export function block_insert_free(
   buffer: ArrayBufferLike,
   //
   control: TlsfControl,
   //
   block_hdr_offset: Pointer,
   fl: number,
   sl: number
): void {
   const current_head_hdr_offset = control.blocks[fl]![sl]!;

   block_set_next_free_offset(buffer, block_hdr_offset, current_head_hdr_offset);
   block_set_prev_free_offset(buffer, block_hdr_offset, NULL_BLOCK_SENTINEL_OFFSET);

   if (current_head_hdr_offset !== NULL_BLOCK_SENTINEL_OFFSET) {
      block_set_prev_free_offset(buffer, current_head_hdr_offset, block_hdr_offset);
   }

   control.blocks[fl]![sl] = block_hdr_offset;
   control.fl_bitmap |= (1 << fl);
   control.sl_bitmap[fl]! |= (1 << sl);
}

/** */
export function block_remove(
   buffer: ArrayBufferLike,
   //
   control: TlsfControl,
   statistics: TlsfStatistics | undefined,
   //
   block_hdr_offset: Pointer
): void {
   const payload_size = block_get_payload_size(buffer, block_hdr_offset);
   const { fli, sli } = mapping_insert(payload_size);

   block_remove_free(
      buffer,
      control,
      //
      block_hdr_offset,
      fli,
      sli
   );

   /// #if TLSF_STATS
   statistics!.payload_bytes_free -= payload_size;
   statistics!.overhead_bytes_free -= BLOCK_HEADER_FULL_SIZE;
   statistics!.num_free_blocks_active--;
   /// #endif
}

/** */
export function block_insert(
   buffer: ArrayBufferLike,
   //
   control: TlsfControl,
   statistics: TlsfStatistics | undefined,
   //
   block_hdr_offset: Pointer
): void {
   const payload_size = block_get_payload_size(buffer, block_hdr_offset);
   const { fli, sli } = mapping_insert(payload_size);

   block_insert_free(
      buffer,
      control,
      //
      block_hdr_offset,
      fli,
      sli
   );

   /// #if TLSF_STATS
   statistics!.payload_bytes_free += payload_size;
   statistics!.overhead_bytes_free += BLOCK_HEADER_FULL_SIZE;
   statistics!.num_free_blocks_active++;
   /// #endif
}

/** */
export function block_merge_prev(
   buffer: ArrayBufferLike,
   //
   control: TlsfControl,
   statistics: TlsfStatistics | undefined,
   //
   current_block_hdr_offset: Pointer
): Pointer {
   if (block_is_prev_free(buffer, current_block_hdr_offset)) {
      const prev_block_hdr_offset = block_prev_header_offset(buffer, current_block_hdr_offset);

      block_remove(
         buffer,
         control,
         statistics,
         //
         prev_block_hdr_offset
      );

      return block_absorb(buffer, prev_block_hdr_offset, current_block_hdr_offset);
   }

   return current_block_hdr_offset;
}

/** */
export function block_merge_next(
   buffer: ArrayBufferLike,
   //
   control: TlsfControl,
   statistics: TlsfStatistics | undefined,
   //
   region_end_offset_in_buffer: Pointer,
   //
   current_block_hdr_offset: Pointer
): Pointer {
   const next_block_hdr_offset = block_next_header_offset(buffer, current_block_hdr_offset);

   if (next_block_hdr_offset >= region_end_offset_in_buffer) {
      return current_block_hdr_offset;
   }

   if (block_is_last(buffer, next_block_hdr_offset)) {
      return current_block_hdr_offset;
   }

   if (block_is_free(buffer, next_block_hdr_offset)) {
      block_remove(
         buffer,
         control,
         statistics,
         //
         next_block_hdr_offset
      );

      return block_absorb(buffer, current_block_hdr_offset, next_block_hdr_offset);
   }

   return current_block_hdr_offset;
}

/** */
export function block_trim_free(
   buffer: ArrayBufferLike,
   //
   control: TlsfControl,
   statistics: TlsfStatistics | undefined,
   //
   block_to_trim_hdr_offset: Pointer,
   requested_payload_size: number
): void {
   /// #if SAFETY
   const logger = default_logger.get_namespaced_logger('<namespace>');

   if (!block_is_free(buffer, block_to_trim_hdr_offset)) {
      const message = `!!! block_trim_free called on a non-free block (header=${block_to_trim_hdr_offset}), consistency error!!!`;

      logger.critical(message);
      throw new Error(message);
   }
   /// #endif

   if (block_can_split(buffer, block_to_trim_hdr_offset, requested_payload_size)) {
      const original_payload_size = block_get_payload_size(buffer, block_to_trim_hdr_offset);
      const { fli: original_fli, sli: original_sli } = mapping_insert(original_payload_size);

      block_remove_free(
         buffer,
         control,
         //
         block_to_trim_hdr_offset,
         original_fli,
         original_sli
      );

      const remaining_block_hdr_offset = block_split(buffer, block_to_trim_hdr_offset, requested_payload_size);

      block_insert(
         buffer,
         control,
         statistics,
         //
         block_to_trim_hdr_offset
      );

      block_insert(
         buffer,
         control,
         statistics,
         //
         remaining_block_hdr_offset
      );
   }
}

/** */
export function block_trim_used(
   buffer: ArrayBufferLike,
   //
   control: TlsfControl,
   statistics: TlsfStatistics | undefined,
   //
   region_end_offset_in_buffer: Pointer,
   //
   block_to_trim_hdr_offset: Pointer,
   requested_payload_size: number
): void {
   /// #if SAFETY
   const logger = default_logger.get_namespaced_logger('<namespace>');

   if (block_is_free(buffer, block_to_trim_hdr_offset)) {
      const message = `!!! block_trim_used called on a free block (header=${block_to_trim_hdr_offset}), consistency error!!!`;

      logger.critical(message);
      throw new Error(message);
   }
   /// #endif

   if (block_can_split(buffer, block_to_trim_hdr_offset, requested_payload_size)) {
      let remaining_block_hdr_offset = block_split(buffer, block_to_trim_hdr_offset, requested_payload_size);

      remaining_block_hdr_offset = block_merge_next(
         buffer,
         control,
         statistics,
         //
         region_end_offset_in_buffer,
         //
         remaining_block_hdr_offset
      );

      block_insert(
         buffer,
         control,
         statistics,
         //
         remaining_block_hdr_offset
      );
   }
}

/** */
export function block_locate_free(
   buffer: ArrayBufferLike,
   //
   control: TlsfControl,
   statistics: TlsfStatistics | undefined,
   //
   requested_payload_size: number
): Pointer {
   const mapping = mapping_search(requested_payload_size);

   let fl = mapping.fli;
   let sl = mapping.sli;

   if (fl >= FL_INDEX_COUNT) {
      return NULL_BLOCK_SENTINEL_OFFSET;
   }

   if (sl >= SL_INDEX_COUNT) {
      fl++; sl = 0;

      if (fl >= FL_INDEX_COUNT) {
         return NULL_BLOCK_SENTINEL_OFFSET;
      }
   }

   const search_result = block_search_suitable(control, fl, sl);
   const found_block_hdr_offset = search_result.block_hdr_offset;

   if (found_block_hdr_offset !== NULL_BLOCK_SENTINEL_OFFSET) {
      /// #if SAFETY
      const logger = default_logger.get_namespaced_logger('<namespace>');

      if (block_get_payload_size(buffer, found_block_hdr_offset) < requested_payload_size) {
         const message = `!!! located block is smaller than requested. found=${block_get_payload_size(buffer, found_block_hdr_offset)}, requested_payload_size=${requested_payload_size}, consistency error!!!`;

         logger.critical(message);
         throw new Error(message);
      }
      /// #endif

      block_remove(
         buffer,
         control,
         statistics,
         //
         found_block_hdr_offset
      );

      return found_block_hdr_offset;
   }

   return NULL_BLOCK_SENTINEL_OFFSET;
}

/** */
export function block_prepare_used(
   buffer: ArrayBufferLike,
   //
   control: TlsfControl,
   statistics: TlsfStatistics | undefined,
   //
   region_end_offset_in_buffer: Pointer,
   //
   block_hdr_offset: Pointer,
   requested_payload_size: number
): Pointer {
   /// #if SAFETY
   const logger = default_logger.get_namespaced_logger('<namespace>');

   if (
      block_hdr_offset === NULL_BLOCK_SENTINEL_OFFSET
      || requested_payload_size === 0
   ) {
      const message = 'invalid input to block_prepare_used';

      logger.critical(message);
      throw new Error(message);
   }
   /// #endif

   if (block_can_split(buffer, block_hdr_offset, requested_payload_size)) {
      const remaining_block_hdr_offset = block_split(buffer, block_hdr_offset, requested_payload_size);

      block_set_prev_used(buffer, remaining_block_hdr_offset);

      const merged_remainder_hdr = block_merge_next(
         buffer,
         control,
         statistics,
         //
         region_end_offset_in_buffer,
         //
         remaining_block_hdr_offset
      );

      block_insert(
         buffer,
         control,
         statistics,
         //
         merged_remainder_hdr
      );
   }

   block_mark_as_used(buffer, block_hdr_offset);

   return block_user_ptr_from_header(block_hdr_offset);
}

/**
 * checks if a block can be split to accommodate a request of `size` bytes for the first part's payload
 * 
 * the remaining part must be large enough to be a valid block (i.e., hold its own full header)
 */
export function block_can_split(
   buffer: ArrayBufferLike,
   //
   block_header_offset: Pointer,
   request_payload_size: number
): boolean {
   const current_payload_size = block_get_payload_size(buffer, block_header_offset);

   return current_payload_size >= MINIMAL_BLOCK_HEADER_SIZE + BLOCK_PAYLOAD_MIN_SIZE + request_payload_size;
}

/** */
export function block_split(
   buffer: ArrayBufferLike,
   //
   original_block_header_offset: Pointer,
   request_payload_size: number,
): Pointer {
   const original_payload_size = block_get_payload_size(buffer, original_block_header_offset);
   const original_block_is_free = block_is_free(buffer, original_block_header_offset);

   const remaining_block_header_offset = original_block_header_offset + MINIMAL_BLOCK_HEADER_SIZE + request_payload_size;
   const remaining_payload_size = original_payload_size - request_payload_size - MINIMAL_BLOCK_HEADER_SIZE;

   /// #if SAFETY
   if (remaining_payload_size < BLOCK_PAYLOAD_MIN_SIZE) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      {
         const message = `invalid remaining_payload_size: ${remaining_payload_size}. must be >= ${BLOCK_PAYLOAD_MIN_SIZE}. this should be caught by block_can_split`;
         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   block_set_payload_size(buffer, remaining_block_header_offset, remaining_payload_size);

   if (original_block_is_free) {
      block_set_prev_free(buffer, remaining_block_header_offset);
   } else {
      block_set_prev_used(buffer, remaining_block_header_offset);
   }

   block_set_payload_size(buffer, original_block_header_offset, request_payload_size);
   block_mark_as_free(buffer, remaining_block_header_offset);

   return remaining_block_header_offset;
}

/** */
export function block_absorb(
   buffer: ArrayBufferLike,
   //
   prev_block_header_offset: Pointer,
   block_to_absorb_header_offset: Pointer,
): Pointer {
   const prev_payload_size = block_get_payload_size(buffer, prev_block_header_offset);
   const to_absorb_payload_size = block_get_payload_size(buffer, block_to_absorb_header_offset);
   const new_prev_payload_size = prev_payload_size + MINIMAL_BLOCK_HEADER_SIZE + to_absorb_payload_size;

   block_set_payload_size(buffer, prev_block_header_offset, new_prev_payload_size);
   block_link_next(buffer, prev_block_header_offset);

   return prev_block_header_offset;
}

/**
 * rounds a value up to the next multiple of alignment
 * 
 * alignment must be a power of two
 *
 * @param value - the value to align
 * @param alignment - the alignment value (must be a power of two and non-zero)
 * 
 * @throws if alignment is not a power of two or is zero
 */
export function align_up(
   val: number,
   align: number
): number {
   /// #if SAFETY
   if (
      (align & (align - 1)) !== 0
      || align === 0
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      {
         const message = 'alignment must be a power of two and non-zero';

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   return (val + (align - 1)) & ~(align - 1);
}

/** */
export function align_down(
   val: number,
   align: number
): number {
   /// #if SAFETY
   if (
      (align & (align - 1)) !== 0
      || align === 0
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      {
         const message = 'alignment must be a power of two and non-zero';

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   return val - (val & (align - 1));
}

/** */
export function align_ptr(
   ptr_offset: Pointer,
   align: number
): Pointer {
   /// #if SAFETY
   if (
      (align & (align - 1)) !== 0
      || align === 0
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      {
         const message = 'alignment must be a power of two and non-zero';

         logger.critical(message);
         throw new Error(message);
      }
   }
   /// #endif

   return (ptr_offset + (align - 1)) & ~(align - 1);
}

/**
 * adjusts a requested size to be aligned and meet minimum block payload size
 * 
 * @returns 0 if the size is invalid or too large
 */
export function adjust_request_size(
   size: number,
   align: number
): number {
   if (size === 0) {
      return 0;
   }

   let aligned_size = 0;

   if (size > 0) {
      aligned_size = align_up(size, align);
   }

   if (aligned_size >= BLOCK_PAYLOAD_MAX_SIZE) {
      return 0;
   }

   return Math.max(aligned_size, BLOCK_PAYLOAD_MIN_SIZE);
}