/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/hash.ts
 */

export const FNV_OFFSET_BASIS: number = 0x811c9dc5;
export const FNV_PRIME: number = 0x01000193;

/**
 * calculates fnv-1a 32-bit hash of a string
 */
export function hash_fnv1a(str: string): number {
   let hash: number = FNV_OFFSET_BASIS;

   for (let i: number = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, FNV_PRIME);
   }

   return hash;
}

/**
 * formats the hash into a short string (base 36)
 */
export function format_hash(hash: number): string {
   return `${(hash >>> 0).toString(36)}`;
}

export function hash_djb2(str: string): number {
   let hash = 5381;

   for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
   }

   return hash >>> 0;
}