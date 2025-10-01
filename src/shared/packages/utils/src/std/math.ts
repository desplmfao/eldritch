/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/math.ts
 */

/**
 * constrains a value within the inclusive range [min, max]
 *
 * @param value - the number to clamp
 * @param min - the minimum allowed value
 * @param max - the maximum allowed value
 */
export function clamp(value: number, min: number, max: number): number {
   return Math.max(min, Math.min(value, max));
}

/**
 * linearly interpolates between two values
 *
 * @param a - the starting value
 * @param b - the ending value
 * @param t - the interpolation factor (0.0 to 1.0)
 */
export function lerp(a: number, b: number, t: number): number {
   return a + t * (b - a);
}

/**
 * maps a value from one range to another range
 *
 * @param value - the value to map
 * @param in_min - the minimum of the input range
 * @param in_max - the maximum of the input range
 * @param out_min - the minimum of the output range
 * @param out_max - the maximum of the output range
 */
export function map_range(value: number, in_min: number, in_max: number, out_min: number, out_max: number): number {
   const dividend: number = out_max - out_min;
   const divisor: number = in_max - in_min;

   if (divisor === 0) {
      throw new Error('input range cannot have zero length (in_min === in_max)');
   }

   const mapped: number = dividend * (value - in_min) / divisor + out_min;

   return clamp(mapped, Math.min(out_min, out_max), Math.max(out_min, out_max));
}

/**
 * generates a random integer within the inclusive range [min, max]
 *
 * @param min - the minimum possible integer value
 * @param max - the maximum possible integer value
 */
export function random_int(min: number, max: number): number {
   const min_int: number = Math.ceil(min);
   const max_int: number = Math.floor(max);

   return Math.floor(Math.random() * (max_int - min_int + 1)) + min_int;
}

/**
 * generates a random floating-point number within the range [min, max)
 * (inclusive of min, exclusive of max)
 *
 * @param min - the minimum possible float value
 * @param max - the maximum possible float value (exclusive)
 */
export function random_float(min: number, max: number): number {
   return Math.random() * (max - min) + min;
}

/**
 * checks if two floating-point numbers are approximately equal within a given tolerance
 *
 * @param a - the first number
 * @param b - the second number
 * @param epsilon - the tolerance for equality comparison (defaults to 1e-6)
 */
export function approximately_equal(a: number, b: number, epsilon: number = 1e-6): boolean {
   return Math.abs(a - b) < epsilon;
}

export const DEG_TO_RAD: number = Math.PI / 180;
export const RAD_TO_DEG: number = 180 / Math.PI;