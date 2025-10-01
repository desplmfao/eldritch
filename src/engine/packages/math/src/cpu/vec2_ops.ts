/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/src/cpu/vec2_ops.ts
 */

import { EPSILON } from '@self/common';

import { Vec2 } from '@self/cpu/vec2';
import type { Mat3 } from '@self/cpu/mat3';

/**
 * sets the components of a vec2 to the given values
 *
 * @param out - the receiving vector
 * @param x - component x
 * @param y - component y
 *
 * @returns `out`
 */
export function set(
   out: Vec2,
   x: number,
   y: number,
): Vec2 {
   out.x = x;
   out.y = y;

   return out;
}

/**
 * adds two vec2's
 *
 * @param out - the receiving vector
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns `out`
 */
export function add(
   out: Vec2,
   a: Vec2,
   b: Vec2
): Vec2 {
   out.x = (a.x + b.x);
   out.y = (a.y + b.y);

   return out;
}

/**
 * subtracts vector b from vector a
 *
 * @param out - the receiving vector
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns `out`
 */
export function subtract(
   out: Vec2,
   a: Vec2,
   b: Vec2
): Vec2 {
   out.x = (a.x - b.x);
   out.y = (a.y - b.y);

   return out;
}

/**
 * multiplies two vec2's component-wise
 *
 * @param out - the receiving vector
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns `out`
 */
export function multiply(
   out: Vec2,
   a: Vec2,
   b: Vec2
): Vec2 {
   out.x = (a.x * b.x);
   out.y = (a.y * b.y);

   return out;
}

/**
 * divides two vec2's component-wise
 *
 * @param out - the receiving vector
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns `out`
 */
export function divide(
   out: Vec2,
   a: Vec2,
   b: Vec2
): Vec2 {
   out.x = (a.x / b.x);
   out.y = (a.y / b.y);

   return out;
}

/**
 * scales a vec2 by a scalar number
 *
 * @param out - the receiving vector
 * @param a - the vector to scale
 * @param s - amount to scale the vector by
 *
 * @returns `out`
 */
export function scale(
   out: Vec2,
   a: Vec2,
   s: number
): Vec2 {
   out.x = (a.x * s);
   out.y = (a.y * s);

   return out;
}

/**
 * calculates the dot product of two vec2's
 *
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns dot product of a and b
 */
export function dot(
   a: Vec2,
   b: Vec2
): number {
   return (
      a.x * b.x
      + a.y * b.y
   );
}

/**
 * calculates the length of a vec2
 *
 * @param a - the vector to calculate length of
 *
 * @returns length of a
 */
export function length(
   a: Vec2
): number {
   const x = a.x;
   const y = a.y;

   return Math.sqrt(
      x * x
      + y * y
   );
}

/**
 * calculates the squared length of a vec2
 *
 * @param a - vector to calculate squared length of
 *
 * @returns squared length of a
 */
export function length_sq(
   a: Vec2
): number {
   const x = a.x;
   const y = a.y;

   return (
      x * x
      + y * y
   );
}

/**
 * calculates the distance between two vec2's
 *
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns distance between a and b
 */
export function distance(
   a: Vec2,
   b: Vec2
): number {
   const x = b.x - a.x;
   const y = b.y - a.y;

   return Math.sqrt(
      x * x
      + y * y
   );
}

/**
 * calculates the squared distance between two vec2's
 *
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns squared distance between a and b
 */
export function distance_sq(
   a: Vec2,
   b: Vec2
): number {
   const x = b.x - a.x;
   const y = b.y - a.y;

   return x * x
      + y * y;
}

/**
 * normalizes a vec2
 *
 * @param out - the receiving vector
 * @param a - the vector to normalize
 *
 * @returns `out`
 */
export function normalize(
   out: Vec2,
   a: Vec2
): Vec2 {
   const len = length(a);

   if (len > 0) {
      const inv_len = 1 / len;

      out.x = (a.x * inv_len);
      out.y = (a.y * inv_len);
   }

   return out;
}

/**
 * negates the components of a vec2
 *
 * @param out - the receiving vector
 * @param a - the vector to negate
 *
 * @returns `out`
 */
export function negate(
   out: Vec2,
   a: Vec2
): Vec2 {
   out.x = -a.x;
   out.y = -a.y;

   return out;
}

/**
 * copies the values from one vec2 to another
 *
 * @param out - the receiving vector
 * @param a - the source vector
 *
 * @returns `out`
 */
export function copy(
   out: Vec2,
   a: Vec2
): Vec2 {
   out.x = a.x;
   out.y = a.y;

   return out;
}

/**
 * returns whether or not the vectors have approximately the same elements
 *
 * @param a - the first vector
 * @param b - the second vector
 *
 * @returns true if the vectors are approximately equal
 */
export function equals_approximately(
   a: Vec2,
   b: Vec2
): boolean {
   return (
      Math.abs(a.x - b.x) <= EPSILON * Math.max(1.0, Math.abs(a.x), Math.abs(b.x))
      && Math.abs(a.y - b.y) <= EPSILON * Math.max(1.0, Math.abs(a.y), Math.abs(b.y))
   );
}

/**
 * returns whether or not the vectors have exactly the same elements
 *
 * @param a - the first vector
 * @param b - the second vector
 *
 * @returns true if the vectors are equal
 */
export function equals(
   a: Vec2,
   b: Vec2
): boolean {
   return (
      a.x === b.x
      && a.y === b.y
   );
}

/**
 * performs a linear interpolation between two vec2's
 *
 * @param out - the receiving vector
 * @param a - the first operand
 * @param b - the second operand
 * @param t - interpolation amount, in the range [0-1]
 *
 * @returns `out`
 */
export function lerp(
   out: Vec2,
   a: Vec2,
   b: Vec2,
   t: number
): Vec2 {
   out.x = (a.x + t * (b.x - a.x));
   out.y = (a.y + t * (b.y - a.y));

   return out;
}

/**
 * transforms the vec2 with a mat3
 * (2x3 transformation matrix)
 *
 * @param out - the receiving vector
 * @param v - the vector to transform
 * @param m - matrix to transform with
 *
 * @returns `out`
 */
export function transform_mat3(
   out: Vec2,
   v: Vec2,
   m: Mat3
): Vec2 {
   const x = v.x;
   const y = v.y;

   out.x = (m[0] * x + m[3] * y + m[6]);
   out.y = (m[1] * x + m[4] * y + m[7]);

   return out;
}