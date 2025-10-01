/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/codegen/constants.ts
 */

export const IMPORT_MAP: ReadonlyMap<string, string> = new Map([
   ['PrimitiveView', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/fixed/fixed-primitive'],
   //
   ['FixedArray', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/fixed/array/fixed-array'],
   ['FixedArrayOf', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/fixed/array/fixed-array-of'],
   ['FixedArrayPrimitive', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/fixed/array/fixed-array-primitive'],
   ['FixedArrayString', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/fixed/array/fixed-array-string'],
   //
   ['DynamicString', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/dynamic-string'],
   //
   ['DynamicArray', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/array/dynamic-array'],
   ['DynamicArrayOf', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/array/dynamic-array-of'],
   ['DynamicArrayPrimitive', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/array/dynamic-array-primitive'],
   ['DynamicArrayString', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/array/dynamic-array-string'],
   //
   ['DynamicHashMapStringOf', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-string-of'],
   ['DynamicHashMapStringPrimitive', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-string-primitive'],
   ['DynamicHashMapStringString', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-string-string'],
   ['DynamicHashMapPrimitiveOf', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-primitive-of'],
   ['DynamicHashMapPrimitiveString', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-primitive-string'],
   ['DynamicHashMapPrimitivePrimitive', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/hashmap/dynamic-hashmap-primitive-primitive'],
   //
   ['DynamicSet', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/set/dynamic-set'],
   ['DynamicSetOf', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/set/dynamic-set-of'],
   ['DynamicSetString', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/set/dynamic-set-string'],
   ['DynamicSetPrimitive', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/set/dynamic-set-primitive'],
   //
   ['DynamicSparseSet', '@eldritch-engine/guerrero-core-strategy-aos/runtime/skeletons/dynamic/dynamic-sparseset'],
]);