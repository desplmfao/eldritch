/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-string.ts
 */

import type { IView, IViewConstructor, Pointer } from '@eldritch-engine/type-utils/guerrero/index';

import { hash_djb2 } from '@eldritch-engine/utils/hash';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { DynamicHashMap } from '@self/runtime/skeletons/dynamic/hashmap/dynamic-hashmap';
import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';

export abstract class DynamicHashMapString<
   V_Internal extends IView,
   V_Public
> extends DynamicHashMap<string, V_Internal, V_Public> {

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

   override $hash_key(
      key: string
   ): number {
      return hash_djb2(key);
   }

   override $allocate_key(
      key: string
   ): DynamicString {
      const temp_key_storage_buffer = new ArrayBuffer(POINTER_SIZE);
      const key_view = new DynamicString(temp_key_storage_buffer, 0, this.__allocator);
      key_view.value = key;

      return key_view;
   }

   override $free_key(
      key_view: DynamicString
   ): void {
      key_view.free();
   }

   override $are_keys_equal(
      key1: string,
      key2_view: DynamicString
   ): boolean {
      return key1 === key2_view.value;
   }

   override $get_key_from_view(
      key_view: DynamicString
   ): string {
      return key_view.value;
   }

   override $reconstruct_key_view(
      key_ptr: Pointer
   ): DynamicString {
      const temp_key_storage_buffer = new ArrayBuffer(POINTER_SIZE);
      const view = new DynamicString(temp_key_storage_buffer, 0, this.__allocator);

      view.$control_block_ptr = key_ptr;

      return view;
   }
}