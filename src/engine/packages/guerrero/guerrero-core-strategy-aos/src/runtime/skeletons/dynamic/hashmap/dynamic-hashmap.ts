/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/hashmap/dynamic-hashmap.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { Pointer, IView, IViewConstructor, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { IGuerreroMap } from '@eldritch-engine/type-utils/guerrero/interfaces';

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

export abstract class DynamicHashMap<K, V_Internal extends IView, V_Public> implements IGuerreroMap<K, V_Public> {

   static __schema: SchemaLayout;

   readonly __view: DataView;
   readonly __buffer: ArrayBufferLike;
   readonly __byte_offset: Pointer;
   readonly __allocator: TlsfAllocator;

   readonly __value_constructor: IViewConstructor<V_Internal>;
   readonly __value_schema: SchemaLayout;

   readonly __owner_constructor?: IViewConstructor<IView>;
   readonly __owner_allocation_ptr?: Pointer;

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
      //
      value_constructor: IViewConstructor<V_Internal>,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer,
      //
      is_new_instance: boolean = false
   ) {
      /// #if SAFETY
      if (!value_constructor.__schema) {
         throw new Error(`element type '${value_constructor.name}' is missing a static __schema property`);
      }
      /// #endif

      this.__buffer = buffer;
      this.__byte_offset = byte_offset;
      this.__allocator = allocator;
      this.__view = new DataView(buffer);

      this.__value_constructor = value_constructor;
      this.__value_schema = this.__value_constructor.__schema;

      this.__owner_constructor = owner_constructor;
      this.__owner_allocation_ptr = owner_allocation_ptr;
   }

   abstract get $entry_node_size(): number;

   abstract $hash_key(
      key: K
   ): number;

   abstract $allocate_key(
      key: K
   ): IView & { free(): void };

   abstract $free_key(
      key_view: IView & { free(): void }
   ): void;

   abstract $are_keys_equal(
      key1: K,
      key2_view: IView
   ): boolean;

   abstract $read_public_value_from_node(
      node_ptr: Pointer
   ): V_Public;

   abstract $write_public_value_to_node(
      node_ptr: Pointer,
      value: V_Public,
      //
      is_new_instance: boolean
   ): void;

   abstract $get_internal_value_view_from_node(
      node_ptr: Pointer,
      //
      is_new_instance: boolean
   ): V_Internal;

   abstract $free_value_in_node(
      node_ptr: Pointer
   ): void;

   abstract $reconstruct_key_view(
      key_ptr: Pointer
   ): IView & { free(): void; };

   abstract $get_key_from_view(
      key_view: IView
   ): K;

   /** gets the number of key-value pairs in the map */
   get size(): number {
      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return 0;
      }

      return this.$read_control_block_field(control_ptr, OFFSET_COUNT);
   }

   /**
    * checks if a key exists in the map
    *
    * @param key - the key to check for
    */
   has(
      key: K
   ): boolean {
      return this.$find_entry_node(key) != null;
   }

   /**
    * retrieves the value associated with a key
    *
    * @param key - the key of the value to retrieve
    */
   get(
      key: K
   ): V_Public | undefined {
      const { node_ptr } = this.$find_entry_node(key) ?? {};

      if (node_ptr) {
         return this.$read_public_value_from_node(node_ptr);
      }

      return;
   }

   /**
    * ensures a key exists and returns its internal view for modification
    *
    * this is the most efficient way to insert/update, as it avoids temp objects
    *
    * @param key - the key to find or create
    *
    * @returns a view to the value associated with the key
    */
   emplace(
      key: K
   ): V_Internal {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const existing_node_ptr = this.$find_entry_node(key)?.node_ptr;

      if (existing_node_ptr) {
         logger.trace(`EMPLACE(get) key='${String(key)}'`);

         return this.$get_internal_value_view_from_node(existing_node_ptr, false);
      }

      logger.trace(`EMPLACE(create) key='${String(key)}'`);

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

      const node_bytes = new Uint8Array(this.$allocator_buffer, new_node_ptr, this.$entry_node_size);
      node_bytes.fill(0);

      this.$insert_new_node(key, new_node_ptr);

      return this.$get_internal_value_view_from_node(new_node_ptr, true);
   }

   /**
    * sets the value for a key, replacing any existing value
    * 
    * @param key - the key to set
    * @param value - the public-facing value to set
    * 
    * @returns the map instance for chaining
    */
   set(
      key: K,
      value: V_Public
   ): this {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      if (this.$control_block_ptr === GLOBAL_NULL_POINTER) {
         this.$initialize_control_block();
      }

      const { node_ptr } = this.$find_entry_node(key) ?? {};

      if (node_ptr) {
         logger.trace(`SET(update) key='${String(key)}'`);

         this.$free_value_in_node(node_ptr);
         this.$write_public_value_to_node(node_ptr, value, false);
      } else {
         logger.trace(`SET(insert) key='${String(key)}'`);

         if ((this.size + 1) / this.$capacity > MAX_LOAD_FACTOR) {
            this.$grow_and_rehash();
         }

         const new_node_ptr = this.__allocator.allocate(this.$entry_node_size, this.constructor as IViewConstructor, this.__owner_allocation_ptr);

         if (new_node_ptr === GLOBAL_NULL_POINTER) {
            throw new Error('out of memory');
         }

         const node_bytes = new Uint8Array(this.$allocator_buffer, new_node_ptr, this.$entry_node_size);
         node_bytes.fill(0);

         this.$insert_new_node(key, new_node_ptr);
         this.$write_public_value_to_node(new_node_ptr, value, true);
      }

      return this;
   }

   /**
    * deletes a key-value pair from the map
    * 
    * @param key - the key to delete
    */
   delete(
      key: K
   ): boolean {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      logger.trace(`DELETE(key='${key}')`);

      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return false;
      }

      const bucket_index = this.$hash_key(key) & (this.$capacity - 1);
      const buckets_ptr = this.$read_control_block_field(control_ptr, OFFSET_BUCKETS_PTR);

      let prev_node_ptr: Pointer | null = null;
      let current_node_ptr = this.$get_bucket_head_ptr(buckets_ptr, bucket_index);

      while (current_node_ptr !== GLOBAL_NULL_POINTER) {
         const key_ptr = this.$read_entry_node_field(current_node_ptr, 4);
         const key_view = this.$reconstruct_key_view(key_ptr);

         if (this.$are_keys_equal(key, key_view)) {
            const next_node_ptr = this.$read_entry_node_field(current_node_ptr, 0);

            if (prev_node_ptr) {
               this.$write_entry_node_field(prev_node_ptr, 0, next_node_ptr);
            } else {
               this.$set_bucket_head_ptr(buckets_ptr, bucket_index, next_node_ptr);
            }

            this.$free_key(key_view);
            this.$free_value_in_node(current_node_ptr);
            this.__allocator.free(current_node_ptr);
            this.$set_control_block_field(control_ptr, OFFSET_COUNT, this.size - 1);

            return true;
         }

         prev_node_ptr = current_node_ptr;
         current_node_ptr = this.$read_entry_node_field(current_node_ptr, 0);
      }

      return false;
   }

   /** removes all key-value pairs from the map */
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
            const next_node_ptr = this.$read_entry_node_field(current_node_ptr, 0);
            const key_ptr = this.$read_entry_node_field(current_node_ptr, 4);

            this.$free_key(this.$reconstruct_key_view(key_ptr));
            this.$free_value_in_node(current_node_ptr);
            this.__allocator.free(current_node_ptr);

            current_node_ptr = next_node_ptr;
         }

         this.$set_bucket_head_ptr(buckets_ptr, i, GLOBAL_NULL_POINTER);
      }

      this.$set_control_block_field(control_ptr, OFFSET_COUNT, 0);
   }

   *entries(): IterableIterator<[K, V_Public]> {
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
            const key_ptr = this.$read_entry_node_field(current_node_ptr, 4);
            const key_view = this.$reconstruct_key_view(key_ptr);
            const key = this.$get_key_from_view(key_view);
            const value = this.$read_public_value_from_node(current_node_ptr);

            yield [key, value];

            current_node_ptr = this.$read_entry_node_field(current_node_ptr, 0);
         }
      }
   }

   *keys(): IterableIterator<K> {
      for (const [key] of this.entries()) {
         yield key;
      }
   }

   *values(): IterableIterator<V_Public> {
      for (const [, value] of this.entries()) {
         yield value;
      }
   }

   *[Symbol.iterator](): IterableIterator<[K, V_Public]> {
      yield* this.entries();
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

   $copy_from(
      source: this | Map<K, V_Public>
   ): void {
      this.clear();

      for (const [key, value] of source.entries()) {
         this.set(key, value);
      }
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

   get $capacity(): number {
      const control_ptr = this.$control_block_ptr;

      if (control_ptr === GLOBAL_NULL_POINTER) {
         return 0;
      }

      return this.$read_control_block_field(control_ptr, OFFSET_CAPACITY_BUCKETS);
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
      const buckets_ptr = this.$read_control_block_field(control_ptr, OFFSET_BUCKETS_PTR);

      let prev_node_ptr: Pointer | null = null;
      let current_node_ptr = this.$get_bucket_head_ptr(buckets_ptr, bucket_index);

      while (current_node_ptr !== GLOBAL_NULL_POINTER) {
         const key_ptr = this.$read_entry_node_field(current_node_ptr, 4);
         const key_view = this.$reconstruct_key_view(key_ptr);

         if (this.$are_keys_equal(key, key_view)) {
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

   $initialize_control_block() {
      const control_ptr = this.__allocator.allocate(CONTROL_BLOCK_SIZE, this.constructor as IViewConstructor, this.__owner_allocation_ptr);
      const buckets_ptr = this.__allocator.allocate(INITIAL_CAPACITY_BUCKETS * POINTER_SIZE, this.constructor as IViewConstructor, this.__owner_allocation_ptr);

      if (
         control_ptr === GLOBAL_NULL_POINTER
         || buckets_ptr === GLOBAL_NULL_POINTER
      ) {
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
            const next_node_ptr = this.$read_entry_node_field(current_node_ptr, 0);
            const key_ptr = this.$read_entry_node_field(current_node_ptr, 4);
            const key_view = this.$reconstruct_key_view(key_ptr);
            const original_key = this.$get_key_from_view(key_view);
            const new_bucket_index = this.$hash_key(original_key) & (new_capacity - 1);

            if (this.$free_key !== DynamicHashMap.prototype.$free_key) {
               // no-op?
            }

            const new_head_ptr = this.$get_bucket_head_ptr(new_buckets_ptr, new_bucket_index);
            this.$write_entry_node_field(current_node_ptr, 0, new_head_ptr);
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
      const key_view = this.$allocate_key(key) as IView & { free(): void; $control_block_ptr: number };
      const key_ptr = key_view.$control_block_ptr ?? GLOBAL_NULL_POINTER;

      if (
         key_ptr === GLOBAL_NULL_POINTER &&
         String(key) !== ''
      ) {
         this.__allocator.free(new_node_ptr);

         throw new Error('out of memory allocating key for hash map');
      }

      const control_ptr = this.$control_block_ptr;
      const bucket_index = this.$hash_key(key) & (this.$capacity - 1);
      const buckets_ptr = this.$read_control_block_field(control_ptr, OFFSET_BUCKETS_PTR);
      const head_ptr = this.$get_bucket_head_ptr(buckets_ptr, bucket_index);

      this.$write_entry_node_field(new_node_ptr, 0, head_ptr);
      this.$write_entry_node_field(new_node_ptr, 4, key_ptr);
      this.$set_bucket_head_ptr(buckets_ptr, bucket_index, new_node_ptr);
      this.$set_control_block_field(control_ptr, OFFSET_COUNT, this.size + 1);
   }
}