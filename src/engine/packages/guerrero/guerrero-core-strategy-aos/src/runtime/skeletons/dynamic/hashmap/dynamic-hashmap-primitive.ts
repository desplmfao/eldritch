/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-primitive.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { IView, IViewConstructor, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER, POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicHashMap, OFFSET_BUCKETS_PTR, OFFSET_COUNT } from '@self/runtime/skeletons/dynamic/hashmap/dynamic-hashmap';
import type { PrimitiveView } from '@self/runtime/skeletons/fixed/fixed-primitive';

export abstract class DynamicHashMapPrimitive<
   K_Public extends number | bigint | boolean,
   K_Internal extends PrimitiveView<K_Public>,
   V_Internal extends IView,
   V_Public
> extends DynamicHashMap<K_Public, V_Internal, V_Public> {

   readonly __key_constructor: IViewConstructor<K_Internal>;
   readonly __key_schema: SchemaLayout;

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
      //
      key_constructor: IViewConstructor<K_Internal>,
      value_constructor: IViewConstructor<V_Internal>,
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
         value_constructor,
         //
         owner_constructor,
         owner_allocation_ptr,
         //
         is_new_instance
      );

      /// #if SAFETY
      if (!key_constructor.__schema) {
         throw new Error(`key type '${key_constructor.name}' is missing a static __schema property`);
      }
      /// #endif

      this.__key_constructor = key_constructor;
      this.__key_schema = key_constructor.__schema;
   }

   abstract get $key_size(): number;
   abstract get $key_alignment(): number;

   abstract $read_key(
      buffer: DataView,
      offset: Pointer
   ): K_Public;

   abstract $write_key(
      buffer: DataView,
      offset: Pointer,
      value: K_Public
   ): void;

   get $entry_node_key_ptr_offset(): number {
      return POINTER_SIZE;
   }

   get $entry_node_key_offset(): number {
      const base_offset = POINTER_SIZE * 2;
      const alignment = Math.max(this.$key_alignment, POINTER_SIZE);

      return (base_offset + (alignment - 1)) & ~(alignment - 1);
   }

   override $allocate_key(): any {
      /* no-op, key is stored inline */
      return null;
   }

   override $free_key(): void {
      /* no-op */
   }

   override $reconstruct_key_view(
      key_node_ptr: Pointer
   ): K_Internal & { free(): void; } {
      const key_offset_in_pool = key_node_ptr + this.$entry_node_key_offset;
      const data_buffer = this.__allocator.buffer;

      return new (this.__key_constructor)(data_buffer, key_offset_in_pool, this.__allocator) as K_Internal & { free(): void; };
   }

   override $get_key_from_view(
      key_view: K_Internal
   ): K_Public {
      return key_view.value;
   }

   override $are_keys_equal(
      key1: K_Public,
      key2_view: K_Internal
   ): boolean {
      return key1 === key2_view.value;
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
            const next_node_ptr = this.$read_entry_node_field(current_node_ptr, 0);

            this.$free_value_in_node(current_node_ptr);
            this.__allocator.free(current_node_ptr);

            current_node_ptr = next_node_ptr;
         }

         this.$set_bucket_head_ptr(buckets_ptr, i, GLOBAL_NULL_POINTER);
      }

      this.$set_control_block_field(control_ptr, OFFSET_COUNT, 0);
   }

   override delete(
      key: K_Public
   ): boolean {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`DELETE(key='${key}')`);

      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return false;
      }

      const bucket_index = this.$hash_key(key) & (this.$capacity - 1);
      const buckets_ptr = this.$read_control_block_field(control_ptr, 8);
      const view = new DataView(this.$allocator_buffer);

      let prev_node_ptr: Pointer | null = null;
      let current_node_ptr = this.$get_bucket_head_ptr(buckets_ptr, bucket_index);

      while (current_node_ptr !== GLOBAL_NULL_POINTER) {
         const stored_key = this.$read_key(view, current_node_ptr + this.$entry_node_key_offset);

         if (stored_key === key) {
            const next_node_ptr = this.$read_entry_node_field(current_node_ptr, 0);

            if (prev_node_ptr) {
               this.$write_entry_node_field(prev_node_ptr, 0, next_node_ptr);
            } else {
               this.$set_bucket_head_ptr(buckets_ptr, bucket_index, next_node_ptr);
            }

            this.$free_value_in_node(current_node_ptr);
            this.__allocator.free(current_node_ptr);
            this.$set_control_block_field(control_ptr, 0, this.size - 1);

            return true;
         }

         prev_node_ptr = current_node_ptr;
         current_node_ptr = this.$read_entry_node_field(current_node_ptr, 0);
      }

      return false;
   }

   override *entries(): IterableIterator<[K_Public, V_Public]> {
      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return;
      }

      const capacity = this.$capacity;

      if (capacity === 0) {
         return;
      }

      const buckets_ptr = this.$read_control_block_field(control_ptr, 8);
      const view = new DataView(this.$allocator_buffer);

      for (let i = 0; i < capacity; i++) {
         let current_node_ptr = this.$get_bucket_head_ptr(buckets_ptr, i);

         while (current_node_ptr !== GLOBAL_NULL_POINTER) {
            const key = this.$read_key(view, current_node_ptr + this.$entry_node_key_offset);
            const value = this.$read_public_value_from_node(current_node_ptr);

            yield [key, value];
            current_node_ptr = this.$read_entry_node_field(current_node_ptr, 0);
         }
      }
   }

   override $grow_and_rehash(): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const old_control_ptr = this.$control_block_ptr;
      const old_capacity = this.$capacity;
      const old_buckets_ptr = this.$read_control_block_field(old_control_ptr, 8);
      const new_capacity = old_capacity * 2;

      logger.trace(`$grow_and_rehash() from capacity ${old_capacity} to ${new_capacity} (primitive override)`);

      const new_buckets_ptr = this.__allocator.allocate(new_capacity * POINTER_SIZE, this.constructor as IViewConstructor, this.__owner_allocation_ptr);

      if (new_buckets_ptr === GLOBAL_NULL_POINTER) {
         throw new Error('out of memory during rehash');
      }

      const allocator_buffer = this.$allocator_buffer;
      const new_buckets_buffer = new Uint8Array(allocator_buffer, new_buckets_ptr, new_capacity * POINTER_SIZE);
      new_buckets_buffer.fill(0);

      const view = new DataView(allocator_buffer);

      for (let i = 0; i < old_capacity; i++) {
         let current_node_ptr = this.$get_bucket_head_ptr(old_buckets_ptr, i);

         while (current_node_ptr !== GLOBAL_NULL_POINTER) {
            const next_node_ptr = this.$read_entry_node_field(current_node_ptr, 0);
            const original_key = this.$read_key(view, current_node_ptr + this.$entry_node_key_offset);
            const new_bucket_index = this.$hash_key(original_key) & (new_capacity - 1);

            const new_head_ptr = this.$get_bucket_head_ptr(new_buckets_ptr, new_bucket_index);
            this.$write_entry_node_field(current_node_ptr, 0, new_head_ptr);
            this.$set_bucket_head_ptr(new_buckets_ptr, new_bucket_index, current_node_ptr);

            current_node_ptr = next_node_ptr;
         }
      }

      this.__allocator.free(old_buckets_ptr);

      this.$set_control_block_field(old_control_ptr, 8, new_buckets_ptr);
      this.$set_control_block_field(old_control_ptr, 4, new_capacity);
   }

   override $find_entry_node(
      key: K_Public
   ): {
      node_ptr: Pointer,
      prev_node_ptr: Pointer | null
   } | null {
      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return null;
      }

      const capacity = this.$capacity;

      if (capacity === 0) {
         return null;
      }

      const bucket_index = this.$hash_key(key) & (capacity - 1);
      const buckets_ptr = this.$read_control_block_field(control_ptr, 8);
      const view = new DataView(this.$allocator_buffer);

      let prev_node_ptr: Pointer | null = null;
      let current_node_ptr = this.$get_bucket_head_ptr(buckets_ptr, bucket_index);

      while (current_node_ptr !== GLOBAL_NULL_POINTER) {
         const stored_key = this.$read_key(view, current_node_ptr + this.$entry_node_key_offset);

         if (stored_key === key) {
            return {
               node_ptr: current_node_ptr,
               prev_node_ptr
            };
         }

         prev_node_ptr = current_node_ptr;
         current_node_ptr = this.$read_entry_node_field(current_node_ptr, 0);
      }

      return null;
   }

   override $insert_new_node(
      key: K_Public,
      new_node_ptr: Pointer
   ): void {
      const control_ptr = this.$control_block_ptr;
      const bucket_index = this.$hash_key(key) & (this.$capacity - 1);
      const buckets_ptr = this.$read_control_block_field(control_ptr, 8);
      const head_ptr = this.$get_bucket_head_ptr(buckets_ptr, bucket_index);

      const view = new DataView(this.$allocator_buffer);

      this.$write_entry_node_field(new_node_ptr, 0, head_ptr);
      this.$write_key(view, new_node_ptr + this.$entry_node_key_offset, key);

      this.$set_bucket_head_ptr(buckets_ptr, bucket_index, new_node_ptr);
      this.$set_control_block_field(control_ptr, 0, this.size + 1);
   }
}