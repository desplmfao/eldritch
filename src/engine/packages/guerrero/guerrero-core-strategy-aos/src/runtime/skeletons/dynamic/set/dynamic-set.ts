/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/set/dynamic-set.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { Pointer, IView, IViewConstructor, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { IGuerreroSet } from '@eldritch-engine/type-utils/guerrero/interfaces';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { GLOBAL_NULL_POINTER, LITTLE_ENDIAN, POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

/** byte offset within the control block for the map's current element count */
export const OFFSET_COUNT = 0;
/** byte offset within the control block for the map's current bucket capacity */
export const OFFSET_CAPACITY_BUCKETS = 4;
/** byte offset within the control block for the pointer to the buckets array */
export const OFFSET_BUCKETS_PTR = 8;
/** the total size of the control block in bytes */
export const CONTROL_BLOCK_SIZE = 12;
/** the initial number of buckets to allocate for a new hash map. must be a power of two */
export const INITIAL_CAPACITY_BUCKETS = 4;
/** the load factor at which the hash map will grow and rehash */
export const MAX_LOAD_FACTOR = 0.75;
/** */
export const OFFSET_ENTRY_NEXT_PTR = 0;
/** */
export const OFFSET_ENTRY_KEY_PTR = POINTER_SIZE;
/** */
export const ENTRY_NODE_SIZE = POINTER_SIZE * 2;

export abstract class DynamicSet<K, K_Internal extends IView> implements IGuerreroSet<K> {

   static __schema: SchemaLayout;

   readonly __view: DataView;
   readonly __buffer: ArrayBufferLike;
   readonly __byte_offset: Pointer;
   readonly __allocator: TlsfAllocator;

   readonly __key_constructor: IViewConstructor<K_Internal>;
   readonly __key_schema: SchemaLayout;

   readonly __owner_constructor?: IViewConstructor<IView>;
   readonly __owner_allocation_ptr?: Pointer;

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
      //
      key_constructor: IViewConstructor<K_Internal>,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer,
      //
      is_new_instance: boolean = false
   ) {
      /// #if SAFETY
      if (!key_constructor.__schema) {
         throw new Error(`element type '${key_constructor.name}' is missing a static __schema property`);
      }
      /// #endif

      this.__buffer = buffer;
      this.__byte_offset = byte_offset;
      this.__allocator = allocator;
      this.__view = new DataView(buffer);

      this.__key_constructor = key_constructor;
      this.__key_schema = key_constructor.__schema;

      this.__owner_constructor = owner_constructor;
      this.__owner_allocation_ptr = owner_allocation_ptr;
   }

   abstract $hash_key(
      key: K
   ): number;

   abstract $allocate_key(
      key: K
   ): K_Internal & { free(): void; $control_block_ptr?: Pointer; };

   abstract $free_key(
      key_view: K_Internal & { free(): void }
   ): void;

   abstract $are_keys_equal(
      key1: K,
      key2_view: K_Internal & { free(): void; }
   ): boolean;

   abstract $reconstruct_key_view(
      key_ptr: Pointer
   ): K_Internal & { free(): void; };

   abstract $get_key_from_view(
      key_view: K_Internal & { free(): void; }
   ): K;

   get size(): number {
      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return 0;
      }

      return this.$read_control_block_field(control_ptr, OFFSET_COUNT);
   }

   has(
      key: K
   ): boolean {
      return this.$find_entry_node(key) != null;
   }

   add(
      key: K
   ): this {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const existing_node = this.$find_entry_node(key);

      if (existing_node) {
         logger.trace(`ADD(exists) key='${String(key)}'`);

         return this;
      }

      logger.trace(`ADD(create) key='${String(key)}'`);

      if (this.$control_block_ptr === GLOBAL_NULL_POINTER) {
         this.$initialize_control_block();
      }

      if ((this.size + 1) / this.$capacity > MAX_LOAD_FACTOR) {
         this.$grow_and_rehash();
      }

      const new_node_ptr = this.__allocator.allocate(ENTRY_NODE_SIZE, this.constructor as IViewConstructor, this.__owner_allocation_ptr);

      if (new_node_ptr === GLOBAL_NULL_POINTER) {
         throw new Error('out of memory');
      }

      const node_bytes = new Uint8Array(this.$allocator_buffer, new_node_ptr, ENTRY_NODE_SIZE);
      node_bytes.fill(0);

      this.$insert_new_node(key, new_node_ptr);

      return this;
   }

   delete(
      key: K
   ): boolean {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`DELETE key='${String(key)}'`);

      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return false;
      }

      const bucket_index = this.$hash_key(key) & (this.$capacity - 1);
      const buckets_ptr = this.$read_control_block_field(control_ptr, OFFSET_BUCKETS_PTR);

      let prev_node_ptr: Pointer | null = null;
      let current_node_ptr = this.$get_bucket_head_ptr(buckets_ptr, bucket_index);

      while (current_node_ptr !== GLOBAL_NULL_POINTER) {
         const key_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_KEY_PTR);
         const key_view = this.$reconstruct_key_view(key_ptr);

         if (this.$are_keys_equal(key, key_view)) {
            const next_node_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_NEXT_PTR);

            if (prev_node_ptr) {
               this.$write_entry_node_field(prev_node_ptr, OFFSET_ENTRY_NEXT_PTR, next_node_ptr);
            } else {
               this.$set_bucket_head_ptr(buckets_ptr, bucket_index, next_node_ptr);
            }

            this.$free_key(key_view);
            this.__allocator.free(current_node_ptr);
            this.$set_control_block_field(control_ptr, OFFSET_COUNT, this.size - 1);

            return true;
         }

         prev_node_ptr = current_node_ptr;
         current_node_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_NEXT_PTR);
      }

      return false;
   }

   clear(): void {
      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return;
      }

      const capacity = this.$capacity;
      const buckets_ptr = this.$read_control_block_field(control_ptr, OFFSET_BUCKETS_PTR);

      for (let i = 0; i < capacity; i++) {
         let current_node_ptr = this.$get_bucket_head_ptr(buckets_ptr, i);

         while (current_node_ptr !== GLOBAL_NULL_POINTER) {
            const next_node_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_NEXT_PTR);
            const key_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_KEY_PTR);

            this.$free_key(this.$reconstruct_key_view(key_ptr));
            this.__allocator.free(current_node_ptr);

            current_node_ptr = next_node_ptr;
         }

         this.$set_bucket_head_ptr(buckets_ptr, i, GLOBAL_NULL_POINTER);
      }

      this.$set_control_block_field(control_ptr, OFFSET_COUNT, 0);
   }

   *values(): IterableIterator<K> {
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
            const key_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_KEY_PTR);
            const key_view = this.$reconstruct_key_view(key_ptr);

            yield this.$get_key_from_view(key_view);

            current_node_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_NEXT_PTR);
         }
      }
   }

   keys(): IterableIterator<K> {
      return this.values();
   }

   *entries(): IterableIterator<[K, K]> {
      for (const key of this.values()) {
         yield [key, key];
      }
   }

   *[Symbol.iterator](): IterableIterator<K> {
      yield* this.values();
   }

   $copy_from(
      source: this | Set<K> | K[]
   ): void {
      this.clear();

      for (const key of source.values()) {
         this.add(key);
      }
   }

   free(): void {
      this.clear();

      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return;
      }

      const buckets_ptr = this.$read_control_block_field(control_ptr, OFFSET_BUCKETS_PTR);

      if (buckets_ptr !== GLOBAL_NULL_POINTER) {
         this.__allocator.free(buckets_ptr);
      }

      this.__allocator.free(control_ptr);

      this.$control_block_ptr = GLOBAL_NULL_POINTER;
   }

   get $capacity(): number {
      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return 0;
      }

      return this.$read_control_block_field(control_ptr, OFFSET_CAPACITY_BUCKETS);
   }

   get $control_block_ptr(): Pointer {
      return this.__view.getUint32(this.__byte_offset, LITTLE_ENDIAN);
   };

   set $control_block_ptr(
      ptr: Pointer
   ) {
      this.__view.setUint32(this.__byte_offset, ptr, LITTLE_ENDIAN);
   }

   get $allocator_buffer(): ArrayBufferLike {
      return this.__allocator.buffer;
   }

   $read_control_block_field(
      ptr: Pointer,
      offset: number
   ): Pointer {
      const buffer = this.$allocator_buffer;

      return new DataView(buffer).getUint32(ptr + offset, LITTLE_ENDIAN);
   }

   $set_control_block_field(
      ptr: Pointer,
      offset: number,
      value: number
   ): void {
      const buffer = this.$allocator_buffer;

      new DataView(buffer).setUint32(ptr + offset, value, LITTLE_ENDIAN);
   }

   $get_bucket_head_ptr(
      buckets_ptr: Pointer,
      index: number
   ): Pointer {
      const buffer = this.$allocator_buffer;

      return new DataView(buffer).getUint32(buckets_ptr + index * POINTER_SIZE, LITTLE_ENDIAN);
   }

   $set_bucket_head_ptr(
      buckets_ptr: Pointer,
      index: number,
      node_ptr: Pointer
   ): void {
      const buffer = this.$allocator_buffer;

      new DataView(buffer).setUint32(buckets_ptr + index * POINTER_SIZE, node_ptr, LITTLE_ENDIAN);
   }

   $read_entry_node_field(
      node_ptr: Pointer,
      offset: number
   ): Pointer {
      const buffer = this.$allocator_buffer;

      return new DataView(buffer).getUint32(node_ptr + offset, LITTLE_ENDIAN);
   }

   $write_entry_node_field(
      node_ptr: Pointer,
      offset: number,
      value: number
   ): void {
      const buffer = this.$allocator_buffer;

      new DataView(buffer).setUint32(node_ptr + offset, value, LITTLE_ENDIAN);
   }

   $find_entry_node(
      key: K
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
         const key_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_KEY_PTR);
         const key_view = this.$reconstruct_key_view(key_ptr);

         if (this.$are_keys_equal(key, key_view)) {
            return current_node_ptr;
         }

         current_node_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_NEXT_PTR);
      }

      return null;
   }

   $initialize_control_block() {
      const control_ptr = this.__allocator.allocate(CONTROL_BLOCK_SIZE, this.constructor as IViewConstructor, this.__owner_allocation_ptr);
      const buckets_ptr = this.__allocator.allocate(INITIAL_CAPACITY_BUCKETS * POINTER_SIZE, this.constructor as IViewConstructor, this.__owner_allocation_ptr);

      if (control_ptr === GLOBAL_NULL_POINTER || buckets_ptr === GLOBAL_NULL_POINTER) {
         throw new Error('out of memory');
      }

      this.$control_block_ptr = control_ptr;

      this.$set_control_block_field(control_ptr, OFFSET_COUNT, 0);
      this.$set_control_block_field(control_ptr, OFFSET_CAPACITY_BUCKETS, INITIAL_CAPACITY_BUCKETS);
      this.$set_control_block_field(control_ptr, OFFSET_BUCKETS_PTR, buckets_ptr);

      const buckets_buffer = new Uint8Array(this.$allocator_buffer, buckets_ptr, INITIAL_CAPACITY_BUCKETS * POINTER_SIZE);
      buckets_buffer.fill(0);
   }

   $grow_and_rehash(): void {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const old_control_ptr = this.$control_block_ptr;
      const old_capacity = this.$capacity;
      const old_buckets_ptr = this.$read_control_block_field(old_control_ptr, OFFSET_BUCKETS_PTR);
      const new_capacity = old_capacity * 2;

      logger.trace(`$grow_and_rehash() from capacity ${old_capacity} to ${new_capacity}`);

      const new_buckets_ptr = this.__allocator.allocate(new_capacity * POINTER_SIZE, this.constructor as IViewConstructor, this.__owner_allocation_ptr);

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
            const key_ptr = this.$read_entry_node_field(current_node_ptr, OFFSET_ENTRY_KEY_PTR);
            const key_view = this.$reconstruct_key_view(key_ptr);
            const original_key = this.$get_key_from_view(key_view);
            const new_bucket_index = this.$hash_key(original_key) & (new_capacity - 1);

            const new_head_ptr = this.$get_bucket_head_ptr(new_buckets_ptr, new_bucket_index);
            this.$write_entry_node_field(current_node_ptr, OFFSET_ENTRY_NEXT_PTR, new_head_ptr);
            this.$set_bucket_head_ptr(new_buckets_ptr, new_bucket_index, current_node_ptr);

            current_node_ptr = next_node_ptr;
         }
      }

      this.__allocator.free(old_buckets_ptr);
      this.$set_control_block_field(old_control_ptr, OFFSET_CAPACITY_BUCKETS, new_capacity);
      this.$set_control_block_field(old_control_ptr, OFFSET_BUCKETS_PTR, new_buckets_ptr);
   }

   $insert_new_node(
      key: K,
      new_node_ptr: Pointer
   ): void {
      const key_view = this.$allocate_key(key);
      const key_ptr = key_view.$control_block_ptr ?? GLOBAL_NULL_POINTER;

      if (
         key_ptr === GLOBAL_NULL_POINTER &&
         (typeof key === 'string' ? key !== '' : true)
      ) {
         this.__allocator.free(new_node_ptr);

         throw new Error('out of memory allocating key for hash set');
      }

      const control_ptr = this.$control_block_ptr;
      const bucket_index = this.$hash_key(key) & (this.$capacity - 1);
      const buckets_ptr = this.$read_control_block_field(control_ptr, OFFSET_BUCKETS_PTR);
      const head_ptr = this.$get_bucket_head_ptr(buckets_ptr, bucket_index);

      this.$write_entry_node_field(new_node_ptr, OFFSET_ENTRY_NEXT_PTR, head_ptr);
      this.$write_entry_node_field(new_node_ptr, OFFSET_ENTRY_KEY_PTR, key_ptr);
      this.$set_bucket_head_ptr(buckets_ptr, bucket_index, new_node_ptr);
      this.$set_control_block_field(control_ptr, OFFSET_COUNT, this.size + 1);
   }
}