/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/dynamic/dynamic-string.ts
 */

import { default_logger } from '@eldritch-engine/logger/logger';

import type { Pointer, IView, SchemaLayout, IViewConstructor, MetadataProperty } from '@eldritch-engine/type-utils/guerrero/index';

import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { LITTLE_ENDIAN, GLOBAL_NULL_POINTER } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

import { GUERRERO_SCHEMA_PLACEHOLDER } from '@eldritch-engine/guerrero-core/runtime/placeholder';

const text_encoder = new TextEncoder();
const text_decoder = new TextDecoder();

@Reflectable()
export class DynamicString implements IView {

   static readonly __schema: SchemaLayout = GUERRERO_SCHEMA_PLACEHOLDER;

   static readonly __schema_props: MetadataProperty[] = [
      {
         property_key: 'value',
         order: 0,
         type: 'str',
      }
   ];

   readonly __view: DataView;
   readonly __buffer: ArrayBufferLike;
   readonly __byte_offset: Pointer;
   readonly __allocator: TlsfAllocator;

   readonly __owner_constructor?: IViewConstructor<IView>;
   readonly __owner_allocation_ptr?: Pointer;

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
      if ((byte_offset % DynamicString.__schema.alignment) !== 0) {
         throw new Error(`${DynamicString.__schema.class_ctor?.name} byte_offset ${byte_offset} is not aligned to ${DynamicString.__schema.alignment}`);
      }
      /// #endif

      this.__buffer = buffer;
      this.__byte_offset = byte_offset;
      this.__allocator = allocator;
      this.__view = new DataView(buffer);

      this.__owner_constructor = owner_constructor;
      this.__owner_allocation_ptr = owner_allocation_ptr;
   }

   get $control_block_ptr(): Pointer {
      const prop_layout = DynamicString.__schema.properties[0]!;

      return this.__view.getUint32(this.__byte_offset + prop_layout.offset, LITTLE_ENDIAN);
   }

   set $control_block_ptr(value: Pointer) {
      const prop_layout = DynamicString.__schema.properties[0]!;

      this.__view.setUint32(this.__byte_offset + prop_layout.offset, value, LITTLE_ENDIAN);
   }

   get value(): string {
      const data_ptr = this.$control_block_ptr;

      if (data_ptr === GLOBAL_NULL_POINTER) {
         return '';
      }

      const string_data_buffer = this.__allocator.buffer;
      const string_data_view = new DataView(string_data_buffer);

      const length = string_data_view.getUint32(data_ptr, LITTLE_ENDIAN);

      if (length === 0) {
         return '';
      }

      const string_bytes = new Uint8Array(string_data_buffer, data_ptr + 4, length);

      return text_decoder.decode(string_bytes);
   }

   set value(
      str: string
   ) {
      const logger = default_logger.get_namespaced_logger('<namespace>');

      const current_data_ptr = this.$control_block_ptr;

      let required_payload_size: number;
      let encoded_bytes: Uint8Array | null = null;

      logger.trace(`set value (str.length=${str.length}) on view @${this.__byte_offset}. current_ptr=${current_data_ptr}`);

      if (str === '') {
         required_payload_size = 0;
      } else {
         encoded_bytes = text_encoder.encode(str);
         required_payload_size = 4 + encoded_bytes.byteLength;
      }

      let new_data_ptr: Pointer;

      if (current_data_ptr === GLOBAL_NULL_POINTER) {
         if (required_payload_size > 0) {
            new_data_ptr = this.__allocator.allocate(required_payload_size, this.constructor as IViewConstructor, this.__owner_allocation_ptr);
         } else {
            new_data_ptr = GLOBAL_NULL_POINTER;
         }
      } else {
         if (required_payload_size > 0) {
            new_data_ptr = this.__allocator.reallocate(current_data_ptr, required_payload_size, this.constructor as IViewConstructor, this.__owner_allocation_ptr);
         } else {
            this.__allocator.free(current_data_ptr);
            new_data_ptr = GLOBAL_NULL_POINTER;
         }
      }

      logger.trace(`   -> new_ptr=${new_data_ptr}`);

      this.$control_block_ptr = new_data_ptr;

      if (
         new_data_ptr !== GLOBAL_NULL_POINTER
         && required_payload_size > 0
      ) {
         const string_data_buffer = this.__allocator.buffer;
         const string_data_view = new DataView(string_data_buffer);

         if (encoded_bytes) {
            string_data_view.setUint32(new_data_ptr, encoded_bytes.byteLength, LITTLE_ENDIAN);

            const dest_array = new Uint8Array(string_data_buffer, new_data_ptr + 4, encoded_bytes.byteLength);

            dest_array.set(encoded_bytes);
         } else {
            string_data_view.setUint32(new_data_ptr, 0, LITTLE_ENDIAN);
         }
      }
   }

   $copy_from(
      source: this
   ): void {
      this.value = source.value;
   }

   free(): void {
      const current_data_ptr = this.$control_block_ptr;

      if (current_data_ptr !== GLOBAL_NULL_POINTER) {
         this.__allocator.free(current_data_ptr);
         this.$control_block_ptr = GLOBAL_NULL_POINTER;
      }
   }
}