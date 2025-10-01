/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/runtime/skeletons/fixed/fixed-primitive.ts
 */

import type { IView, IViewConstructor, Pointer, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';

import type { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

export class PrimitiveView<T extends number | bigint | boolean> implements IView {

   static __schema: SchemaLayout;

   readonly __view: DataView;
   readonly __buffer: ArrayBufferLike;
   readonly __byte_offset: Pointer;
   readonly __allocator?: TlsfAllocator;

   readonly __owner_constructor?: IViewConstructor<IView>;
   readonly __owner_allocation_ptr?: Pointer;

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator?: TlsfAllocator,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer,
      //
      is_new_instance: boolean = false
   ) {
      this.__buffer = buffer;
      this.__byte_offset = byte_offset;
      this.__allocator = allocator;
      this.__view = new DataView(buffer);

      this.__owner_constructor = owner_constructor;
      this.__owner_allocation_ptr = owner_allocation_ptr;
   }

   get value(): T {
      throw new Error('not implemented');
   }

   set value(v: T) {
      throw new Error('not implemented');
   }
}