/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-string-primitive.ts
 */

import type { IView, IViewConstructor, Pointer } from '@eldritch-engine/type-utils/guerrero/index';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicHashMapString } from '@self/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-string';
import type { PrimitiveView } from '@self/runtime/skeletons/fixed/fixed-primitive';

export abstract class DynamicHashMapStringPrimitive<
   V_Public extends number | bigint | boolean,
   V_Internal extends PrimitiveView<V_Public>
> extends DynamicHashMapString<V_Internal, V_Public> {

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
   }

   abstract get $value_size(): number;
   abstract get $value_alignment(): number;

   abstract $read_value(
      buffer: DataView,
      offset: Pointer
   ): V_Public;

   abstract $write_value(
      buffer: DataView,
      offset: Pointer,
      value: V_Public
   ): void;

   get $entry_node_value_offset(): number {
      return POINTER_SIZE + POINTER_SIZE;
   }

   get $entry_node_size(): number {
      const base_size = this.$entry_node_value_offset + this.$value_size;
      const alignment = Math.max(this.$value_alignment, POINTER_SIZE);

      return (base_size + (alignment - 1)) & ~(alignment - 1);
   }

   $read_public_value_from_node(
      node_ptr: Pointer
   ): V_Public {
      const value_offset_in_pool = node_ptr + this.$entry_node_value_offset;
      const view = new DataView(this.__allocator.buffer);

      return this.$read_value(view, value_offset_in_pool);
   }

   $write_public_value_to_node(
      node_ptr: Pointer,
      value: V_Public,
      //
      is_new_instance: boolean = false
   ): void {
      const value_offset_in_pool = node_ptr + this.$entry_node_value_offset;
      const view = new DataView(this.__allocator.buffer);

      this.$write_value(view, value_offset_in_pool, value);
   }

   $get_internal_value_view_from_node(
      node_ptr: Pointer,
      //
      is_new_instance: boolean = false
   ): V_Internal {
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

   $free_value_in_node(
      node_ptr: Pointer
   ): void {
      /* no-op */
   };
}