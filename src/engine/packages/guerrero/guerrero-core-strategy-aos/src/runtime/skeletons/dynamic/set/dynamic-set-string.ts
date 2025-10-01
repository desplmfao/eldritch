/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/set/dynamic-set-string.ts
 */

import type { IView, IViewConstructor, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import { hash_djb2 } from '@eldritch-engine/utils/hash';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { GUERRERO_SCHEMA_PLACEHOLDER } from '@eldritch-engine/guerrero-core/runtime/placeholder';

import { DynamicSet } from '@self/runtime/skeletons/dynamic/set/dynamic-set';
import { DynamicString } from '@self/runtime/skeletons/dynamic/dynamic-string';

export class DynamicSetString extends DynamicSet<string, DynamicString> {

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
      /// #if SAFETY
      if ((byte_offset % DynamicSetString.__schema.alignment) !== 0) {
         throw new Error(`${DynamicSetString.__schema.class_ctor?.name} byte_offset ${byte_offset} is not aligned to ${DynamicSetString.__schema.alignment}`);
      }
      /// #endif

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

   $hash_key(
      key: string
   ): number {
      return hash_djb2(key);
   }

   $allocate_key(
      key: string
   ): DynamicString {
      const temp_key_storage_buffer = new ArrayBuffer(POINTER_SIZE);
      const key_view = new DynamicString(temp_key_storage_buffer, 0, this.__allocator);

      key_view.value = key;

      return key_view;
   }

   $free_key(
      key_view: DynamicString
   ): void {
      return key_view.free();
   };

   $are_keys_equal(
      key1: string,
      key2_view: DynamicString
   ): boolean {
      return key1 === key2_view.value;
   };

   $get_key_from_view(
      key_view: DynamicString
   ): string {
      return key_view.value;
   };

   $reconstruct_key_view(
      key_ptr: Pointer
   ): DynamicString {
      const temp_key_storage_buffer = new ArrayBuffer(POINTER_SIZE);
      const view = new DynamicString(temp_key_storage_buffer, 0, this.__allocator);

      view.$control_block_ptr = key_ptr;

      return view;
   }

   override $copy_from(
      source: this | Set<string>
   ): void {
      this.clear();

      for (const value of source.values()) {
         this.add(value);
      }
   }
}