/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/src/cpu/lib/utils.ts
 */

import { EPSILON } from '@self/common';

/**
 * convert degrees to radians
 *
 * @param degrees - angle in degrees
 *
 * @returns angle converted to radians
 */
export function degrees_to_radians(
   degrees: number
): number {
   return degrees * Math.PI / 180;
}

/**
 * convert radians to degrees
 *
 * @param radians - angle in radians
 *
 * @returns angle converted to degrees
 */
export function radians_to_degrees(
   radians: number
): number {
   return radians * 180 / Math.PI;
}

/**
 * lerps between a and b via t
 *
 * @param a - starting value
 * @param b - ending value
 * @param t - value where 0 = a and 1 = b
 *
 * @returns a + (b - a) * t
 */
export function lerp(
   a: number,
   b: number,
   t: number
): number {
   return a + (b - a) * t;
}

/**
 * compute the opposite of lerp. Given a and b and a value between a and b returns a value between 0 and 1
 * 
 * 0 if a, 1 if b
 *
 * note: no clamping is done
 *
 * @param a - start value
 * @param b - end value
 * @param v - value between a and b
 *
 * @returns (v - a) / (b - a)
 */
export function lerp_inverse(
   a: number,
   b: number,
   v: number
): number {
   const d = b - a;

   return (Math.abs(b - a) < EPSILON)
      ? a
      : (v - a) / d;
}

/**
 * compute the euclidean modulo
 *
 * @param n - dividend
 * @param m - divisor
 *
 * @returns the euclidean modulo of n / m
 */
export function euclidean_modulo(
   n: number,
   m: number
) {
   return ((n % m) + m) % m;
}