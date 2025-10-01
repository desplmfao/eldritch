/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/runtime/allocator/bit_utils.ts
 */

/**
 * simulates `ffs(word) - 1` from gcc
 * 
 * find first set bit: returns the index (0-31) of the least significant set bit
 *
 * `word & (~word + 1)` isolates the least significant bit (equivalent to `word & -word` in 2's complement)
 * 
 * `Math.clz32` counts leading zeros. for a power of 2, `31 - Math.clz32(power_of_2)` gives its index
 * 
 * @returns -1 if no bit is set (word is 0)
 */
export function tlsf_ffs(word: number): number {
   if (word === 0) {
      return -1;
   }

   const lsb = word & -word;

   return 31 - Math.clz32(lsb);
}

/**
 * simulates `(word ? 32 - __builtin_clz(word) : 0) - 1` from gcc
 * 
 * find last set bit: returns the index (0-31) of the most significant set bit
 * 
 * @returns -1 if no bit is set (word is 0)
 */
export function tlsf_fls(word: number): number {
   if (word === 0) {
      return -1;
   }

   return 31 - Math.clz32(word);
}

/**
 * corresponds to tlsf_fls_sizet for 32-bit size_t
 * 
 * in js, numbers are typically 64-bit floats, but for bitwise operations they are treated as 32-bit integers. `Math.clz32` operates on 32-bit unsigned integers
 * 
 * if we needed to handle true 64-bit integers for `size`, we'd use `BigInt` and a different `fls` implementation
 * 
 * for now, we just assume `size` fits 32-bit unsigned values
 */
export function tlsf_fls_sizet(size: number): number {
   return tlsf_fls(size);
}