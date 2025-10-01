/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-primitive-string.ts
 */

import type { IView, IViewConstructor, Pointer } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicHashMapPrimitive } from '@self/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-primitive';
import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';
import type { PrimitiveView } from '@self/runtime/skeletons/fixed/fixed-primitive';

export abstract class DynamicHashMapPrimitiveString<
   K_Public extends number | bigint | boolean,
   K_Internal extends PrimitiveView<K_Public>
> extends DynamicHashMapPrimitive<K_Public, K_Internal, DynamicString, string> {

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
      //
      key_constructor: IViewConstructor<K_Internal>,
      value_constructor: IViewConstructor<DynamicString>,
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
         key_constructor,
         value_constructor,
         //
         owner_constructor,
         owner_allocation_ptr,
         //
         is_new_instance
      );
   }

   get $entry_node_value_offset(): number {
      const key_end_offset = this.$entry_node_key_offset + this.$key_size;
      const alignment = Math.max(this.__value_schema.alignment, POINTER_SIZE);

      return (key_end_offset + (alignment - 1)) & ~(alignment - 1);
   }

   get $entry_node_size(): number {
      const base_size = this.$entry_node_value_offset + this.__value_schema.total_size;
      const alignment = Math.max(this.$key_alignment, this.__value_schema.alignment, POINTER_SIZE);

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