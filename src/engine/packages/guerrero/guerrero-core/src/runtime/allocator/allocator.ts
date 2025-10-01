/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/runtime/allocator/allocator.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IView, IViewConstructor, Pointer } from '@eldritch-engine/type-utils/guerrero/index';

import {
   ALIGN_SIZE,
   BLOCK_PAYLOAD_MIN_SIZE,
   BLOCK_PAYLOAD_MAX_SIZE,
   MINIMAL_BLOCK_HEADER_SIZE,
   BLOCK_HEADER_FULL_SIZE,
   NULL_BLOCK_SENTINEL_OFFSET,
   GLOBAL_NULL_POINTER,
   FL_INDEX_COUNT,
   SL_INDEX_COUNT,
   BLOCK_USER_PTR_TO_HEADER_OFFSET,
} from '@self/runtime/allocator/constants';

import {
   block_get_payload_size,
   block_set_payload_size,
   block_is_free,
   block_set_free,
   block_set_used,
   block_set_prev_free,
   block_set_prev_used,
   block_header_from_user_ptr,
   block_user_ptr_from_header,
   block_is_last,
   block_next_header_offset,
   block_link_next,
   block_mark_as_free,
   adjust_request_size,
   align_down,
   block_can_split,
   block_absorb,
   block_set_prev_phys_block_offset,
   block_get_size_from_user_ptr,
   block_insert,
   block_prepare_used,
   block_locate_free,
   block_merge_prev,
   block_merge_next,
   block_trim_used,
   block_remove,
} from '@self/runtime/allocator/block_utils';

import type { TlsfControl, TlsfStatistics, TlsfWalker } from '@self/runtime/allocator/types';
import type { AllocationRegistry } from '@self/runtime/allocator/registry';

/** */
export class TlsfAllocator {
   readonly buffer: ArrayBufferLike;
   readonly control: TlsfControl;

   readonly region_start_offset_in_buffer: Pointer;
   readonly region_size_bytes: number;
   readonly region_end_offset_in_buffer: Pointer;

   /// #if TLSF_STATS
   readonly statistics: TlsfStatistics;
   /// #endif

   /// #if SAFETY
   readonly allocation_registry?: AllocationRegistry;
   /// #endif

   //
   //

   /**
    * initializes a new two-level segregated fit (tlsf) memory allocator within a given region of a buffer
    *
    * @param pool_buffer the `ArrayBufferLike` to use for the memory pool
    * @param pool_buffer_offset the byte offset within `pool_buffer` where the pool's managed region should start. defaults to 0
    * @param pool_size_bytes the size of the pool in bytes, starting from `pool_buffer_offset`. if `undefined`, the allocator will use the remainder of the buffer (`pool_buffer.byteLength - pool_buffer_offset`)
    * @param allocation_registry a registry to track allocation ownership and hierarchy. this parameter is only available if `SAFETY` is enabled during compilation
    *
    * @throws if the effective pool size is too small to accommodate the minimum tlsf overhead and at least one minimal block, or if the specified region is out of bounds of the host buffer
    */
   constructor(
      pool_buffer: ArrayBufferLike,
      pool_buffer_offset: Pointer = 0,
      pool_size_bytes?: number,
      /// #if SAFETY
      allocation_registry?: AllocationRegistry
      /// #endif
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      this.buffer = pool_buffer;

      const effective_pool_size = pool_size_bytes ?? (this.buffer.byteLength - pool_buffer_offset);
      const tlsf_internal_pool_overhead = MINIMAL_BLOCK_HEADER_SIZE + BLOCK_HEADER_FULL_SIZE;

      /// #if SAFETY
      if (effective_pool_size <= tlsf_internal_pool_overhead) {
         throw new Error(`pool size ${effective_pool_size} bytes is too small. must be at least ${tlsf_internal_pool_overhead + BLOCK_PAYLOAD_MIN_SIZE}`);
      }
      /// #endif

      /// #if SAFETY
      if (
         pool_buffer_offset < 0
         || pool_buffer_offset + effective_pool_size > this.buffer.byteLength
      ) {
         throw new Error(`pool region [${pool_buffer_offset} - ${pool_buffer_offset + effective_pool_size}) is out of bounds for the provided buffer (length ${this.buffer.byteLength})`);
      }
      /// #endif

      this.region_start_offset_in_buffer = pool_buffer_offset;
      this.region_size_bytes = effective_pool_size;
      this.region_end_offset_in_buffer = pool_buffer_offset + effective_pool_size;

      this.control = TlsfAllocator.control_construct();

      const initial_block_payload_unaligned = effective_pool_size - tlsf_internal_pool_overhead;
      let initial_block_payload_size = align_down(initial_block_payload_unaligned, ALIGN_SIZE);

      if (initial_block_payload_size > BLOCK_PAYLOAD_MAX_SIZE) {
         logger.trace(`calculated initial block payload size ${initial_block_payload_size} (from pool region size ${effective_pool_size}) exceeds BLOCK_PAYLOAD_MAX_SIZE ${BLOCK_PAYLOAD_MAX_SIZE}. this pool might not utilize its full size effectively for single large allocations`);

         initial_block_payload_size = BLOCK_PAYLOAD_MAX_SIZE;
      }

      /// #if SAFETY
      if (initial_block_payload_size < BLOCK_PAYLOAD_MIN_SIZE) {
         throw new Error(`effective pool payload size ${initial_block_payload_size} (from pool region size ${effective_pool_size}) is less than minimum ${BLOCK_PAYLOAD_MIN_SIZE} after alignment and overhead`);
      }
      /// #endif

      /// #if TLSF_STATS
      this.statistics = {
         pool_total_bytes: this.region_size_bytes,
         pool_overhead_bytes: tlsf_internal_pool_overhead,
         payload_bytes_in_use: 0,
         overhead_bytes_in_use: 0,
         total_bytes_in_use: 0,
         payload_bytes_free: 0,        // will be set by block_insert
         overhead_bytes_free: 0,       // will be set by block_insert
         total_bytes_free: 0,          // will be set by block_insert
         num_allocations_active: 0,
         num_free_blocks_active: 0,    // will be set by block_insert
         peak_payload_bytes_in_use: 0,
         peak_num_allocations: 0,
         total_allocate_calls: 0,
         total_free_calls: 0,
         total_reallocate_calls: 0,
         failed_allocate_calls: 0,
         successful_allocate_calls: 0,
         successful_free_calls: 0,
      };
      /// #endif

      /// #if SAFETY
      this.allocation_registry = allocation_registry;
      this.allocation_registry?.clear();
      /// #endif

      const first_block_hdr_offset = this.region_start_offset_in_buffer;

      block_set_payload_size(this.buffer, first_block_hdr_offset, initial_block_payload_size);
      block_set_free(this.buffer, first_block_hdr_offset);
      block_set_prev_used(this.buffer, first_block_hdr_offset);
      block_set_prev_phys_block_offset(this.buffer, first_block_hdr_offset, first_block_hdr_offset);

      block_insert(this.buffer, this.control, this.statistics, first_block_hdr_offset);

      const sentinel_hdr_offset = block_link_next(this.buffer, first_block_hdr_offset);
      block_set_payload_size(this.buffer, sentinel_hdr_offset, 0);
      block_set_used(this.buffer, sentinel_hdr_offset);
      block_set_prev_free(this.buffer, sentinel_hdr_offset);

      /// #if TLSF_STATS
      this.statistics.total_bytes_free = this.statistics.payload_bytes_free + this.statistics.overhead_bytes_free;
      /// #endif

      logger.trace(`initialized tlsf allocator. region: [${pool_buffer_offset}-${pool_buffer_offset + effective_pool_size}). initial free block=${initial_block_payload_size} bytes`);
   }

   //
   //

   /**
    * retrieves the usable payload size of a given allocation
    *
    * @param user_ptr - a pointer (offset) to the user data area, returned by a previous allocation
    * 
    * @returns the size of the allocated payload in bytes, or 0 if the pointer is invalid
    */
   get_allocation_size(
      user_ptr: Pointer
   ): number {
      if (user_ptr === GLOBAL_NULL_POINTER) {
         return 0;
      }

      return block_get_size_from_user_ptr(this.buffer, user_ptr);
   }

   /// #if SAFETY
   /**
    * **this method is only available if SAFETY is enabled during compilation**
    *
    * checks if a given pointer and size describe a valid, active memory range within the allocator's pool
    * 
    * this is a powerful debugging tool to detect:
    * - use-after-free errors
    * - buffer overflows / over-reads
    * - reads/writes to completely invalid or unmanaged pointers
    *
    * @param user_ptr - the starting pointer (offset) of the memory range
    * @param size - the size of the memory range in bytes
    *
    * @returns if the entire range [`user_ptr`, `user_ptr + size`) is contained within a single, active allocation
    */
   is_valid_memory_range(
      user_ptr: Pointer,
      size: number
   ): boolean {
      if (user_ptr === GLOBAL_NULL_POINTER) {
         // a null pointer is valid only if the access size is 0
         return size === 0;
      }

      // if the pointer is within the allocator's managed region at all
      if (
         user_ptr < this.region_start_offset_in_buffer + BLOCK_USER_PTR_TO_HEADER_OFFSET
         || user_ptr >= this.region_end_offset_in_buffer
      ) {
         return false;
      }

      const block_hdr_offset = block_header_from_user_ptr(user_ptr);

      // check if the calculated block header is within bounds
      if (
         block_hdr_offset < this.region_start_offset_in_buffer
         || block_hdr_offset >= this.region_end_offset_in_buffer
      ) {
         return false;
      }

      // use-after-free
      if (block_is_free(this.buffer, block_hdr_offset)) {
         return false;
      }

      // buffer overflow/over-read
      const actual_payload_size = block_get_payload_size(this.buffer, block_hdr_offset);

      if (size > actual_payload_size) {
         return false;
      }

      return true;
   }
   /// #endif

   /// #if TLSF_STATS
   /**
    * **this method is only available if TLSF_STATS is enabled during compilation**
    * 
    * retrieves a read-only snapshot of the current allocator statistics
    */
   get_statistics(): Readonly<TlsfStatistics> {
      return {
         ...this.statistics
      };
   }

   /**
    * **this method is only available if TLSF_STATS is enabled during compilation**
    * 
    * iterates through all physical blocks in the memory pool and calls the provided walker function for each one
    *
    * this is a powerful debugging tool to inspect the state of the memory pool
    *
    * @param walker - a callback function that receives information about each block
    * @param user_data - an optional value to pass to each invocation of the walker function
    */
   walk_pool(
      walker: TlsfWalker,
      user_data?: unknown
   ): void {
      let current_block_hdr = this.region_start_offset_in_buffer;

      while (
         current_block_hdr < this.region_end_offset_in_buffer
         && !block_is_last(this.buffer, current_block_hdr)
      ) {
         const user_ptr = block_user_ptr_from_header(current_block_hdr);
         const payload_size = block_get_payload_size(this.buffer, current_block_hdr);
         const is_used = !block_is_free(this.buffer, current_block_hdr);

         walker(
            {
               ptr: user_ptr,
               size: payload_size,
               used: is_used,
               block_header_offset: current_block_hdr,
            },
            user_data
         );

         current_block_hdr = block_next_header_offset(this.buffer, current_block_hdr);
      }
   }
   /// #endif

   /** */
   static control_construct(): TlsfControl {
      const control: TlsfControl = {
         block_null_next_free: NULL_BLOCK_SENTINEL_OFFSET,
         block_null_prev_free: NULL_BLOCK_SENTINEL_OFFSET,
         fl_bitmap: 0,
         sl_bitmap: new Uint32Array(FL_INDEX_COUNT),
         blocks: [],
      };

      for (let i = 0; i < FL_INDEX_COUNT; ++i) {
         control.blocks[i] = [];

         for (let j = 0; j < SL_INDEX_COUNT; ++j) {
            control.blocks[i]![j] = control.block_null_next_free;
         }
      }

      return control;
   }

   /**
    * allocates a block of memory of at least `size` bytes
    *
    * @param size - the number of bytes to allocate
    * @param owner - the constructor of the `IView` that will manage this memory
    * @param parent_ptr - the pointer to the parent allocation that is requesting this new allocation
    *
    * @returns a `Pointer` (offset) to the start of the allocated user data area, or `GLOBAL_NULL_POINTER` on failure
    */
   allocate(
      size: number,
      owner?: IViewConstructor<IView>,
      parent_ptr?: Pointer
   ): Pointer {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      /// #if TLSF_STATS
      this.statistics.total_allocate_calls++;
      /// #endif

      const adjusted_size = adjust_request_size(size, ALIGN_SIZE);

      logger.trace(`ALLOCATE(size=${size}, adjusted=${adjusted_size})`);

      if (adjusted_size === 0) {
         logger.trace(`allocate request for size ${size} resulted in adjusted size 0. returning null ptr`);

         /// #if TLSF_STATS
         this.statistics.failed_allocate_calls++;
         /// #endif

         return GLOBAL_NULL_POINTER;
      }

      const block_hdr_offset = block_locate_free(this.buffer, this.control, this.statistics, adjusted_size);

      if (block_hdr_offset !== NULL_BLOCK_SENTINEL_OFFSET) {
         const user_ptr = block_prepare_used(this.buffer, this.control, this.statistics, this.region_end_offset_in_buffer, block_hdr_offset, adjusted_size);

         if (
            user_ptr !== 0 &&
            user_ptr !== GLOBAL_NULL_POINTER
         ) {
            const payload = new Uint8Array(this.buffer, user_ptr, adjusted_size);
            payload.fill(0);

            logger.trace(`   -> SUCCESSFUL. ptr=${user_ptr}`);

            /// #if SAFETY
            if (
               owner
               && this.allocation_registry
            ) {
               this.allocation_registry.register(user_ptr, owner, parent_ptr);
            }
            /// #endif

            /// #if TLSF_STATS
            this.statistics.successful_allocate_calls++;
            this.statistics.num_allocations_active++;
            this.statistics.payload_bytes_in_use += adjusted_size;
            this.statistics.overhead_bytes_in_use += MINIMAL_BLOCK_HEADER_SIZE;
            this.statistics.total_bytes_in_use = this.statistics.payload_bytes_in_use + this.statistics.overhead_bytes_in_use;
            this.statistics.total_bytes_free = this.statistics.payload_bytes_free + this.statistics.overhead_bytes_free;

            if (this.statistics.payload_bytes_in_use > this.statistics.peak_payload_bytes_in_use) {
               this.statistics.peak_payload_bytes_in_use = this.statistics.payload_bytes_in_use;
            }

            if (this.statistics.num_allocations_active > this.statistics.peak_num_allocations) {
               this.statistics.peak_num_allocations = this.statistics.num_allocations_active;
            }
            /// #endif

            return user_ptr;
         }
      }

      /// #if TLSF_STATS
      this.statistics.failed_allocate_calls++;
      /// #endif

      /// #if SAFETY
      {
         const message = `failed to allocate ${size} (adjusted ${adjusted_size}) bytes. OUT OF MEMORY!`;

         logger.critical(message);
         throw new Error(message);
      }
      /// #endif
   }

   /**
    * frees a previously allocated block of memory
    *
    * @param user_ptr a pointer to the user data area of the block to free. this must be a value previously returned by `allocate` or a similar allocation method. freeing a null/zero pointer is a no-op.
    */
   free(
      user_ptr: Pointer
   ): boolean {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      /// #if TLSF_STATS
      this.statistics.total_free_calls++;
      /// #endif

      logger.trace(`FREE(ptr=${user_ptr})`);

      if (user_ptr === GLOBAL_NULL_POINTER) {
         logger.trace(`   -> SKIPPED (null ptr)`);

         return false;
      }

      const block_hdr_offset = block_header_from_user_ptr(user_ptr);

      /// #if SAFETY
      if (
         block_hdr_offset < this.region_start_offset_in_buffer ||
         block_hdr_offset >= this.region_end_offset_in_buffer
      ) {
         {
            const message = `attempted to free pointer (user=${user_ptr}, header=${block_hdr_offset}) outside of managed pool bounds [${this.region_start_offset_in_buffer}-${this.region_end_offset_in_buffer})`;

            logger.critical(message);
            throw new Error(message);
         }
      }
      /// #endif

      /// #if SAFETY
      if (block_is_free(this.buffer, block_hdr_offset)) {
         {
            const message = `double free detected for user pointer=${user_ptr} (block header=${block_hdr_offset})`;

            logger.critical(message);
            throw new Error(message);
         }
      }
      /// #endif

      const payload_size = block_get_payload_size(this.buffer, block_hdr_offset);

      /// #if SAFETY
      try {
         const stomp_array = new Uint8Array(this.buffer, user_ptr, payload_size);
         stomp_array.fill(0xCC);

         logger.trace(`   -> stomped ${payload_size} bytes at ptr ${user_ptr} with pattern 0xCC`);
      } catch (e) {
         {
            const message = `failed to stomp memory at ptr ${user_ptr} with size ${payload_size}`;

            logger.critical(message);
            throw new Error(message, { cause: e });
         }
      }

      if (this.allocation_registry) {
         this.allocation_registry.unregister(user_ptr);
      }
      /// #endif

      /// #if TLSF_STATS
      this.statistics.successful_free_calls++;
      this.statistics.num_allocations_active--;
      this.statistics.payload_bytes_in_use -= payload_size;
      this.statistics.overhead_bytes_in_use -= MINIMAL_BLOCK_HEADER_SIZE;
      this.statistics.total_bytes_in_use = this.statistics.payload_bytes_in_use + this.statistics.overhead_bytes_in_use;
      /// #endif

      block_mark_as_free(this.buffer, block_hdr_offset);

      let current_block_hdr_offset = block_merge_prev(this.buffer, this.control, this.statistics, block_hdr_offset);
      current_block_hdr_offset = block_merge_next(this.buffer, this.control, this.statistics, this.region_end_offset_in_buffer, current_block_hdr_offset);

      block_insert(this.buffer, this.control, this.statistics, current_block_hdr_offset);

      /// #if TLSF_STATS
      this.statistics.total_bytes_free = this.statistics.payload_bytes_free + this.statistics.overhead_bytes_free;
      /// #endif

      logger.trace(`   -> SUCCESSFUL`);

      return true;
   }

   /**
    * reallocates a memory block, attempting to grow or shrink it
    *
    * @param old_user_ptr - pointer to the previously allocated block's user data area. if 0 or `GLOBAL_NULL_POINTER`, behaves like `allocate(new_payload_size)`
    * @param new_payload_size - the new desired payload size for the memory block. if 0, behaves like `free(old_user_ptr)` and returns 0
    * @param owner - the constructor of the `IView` that will manage this memory. if not provided for a move operation, the owner of the old allocation is reused
    * @param parent_ptr - the pointer to the parent allocation. required if `old_user_ptr` is null, otherwise inherited from the old allocation
    * 
    * @returns pointer to the reallocated memory block's user data area, or 0 on failure or if `new_payload_size` is 0. The returned pointer may be different from `old_user_ptr`. if reallocation fails (e.g., OOM), the original block at `old_user_ptr` is UNTOUCHED and still valid
    */
   reallocate(
      old_user_ptr: Pointer,
      new_payload_size: number,
      owner?: IViewConstructor<IView>,
      parent_ptr?: Pointer,
   ): Pointer {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      /// #if TLSF_STATS
      this.statistics.total_reallocate_calls++;
      /// #endif

      logger.trace(`REALLOCATE(old_ptr=${old_user_ptr}, new_size=${new_payload_size})`);

      if (new_payload_size === 0) {
         if (old_user_ptr !== GLOBAL_NULL_POINTER) {
            this.free(old_user_ptr);
         }

         return GLOBAL_NULL_POINTER;
      }

      if (old_user_ptr === GLOBAL_NULL_POINTER) {
         return this.allocate(new_payload_size, owner, parent_ptr);
      }

      const old_block_hdr_offset = block_header_from_user_ptr(old_user_ptr);

      /// #if SAFETY
      if (
         old_block_hdr_offset < this.region_start_offset_in_buffer
         || old_block_hdr_offset >= this.region_end_offset_in_buffer
      ) {
         {
            const message = `old_user_ptr (user ${old_user_ptr} -> hdr ${old_block_hdr_offset}) is out of pool region [${this.region_start_offset_in_buffer}-${this.region_end_offset_in_buffer})`;

            logger.critical(message);
            throw new Error(message);
         }
      }

      if (block_is_free(this.buffer, old_block_hdr_offset)) {
         {
            const message = `old_user_ptr (user ${old_user_ptr}) points to a block that is already free`;

            logger.critical(message);
            throw new Error(message);
         }
      }
      /// #endif

      const old_block_payload_size = block_get_payload_size(this.buffer, old_block_hdr_offset);
      const adjusted_new_size = adjust_request_size(new_payload_size, ALIGN_SIZE);

      if (
         adjusted_new_size === 0
         && new_payload_size > 0
      ) {
         // no double count (stats)

         return GLOBAL_NULL_POINTER;
      }

      if (adjusted_new_size === old_block_payload_size) {
         return old_user_ptr;
      }

      // shrink
      if (
         adjusted_new_size > 0
         && (adjusted_new_size < old_block_payload_size)
         && block_can_split(this.buffer, old_block_hdr_offset, adjusted_new_size)
      ) {
         /// #if TLSF_STATS
         const payload_diff = old_block_payload_size - adjusted_new_size;

         this.statistics.payload_bytes_in_use -= payload_diff;
         this.statistics.total_bytes_in_use = this.statistics.payload_bytes_in_use + this.statistics.overhead_bytes_in_use;
         /// #endif

         block_trim_used(this.buffer, this.control, this.statistics, this.region_end_offset_in_buffer, old_block_hdr_offset, adjusted_new_size);

         /// #if TLSF_STATS
         this.statistics.total_bytes_free = this.statistics.payload_bytes_free + this.statistics.overhead_bytes_free;
         /// #endif

         logger.trace(`   -> SHRUNK. ptr=${old_user_ptr}`);

         return old_user_ptr;
      }

      // grow
      if (adjusted_new_size > old_block_payload_size) {
         const next_block_hdr_offset = block_next_header_offset(this.buffer, old_block_hdr_offset);

         if (
            next_block_hdr_offset < this.region_end_offset_in_buffer
            && !block_is_last(this.buffer, next_block_hdr_offset)
            && block_is_free(this.buffer, next_block_hdr_offset)
         ) {
            const next_block_payload_size = block_get_payload_size(this.buffer, next_block_hdr_offset);
            const combined_potential_payload = old_block_payload_size + MINIMAL_BLOCK_HEADER_SIZE + next_block_payload_size;

            if (combined_potential_payload >= adjusted_new_size) {
               block_remove(this.buffer, this.control, this.statistics, next_block_hdr_offset);
               block_absorb(this.buffer, old_block_hdr_offset, next_block_hdr_offset);

               /// #if TLSF_STATS
               const payload_gained = MINIMAL_BLOCK_HEADER_SIZE + next_block_payload_size;
               this.statistics.payload_bytes_in_use += payload_gained;

               const current_merged_payload = block_get_payload_size(this.buffer, old_block_hdr_offset);

               if (current_merged_payload > adjusted_new_size) {
                  const excess_payload = current_merged_payload - adjusted_new_size;

                  this.statistics.payload_bytes_in_use -= excess_payload;
               }

               this.statistics.total_bytes_in_use = this.statistics.payload_bytes_in_use + this.statistics.overhead_bytes_in_use;
               /// #endif

               block_trim_used(this.buffer, this.control, this.statistics, this.region_end_offset_in_buffer, old_block_hdr_offset, adjusted_new_size);

               /// #if TLSF_STATS
               this.statistics.total_bytes_free = this.statistics.payload_bytes_free + this.statistics.overhead_bytes_free;

               if (this.statistics.payload_bytes_in_use > this.statistics.peak_payload_bytes_in_use) {
                  this.statistics.peak_payload_bytes_in_use = this.statistics.payload_bytes_in_use;
               }

               /// #endif
               logger.trace(`   -> GREW IN-PLACE. ptr=${old_user_ptr}`);

               return old_user_ptr;
            }
         }
      }

      // move: allocate, copy, free
      {
         let final_owner = owner;
         let inherited_parent_ptr = parent_ptr;

         /// #if SAFETY
         const old_node = this.allocation_registry?.get_node(old_user_ptr);

         inherited_parent_ptr = old_node?.parent_ptr;
         final_owner = owner ?? old_node?.owner;
         /// #endif

         const new_user_ptr = this.allocate(new_payload_size, final_owner, inherited_parent_ptr);

         if (new_user_ptr === GLOBAL_NULL_POINTER) {
            logger.warn(`   -> reallocation failed for ${new_payload_size} bytes. original block at ptr ${old_user_ptr} is untouched`);

            return GLOBAL_NULL_POINTER;
         }

         /// #if SAFETY
         if (
            this.allocation_registry
            && old_node
         ) {
            const new_node = this.allocation_registry.get_node(new_user_ptr);

            if (new_node) {
               for (const child_ptr of old_node.children) {
                  const child_node = this.allocation_registry.get_node(child_ptr);

                  if (child_node) {
                     child_node.parent_ptr = new_user_ptr;
                  }

                  new_node.children.add(child_ptr);
               }

               old_node.children.clear();
            }
         }
         /// #endif

         const bytes_to_copy = Math.min(old_block_payload_size, adjusted_new_size);

         if (bytes_to_copy > 0) {
            const source_array = new Uint8Array(this.buffer, old_user_ptr, bytes_to_copy);
            const dest_array = new Uint8Array(this.buffer, new_user_ptr, bytes_to_copy);

            dest_array.set(source_array);
         }

         this.free(old_user_ptr);

         logger.trace(`   -> MOVED. old_ptr=${old_user_ptr}, new_ptr=${new_user_ptr}`);

         return new_user_ptr;
      }
   }
}