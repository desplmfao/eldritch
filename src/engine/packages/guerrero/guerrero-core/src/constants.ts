/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/constants.ts
 */

export const IMPORT_MAP: ReadonlyMap<string, string> = new Map([
   ['IView', '@eldritch-engine/type-utils/guerrero/index'],
   ['IViewConstructor', '@eldritch-engine/type-utils/guerrero/index'],
   ['SchemaLayout', '@eldritch-engine/type-utils/guerrero/index'],
   ['PropertyLayout', '@eldritch-engine/type-utils/guerrero/index'],
   ['Pointer', '@eldritch-engine/type-utils/guerrero/index'],
   ['IHashable', '@eldritch-engine/type-utils/guerrero/index'],
   //
   ['TlsfAllocator', '@eldritch-engine/guerrero-core/runtime/allocator/allocator'],
   ['LITTLE_ENDIAN', '@eldritch-engine/guerrero-core/runtime/allocator/constants'],
   ['GLOBAL_NULL_POINTER', '@eldritch-engine/guerrero-core/runtime/allocator/constants'],
   ['POINTER_SIZE', '@eldritch-engine/guerrero-core/runtime/allocator/constants'],
   //
   ['IGuerreroFixedArray', '@eldritch-engine/type-utils/guerrero/interfaces'],
   ['IGuerreroArray', '@eldritch-engine/type-utils/guerrero/interfaces'],
   //
   ['hash_djb2', '@eldritch-engine/utils/hash'],
]);