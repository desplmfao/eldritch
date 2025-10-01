/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/runtime/allocator/types.ts
 */

import type { IView, IViewConstructor, Pointer } from '@eldritch-engine/type-utils/guerrero/index';

/** opaque type representing a memory pool managed by tlsf */
export type TlsfPool = ArrayBufferLike;

/** */
export interface TlsfBlockHeader {
   /** offset of the previous physical block's header */
   prev_phys_block_offset: Pointer;
   /** size of the current block's payload + status bits */
   size_with_flags: number;
   /** offset of the next free block in the list */
   next_free_offset: Pointer;
   /** offset of the previous free block in the list */
   prev_free_offset: Pointer;
}

/** represents a block's basic information for debugging or walking the pool */
export interface TlsfBlockInfo {
   /** user pointer (start of usable data area) */
   ptr: Pointer;
   /** payload size */
   size: number;
   /** true if used, false if free */
   used: boolean;
   /** actual start of the block_header_t structure in memory */
   block_header_offset: Pointer;
}

/** walker function type for tlsf_walk_pool */
export type TlsfWalker = (info: TlsfBlockInfo, user_data?: unknown) => void;

/** */
export interface TlsfControl {
   /** sentinel block for empty lists. points to itself */
   block_null_next_free: Pointer; // conceptually control.block_null.next_free
   block_null_prev_free: Pointer; // conceptually control.block_null.prev_free

   /** bitmap of first-level lists that have at least one free block */
   fl_bitmap: number; // unsigned int
   /** array of bitmaps for second-level lists */
   sl_bitmap: Uint32Array; // unsigned int sl_bitmap[FL_INDEX_COUNT];

   /**
    * heads of the free lists
    * 
    * `blocks[fl][sl]` stores the offset of the first block in the free list for that FLI/SLI combination
    */
   blocks: Pointer[][]; // block_header_t* blocks[FL_INDEX_COUNT][SL_INDEX_COUNT];
   // this will be (number | undefined)[][] or similar, storing offsets
}

/**
 * represents a handle to an allocation made by TlsfAllocator
 * 
 * extends the generic AllocationHandle with tlsf-specific details if needed, though for basic IAllocator, only offset and size are strictly required externally
 * 
 * the `block_offset` here is the actual start of the tlsf block header
 */
export interface TlsfAllocationHandle {
   /** byte offset of the allocation */
   readonly offset: Pointer;
   /** size of the allocation in bytes */
   readonly size: number;

   /** points to the start of the block_header_t structure */
   block_offset: Pointer;
   /** points to the start of the user data area */
   user_ptr_offset: Pointer;
}

export interface TlsfStatistics {
   /** total size of the managed memory region */
   pool_total_bytes: number;
   /** bytes used by tlsf for its initial structures (first block header + sentinel header) */
   pool_overhead_bytes: number;

   /** sum of payload sizes of all USED blocks */
   payload_bytes_in_use: number;
   /** sum of header sizes (MINIMAL_BLOCK_HEADER_SIZE) for all USED blocks */
   overhead_bytes_in_use: number;
   /** payload_bytes_in_use + overhead_bytes_in_use */
   total_bytes_in_use: number;

   /** sum of payload sizes of all FREE blocks */
   payload_bytes_free: number;
   /** sum of header sizes (BLOCK_HEADER_FULL_SIZE) for all FREE blocks */
   overhead_bytes_free: number;
   /** payload_bytes_free + overhead_bytes_free */
   total_bytes_free: number;

   /** count of current USED blocks */
   num_allocations_active: number;
   /** count of current FREE blocks */
   num_free_blocks_active: number;

   /** maximum payload_bytes_in_use observed */
   peak_payload_bytes_in_use: number;
   /** maximum num_allocations_active observed */
   peak_num_allocations: number;

   /** counter for successful and failed allocate() */
   total_allocate_calls: number;
   /** counter for successful and no-op free() */
   total_free_calls: number;
   /** counter for reallocate() */
   total_reallocate_calls: number;
   /** counter for allocations that returned GLOBAL_NULL_POINTER */
   failed_allocate_calls: number;
   /** counter for successful allocations */
   successful_allocate_calls: number;
   /** counter for frees that actually freed a block */
   successful_free_calls: number;
}

/** represents a single node in the allocation tree for debugging and visualization */
export interface AllocationNode {
   /** the user pointer for this allocation */
   ptr: Pointer;
   /** the constructor of the IView that "owns" the data at this pointer */
   owner: IViewConstructor<IView>;
   /** the pointer to the parent allocation node, or `null` if this is a root allocation */
   parent_ptr?: Pointer;
   /** a set of pointers to direct child allocation nodes */
   children: Set<Pointer>;
}