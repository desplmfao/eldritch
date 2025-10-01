/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/set/dynamic-set-of.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IHashable, IView, IViewConstructor, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { POINTER_SIZE, GLOBAL_NULL_POINTER } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { GUERRERO_SCHEMA_PLACEHOLDER } from '@eldritch-engine/guerrero-core/runtime/placeholder';

import {
   DynamicSet,
   MAX_LOAD_FACTOR,
   OFFSET_BUCKETS_PTR,
   OFFSET_CAPACITY_BUCKETS,
   OFFSET_COUNT,
   OFFSET_ENTRY_NEXT_PTR
} from '@self/runtime/skeletons/dynamic/set/dynamic-set';

export class DynamicSetOf<V extends IView & IHashable & { $copy_from(source: V): void; free?(): void; }> extends DynamicSet<V, V> {

   static override readonly __schema: SchemaLayout = GUERRERO_SCHEMA_PLACEHOLDER;

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
      //
      element_constructor: IViewConstructor<V>,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer,
      //
      is_new_instance: boolean = false
   ) {
      super(
         buffer,
         byte_offset,
         allocator,
         //
         element_constructor,
         //
         owner_constructor,
         owner_allocation_ptr,
         //
         is_new_instance
      );
   }

   override add(
      key: V
   ): this {
      const existing_node_ptr = this.$find_entry_node(key);

      if (existing_node_ptr) {
         this.$reconstruct_key_view(existing_node_ptr, false);

         return this;
      }

      if (this.$control_block_ptr === GLOBAL_NULL_POINTER) {
         this.$initialize_control_block();
      }

      if ((this.size + 1) / this.$capacity > MAX_LOAD_FACTOR) {
         this.$grow_and_rehash();
      }

      const new_node_ptr = this.__allocator.allocate(this.$entry_node_size, this.constructor as IViewConstructor, this.__owner_allocation_ptr);

      if (new_node_ptr === GLOBAL_NULL_POINTER) {
         throw new Error('out of memory');
      }

      const new_key_view = this.$reconstruct_key_view(new_node_ptr, true);
      new_key_view.$copy_from(key);

      this.$insert_new_node(new_key_view, new_node_ptr);

      return this;
   }

   get $entry_node_key_offset(): number {
      return POINTER_SIZE;
   }

   get $entry_node_size(): number {
      const base_size = this.$entry_node_key_offset + this.__key_schema.total_size;
      const alignment = Math.max(this.__key_schema.alignment, POINTER_SIZE);

      return (base_size + (alignment - 1)) & ~(alignment - 1);
   }

   override $hash_key(key: V): number {
      return key.$hash();
   }

   override $allocate_key(): any {
      throw new Error(`method $allocate_key should not be called for ${DynamicSetOf.name}`);
   }

   override $free_key(
      key_view: V & { free?(): void; }
   ): void {
      key_view.free?.();
   }

   override $are_keys_equal(
      key1: V,
      key2_view: V
   ): boolean {
      return key1.$equals(key2_view);
   }

   override $get_key_from_view(
      key_view: V
   ): V {
      return key_view;
   }

   override $reconstruct_key_view(
      node_ptr: Pointer,
      //
      is_new_instance: boolean = false
   ): V & { free(): void; } {
      const key_offset_in_pool = node_ptr + this.$entry_node_key_offset;
      const data_buffer = this.__allocator.buffer;

      return new this.__key_constructor(
         data_buffer,
         key_offset_in_pool,
         this.__allocator,
         //
         undefined,
         undefined,
         //
         is_new_instance
      ) as V & { free(): void; };
   }

   override clear(): void {
      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return;
      }

      const capacity = this.$capacity;

      if (capacity === 0) {
         return;
      }

      const buckets_ptr = this.$read_control_block_field(control_ptr, OFFSET_BUCKETS_PTR);

      for (let i = 0; i < capacity; i++) {
         let current_node_ptr = this.$get_bucket_head_ptr(buckets_ptr, i);

         while (current_node_ptr !== GLOBAL_NULL_POINTER) {
            const next_node_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_NEXT_PTR);

            this.$free_key(this.$reconstruct_key_view(current_node_ptr));
            this.__allocator.free(current_node_ptr);

            current_node_ptr = next_node_ptr;
         }

         this.$set_bucket_head_ptr(buckets_ptr, i, GLOBAL_NULL_POINTER);
      }

      this.$set_control_block_field(control_ptr, OFFSET_COUNT, 0);
   }

   override delete(
      key: V
   ): boolean {
      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return false;
      }

      const capacity = this.$capacity;

      if (capacity === 0) {
         return false;
      }

      const bucket_index = this.$hash_key(key) & (capacity - 1);
      const buckets_ptr = this.$read_control_block_field(control_ptr, OFFSET_BUCKETS_PTR);

      let prev_node_ptr: Pointer | null = null;
      let current_node_ptr = this.$get_bucket_head_ptr(buckets_ptr, bucket_index);

      while (current_node_ptr !== GLOBAL_NULL_POINTER) {
         const stored_key_view = this.$reconstruct_key_view(current_node_ptr);

         if (this.$are_keys_equal(key, stored_key_view)) {
            const next_node_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_NEXT_PTR);

            if (prev_node_ptr) {
               this.$write_entry_node_field(prev_node_ptr, OFFSET_ENTRY_NEXT_PTR, next_node_ptr);
            } else {
               this.$set_bucket_head_ptr(buckets_ptr, bucket_index, next_node_ptr);
            }

            this.$free_key(stored_key_view);
            this.__allocator.free(current_node_ptr);
            this.$set_control_block_field(control_ptr, OFFSET_COUNT, this.size - 1);

            return true;
         }

         prev_node_ptr = current_node_ptr;
         current_node_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_NEXT_PTR);
      }

      return false;
   }

   override *values(): IterableIterator<V> {
      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return;
      }

      const capacity = this.$capacity;

      if (capacity === 0) {
         return;
      }

      const buckets_ptr = this.$read_control_block_field(control_ptr, OFFSET_BUCKETS_PTR);

      for (let i = 0; i < capacity; i++) {
         let current_node_ptr = this.$get_bucket_head_ptr(buckets_ptr, i);

         while (current_node_ptr !== GLOBAL_NULL_POINTER) {
            yield this.$reconstruct_key_view(current_node_ptr);

            current_node_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_NEXT_PTR);
         }
      }
   }

   //
   //

   override $grow_and_rehash(): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');
      const old_control_ptr = this.$control_block_ptr;
      const old_capacity = this.$capacity;
      const old_buckets_ptr = this.$read_control_block_field(old_control_ptr, OFFSET_BUCKETS_PTR);
      const new_capacity = old_capacity * 2;

      logger.trace(`$grow_and_rehash() from capacity ${old_capacity} to ${new_capacity} (struct override)`);

      const new_buckets_ptr = this.__allocator.allocate(
         new_capacity * POINTER_SIZE,
         this.constructor as IViewConstructor,
         this.__owner_allocation_ptr
      );

      if (new_buckets_ptr === GLOBAL_NULL_POINTER) {
         throw new Error('out of memory during rehash');
      }

      const allocator_buffer = this.$allocator_buffer;
      const new_buckets_buffer = new Uint8Array(allocator_buffer, new_buckets_ptr, new_capacity * POINTER_SIZE);
      new_buckets_buffer.fill(0);

      for (let i = 0; i < old_capacity; i++) {
         let current_node_ptr = this.$get_bucket_head_ptr(old_buckets_ptr, i);

         while (current_node_ptr !== GLOBAL_NULL_POINTER) {
            const next_node_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_NEXT_PTR);
            const original_key_view = this.$reconstruct_key_view(current_node_ptr);
            const new_bucket_index = this.$hash_key(original_key_view) & (new_capacity - 1);
            const new_head_ptr = this.$get_bucket_head_ptr(new_buckets_ptr, new_bucket_index);

            this.$write_entry_node_field(current_node_ptr, OFFSET_ENTRY_NEXT_PTR, new_head_ptr);
            this.$set_bucket_head_ptr(new_buckets_ptr, new_bucket_index, current_node_ptr);

            current_node_ptr = next_node_ptr;
         }
      }

      this.__allocator.free(old_buckets_ptr);

      this.$set_control_block_field(old_control_ptr, OFFSET_BUCKETS_PTR, new_buckets_ptr);
      this.$set_control_block_field(old_control_ptr, OFFSET_CAPACITY_BUCKETS, new_capacity);
   }

   override $find_entry_node(
      key: V
   ): Pointer | null {
      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return null;
      }

      const capacity = this.$capacity;

      if (capacity === 0) {
         return null;
      }

      const bucket_index = this.$hash_key(key) & (capacity - 1);
      const buckets_ptr = this.$read_control_block_field(control_ptr, OFFSET_BUCKETS_PTR);
      let current_node_ptr = this.$get_bucket_head_ptr(buckets_ptr, bucket_index);

      while (current_node_ptr !== GLOBAL_NULL_POINTER) {
         const stored_key_view = this.$reconstruct_key_view(current_node_ptr);

         if (this.$are_keys_equal(key, stored_key_view)) {
            return current_node_ptr;
         }

         current_node_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_NEXT_PTR);
      }

      return null;
   }

   override $insert_new_node(
      key: V,
      new_node_ptr: Pointer
   ): void {
      const control_ptr = this.$control_block_ptr;
      const bucket_index = this.$hash_key(key) & (this.$capacity - 1);
      const buckets_ptr = this.$read_control_block_field(control_ptr, OFFSET_BUCKETS_PTR);
      const head_ptr = this.$get_bucket_head_ptr(buckets_ptr, bucket_index);

      this.$write_entry_node_field(new_node_ptr, OFFSET_ENTRY_NEXT_PTR, head_ptr);

      this.$set_bucket_head_ptr(buckets_ptr, bucket_index, new_node_ptr);
      this.$set_control_block_field(control_ptr, OFFSET_COUNT, this.size + 1);
   }
}