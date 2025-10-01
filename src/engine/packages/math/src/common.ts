/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/src/common.ts
 */

export let EPSILON = 0.000001;

/**
 * set the value for EPSILON for various checks
 *
 * @param v - value to use for EPSILON
 *
 * @returns previous value of EPSILON
 */
export function set_epsilon(
   v: number
): number {
   const old = EPSILON;

   EPSILON = v;

   return old;
}