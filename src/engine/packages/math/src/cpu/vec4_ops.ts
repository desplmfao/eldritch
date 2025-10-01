/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/src/cpu/vec4_ops.ts
 */

import { EPSILON } from '@self/common';

import { Vec4 } from '@self/cpu/vec4';
import type { Mat4 } from '@self/cpu/mat4';

/**
 * sets the components of a vec4 to the given values
 *
 * @param out - the receiving vector
 * @param x - component x
 * @param y - component y
 * @param z - component z
 * @param w - component w
 *
 * @returns `out`
 */
export function set(
   out: Vec4,
   x: number,
   y: number,
   z: number,
   w: number
): Vec4 {
   out.x = x;
   out.y = y;
   out.z = z;
   out.w = w;

   return out;
}

/**
 * adds two vec4's
 *
 * @param out - the receiving vector
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns `out`
 */
export function add(
   out: Vec4,
   a: Vec4,
   b: Vec4
): Vec4 {
   out.x = (a.x + b.x);
   out.y = (a.y + b.y);
   out.z = (a.z + b.z);
   out.w = (a.w + b.w);

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
   out: Vec4,
   a: Vec4,
   b: Vec4
): Vec4 {
   out.x = (a.x - b.x);
   out.y = (a.y - b.y);
   out.z = (a.z - b.z);
   out.w = (a.w - b.w);

   return out;
}

/**
 * multiplies two vec4's component-wise
 *
 * @param out - the receiving vector
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns `out`
 */
export function multiply(
   out: Vec4,
   a: Vec4,
   b: Vec4
): Vec4 {
   out.x = (a.x * b.x);
   out.y = (a.y * b.y);
   out.z = (a.z * b.z);
   out.w = (a.w * b.w);

   return out;
}

/**
 * divides two vec4's component-wise
 *
 * @param out - the receiving vector
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns `out`
 */
export function divide(
   out: Vec4,
   a: Vec4,
   b: Vec4
): Vec4 {
   out.x = (a.x / b.x);
   out.y = (a.y / b.y);
   out.z = (a.z / b.z);
   out.w = (a.w / b.w);

   return out;
}

/**
 * scales a vec4 by a scalar number
 *
 * @param out - the receiving vector
 * @param a - the vector to scale
 * @param s - amount to scale the vector by
 *
 * @returns `out`
 */
export function scale(
   out: Vec4,
   a: Vec4,
   s: number
): Vec4 {
   out.x = (a.x * s);
   out.y = (a.y * s);
   out.z = (a.z * s);
   out.w = (a.w * s);

   return out;
}

/**
 * calculates the dot product of two vec4's
 *
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns dot product of a and b
 */
export function dot(
   a: Vec4,
   b: Vec4
): number {
   return (
      a.x * b.x
      + a.y * b.y
      + a.z * b.z
      + a.w * b.w
   );
}

/**
 * calculates the length of a vec4
 *
 * @param a - the vector to calculate length of
 *
 * @returns length of a
 */
export function length(
   a: Vec4
): number {
   const x = a.x;
   const y = a.y;
   const z = a.z;
   const w = a.w;

   return Math.sqrt(
      x * x
      + y * y
      + z * z
      + w * w
   );
}

/**
 * calculates the squared length of a vec4
 *
 * @param a - vector to calculate squared length of
 *
 * @returns squared length of a
 */
export function length_sq(
   a: Vec4
): number {
   const x = a.x;
   const y = a.y;
   const z = a.z;
   const w = a.w;

   return (
      x * x
      + y * y
      + z * z
      + w * w
   );
}

/**
 * calculates the distance between two vec4's
 *
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns distance between a and b
 */
export function distance(
   a: Vec4,
   b: Vec4
): number {
   const x = b.x - a.x;
   const y = b.y - a.y;
   const z = b.z - a.z;
   const w = b.w - a.w;

   return Math.sqrt(
      x * x
      + y * y
      + z * z
      + w * w
   );
}

/**
 * calculates the squared distance between two vec4's
 *
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns squared distance between a and b
 */
export function distance_sq(
   a: Vec4,
   b: Vec4
): number {
   const x = b.x - a.x;
   const y = b.y - a.y;
   const z = b.z - a.z;
   const w = b.w - a.w;

   return (
      x * x
      + y * y
      + z * z
      + w * w
   );
}

/**
 * normalizes a vec4
 *
 * @param out - the receiving vector
 * @param a - the vector to normalize
 *
 * @returns `out`
 */
export function normalize(
   out: Vec4,
   a: Vec4
): Vec4 {
   const len = length(a);

   if (len > 0) {
      const inv_len = 1 / len;

      out.x = (a.x * inv_len);
      out.y = (a.y * inv_len);
      out.z = (a.z * inv_len);
      out.w = (a.w * inv_len);
   }

   return out;
}

/**
 * negates the components of a vec4
 *
 * @param out - the receiving vector
 * @param a - the vector to negate
 *
 * @returns `out`
 */
export function negate(
   out: Vec4,
   a: Vec4
): Vec4 {
   out.x = -a.x;
   out.y = -a.y;
   out.z = -a.z;
   out.w = -a.w;

   return out;
}

/**
 * copies the values from one vec4 to another
 *
 * @param out - the receiving vector
 * @param a - the source vector
 *
 * @returns `out`
 */
export function copy(
   out: Vec4,
   a: Vec4
): Vec4 {
   out.x = a.x;
   out.y = a.y;
   out.z = a.z;
   out.w = a.w;

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
   a: Vec4,
   b: Vec4
): boolean {
   return (
      Math.abs(a.x - b.x) <= EPSILON * Math.max(1.0, Math.abs(a.x), Math.abs(b.x))
      && Math.abs(a.y - b.y) <= EPSILON * Math.max(1.0, Math.abs(a.y), Math.abs(b.y))
      && Math.abs(a.z - b.z) <= EPSILON * Math.max(1.0, Math.abs(a.z), Math.abs(b.z))
      && Math.abs(a.w - b.w) <= EPSILON * Math.max(1.0, Math.abs(a.w), Math.abs(b.w))
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
   a: Vec4,
   b: Vec4
): boolean {
   return (
      a.x === b.x
      && a.y === b.y
      && a.z === b.z
      && a.w === b.w
   );
}

/**
 * performs a linear interpolation between two vec4's
 *
 * @param out - the receiving vector
 * @param a - the first operand
 * @param b - the second operand
 * @param t - interpolation amount, in the range [0-1]
 *
 * @returns `out`
 */
export function lerp(
   out: Vec4,
   a: Vec4,
   b: Vec4,
   t: number
): Vec4 {
   out.x = (a.x + t * (b.x - a.x));
   out.y = (a.y + t * (b.y - a.y));
   out.z = (a.z + t * (b.z - a.z));
   out.w = (a.w + t * (b.w - a.w));

   return out;
}

/**
 * transforms the vec4 with a mat4
 *
 * @param out - the receiving vector
 * @param v - the vector to transform
 * @param m - matrix to transform with
 *
 * @returns `out`
 */
export function transform_mat4(
   out: Vec4,
   v: Vec4,
   m: Mat4
): Vec4 {
   const x = v.x;
   const y = v.y;
   const z = v.z;
   const w = v.w;

   out.x = (m[0]! * x + m[4]! * y + m[8]! * z + m[12]! * w);
   out.y = (m[1]! * x + m[5]! * y + m[9]! * z + m[13]! * w);
   out.z = (m[2]! * x + m[6]! * y + m[10]! * z + m[14]! * w);
   out.w = (m[3]! * x + m[7]! * y + m[11]! * z + m[15]! * w);

   return out;
}