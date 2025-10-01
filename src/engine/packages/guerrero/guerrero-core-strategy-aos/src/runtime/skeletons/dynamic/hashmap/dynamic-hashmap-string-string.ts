/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-string-string.ts
 */

import type { IView, IViewConstructor, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { GUERRERO_SCHEMA_PLACEHOLDER } from '@eldritch-engine/guerrero-core/runtime/placeholder';

import { DynamicHashMapString } from '@self/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-string';
import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';

//
//

export class DynamicHashMapStringString extends DynamicHashMapString<DynamicString, string> {

   static override readonly __schema: SchemaLayout = GUERRERO_SCHEMA_PLACEHOLDER;

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
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
         DynamicString,
         //
         owner_constructor,
         owner_allocation_ptr,
         //
         is_new_instance
      );
   }

   override set(
      key: string,
      value: string
   ): this {
      return super.set(key, value);
   }

   override emplace(
      key: string
   ): DynamicString {
      return super.emplace(key);
   }

   override $copy_from(
      source: this | Map<string, string>
   ): void {
      this.clear();

      for (const [key, value] of source.entries()) {
         this.set(key, value);
      }
   }

   get $entry_node_value_offset(): number {
      return POINTER_SIZE + POINTER_SIZE;
   }

   get $entry_node_size(): number {
      const base_size = this.$entry_node_value_offset + this.__value_schema.total_size;
      const alignment = Math.max(this.__value_schema.alignment, POINTER_SIZE);

      return (base_size + (alignment - 1)) & ~(alignment - 1);
   }

   $read_public_value_from_node(
      node_ptr: Pointer
   ): string {
      const view = this.$get_internal_value_view_from_node(node_ptr);

      return view.value;
   }

   $get_internal_value_view_from_node(
      node_ptr: Pointer,
      //
      is_new_instance: boolean = false
   ): DynamicString {
      const value_offset_in_pool = node_ptr + this.$entry_node_value_offset;
      const data_buffer = this.__allocator.buffer;

      return new this.__value_constructor(
         data_buffer,
         value_offset_in_pool,
         this.__allocator,
         //
         undefined,
         undefined,
         //
         is_new_instance
      );

   }

   $write_public_value_to_node(
      node_ptr: Pointer,
      value: string,
      //
      is_new_instance: boolean = false
   ): void {
      const dest_view = this.$get_internal_value_view_from_node(node_ptr, is_new_instance);

      dest_view.value = value;
   }

   $free_value_in_node(
      node_ptr: Pointer
   ): void {
      const value_view = this.$get_internal_value_view_from_node(node_ptr);

      value_view.free();
   }
}