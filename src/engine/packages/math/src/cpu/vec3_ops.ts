/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/src/cpu/vec3_ops.ts
 */

import { EPSILON } from '@self/common';

import type { Mat3 } from '@self/cpu/mat3';
import type { Quat } from '@self/cpu/quat';
import { Vec3 } from '@self/cpu/vec3';

/**
 * sets the components of a vec3 to the given values
 *
 * @param out - the receiving vector
 * @param x - component x
 * @param y - component y
 * @param z - component z
 *
 * @returns `out`
 */
export function set(
   out: Vec3,
   x: number,
   y: number,
   z: number
): Vec3 {
   out.x = x;
   out.y = y;
   out.z = z;

   return out;
}

/**
 * adds two vec3's
 *
 * @param out - the receiving vector
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns `out`
 */
export function add(
   out: Vec3,
   a: Vec3,
   b: Vec3
): Vec3 {
   out.x = (a.x + b.x);
   out.y = (a.y + b.y);
   out.z = (a.z + b.z);

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
   out: Vec3,
   a: Vec3,
   b: Vec3
): Vec3 {
   out.x = (a.x - b.x);
   out.y = (a.y - b.y);
   out.z = (a.z - b.z);

   return out;
}

/**
 * multiplies two vec3's component-wise
 *
 * @param out - the receiving vector
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns `out`
 */
export function multiply(
   out: Vec3,
   a: Vec3,
   b: Vec3
): Vec3 {
   out.x = (a.x * b.x);
   out.y = (a.y * b.y);
   out.z = (a.z * b.z);

   return out;
}

/**
 * divides two vec3's component-wise
 *
 * @param out - the receiving vector
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns `out`
 */
export function divide(
   out: Vec3,
   a: Vec3,
   b: Vec3
): Vec3 {
   out.x = (a.x / b.x);
   out.y = (a.y / b.y);
   out.z = (a.z / b.z);

   return out;
}

/**
 * scales a vec3 by a scalar number
 *
 * @param out - the receiving vector
 * @param a - the vector to scale
 * @param s - amount to scale the vector by
 *
 * @returns `out`
 */
export function scale(
   out: Vec3,
   a: Vec3,
   s: number
): Vec3 {
   out.x = (a.x * s);
   out.y = (a.y * s);
   out.z = (a.z * s);

   return out;
}

/**
 * calculates the dot product of two vec3's
 *
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns dot product of a and b
 */
export function dot(
   a: Vec3,
   b: Vec3
): number {
   return (
      a.x * b.x
      + a.y * b.y
      + a.z * b.z
   );
}

/**
 * computes the cross product of two vec3's
 *
 * @param out - the receiving vector
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns `out`
 */
export function cross(
   out: Vec3,
   a: Vec3,
   b: Vec3
): Vec3 {
   const ax = a.x;
   const ay = a.y;
   const az = a.z;

   const bx = b.x;
   const by = b.y;
   const bz = b.z;

   out.x = (ay * bz - az * by);
   out.y = (az * bx - ax * bz);
   out.z = (ax * by - ay * bx);

   return out;
}

/**
 * calculates the length of a vec3
 *
 * @param a - the vector to calculate length of
 *
 * @returns length of a
 */
export function length(
   a: Vec3
): number {
   const x = a.x;
   const y = a.y;
   const z = a.z;

   return Math.sqrt(
      x * x
      + y * y
      + z * z
   );
}

/**
 * calculates the squared length of a vec3
 *
 * @param a - vector to calculate squared length of
 *
 * @returns squared length of a
 */
export function length_sq(
   a: Vec3
): number {
   const x = a.x;
   const y = a.y;
   const z = a.z;

   return (
      x * x
      + y * y
      + z * z
   );
}

/**
 * calculates the distance between two vec3's
 *
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns distance between a and b
 */
export function distance(
   a: Vec3,
   b: Vec3
): number {
   const x = b.x - a.x;
   const y = b.y - a.y;
   const z = b.z - a.z;

   return Math.sqrt(
      x * x
      + y * y
      + z * z
   );
}

/**
 * calculates the squared distance between two vec3's
 *
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns squared distance between a and b
 */
export function distance_sq(
   a: Vec3,
   b: Vec3
): number {
   const x = b.x - a.x;
   const y = b.y - a.y;
   const z = b.z - a.z;

   return x * x + y * y + z * z;
}

/**
 * normalizes a vec3
 *
 * @param out - the receiving vector
 * @param a - the vector to normalize
 *
 * @returns `out`
 */
export function normalize(
   out: Vec3,
   a: Vec3
): Vec3 {
   const len = length(a);

   if (len > 0) {
      const inv_len = 1 / len;

      out.x = (a.x * inv_len);
      out.y = (a.y * inv_len);
      out.z = (a.z * inv_len);
   }

   return out;
}

/**
 * negates the components of a vec3
 *
 * @param out - the receiving vector
 * @param a - the vector to negate
 *
 * @returns `out`
 */
export function negate(
   out: Vec3,
   a: Vec3
): Vec3 {
   out.x = -a.x;
   out.y = -a.y;
   out.z = -a.z;

   return out;
}

/**
 * copies the values from one vec3 to another
 *
 * @param out - the receiving vector
 * @param a - the source vector
 *
 * @returns `out`
 */
export function copy(
   out: Vec3,
   a: Vec3
): Vec3 {
   out.x = a.x;
   out.y = a.y;
   out.z = a.z;

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
   a: Vec3,
   b: Vec3
): boolean {
   return (
      Math.abs(a.x - b.x) <= EPSILON * Math.max(1.0, Math.abs(a.x), Math.abs(b.x))
      && Math.abs(a.y - b.y) <= EPSILON * Math.max(1.0, Math.abs(a.y), Math.abs(b.y))
      && Math.abs(a.z - b.z) <= EPSILON * Math.max(1.0, Math.abs(a.z), Math.abs(b.z))
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
   a: Vec3,
   b: Vec3
): boolean {
   return (
      a.x === b.x
      && a.y === b.y
      && a.z === b.z
   );
}

/**
 * performs a linear interpolation between two vec3's
 *
 * @param out - the receiving vector
 * @param a - the first operand
 * @param b - the second operand
 * @param t - interpolation amount, in the range [0-1]
 *
 * @returns `out`
 */
export function lerp(
   out: Vec3,
   a: Vec3,
   b: Vec3,
   t: number
): Vec3 {
   out.x = (a.x + t * (b.x - a.x));
   out.y = (a.y + t * (b.y - a.y));
   out.z = (a.z + t * (b.z - a.z));

   return out;
}

/**
 * transforms the vec3 with a mat3
 *
 * @param out - the receiving vector
 * @param v - the vector to transform
 * @param m - matrix to transform with
 *
 * @returns `out`
 */
export function transform_mat3(
   out: Vec3,
   v: Vec3,
   m: Mat3
): Vec3 {
   const x = v.x;
   const y = v.y;
   const z = v.z;

   out.x = (x * m[0] + y * m[3] + z * m[6]);
   out.y = (x * m[1] + y * m[4] + z * m[7]);
   out.z = (x * m[2] + y * m[5] + z * m[8]);

   return out;
}

/**
 * transforms the vec3 with a quat
 *
 * @param out - the receiving vector
 * @param v - the vector to transform
 * @param q - quaternion to transform with
 *
 * @returns `out`
 */
export function transform_quat(
   out: Vec3,
   v: Vec3,
   q: Quat
): Vec3 {
   // benchmarks: http://jsperf.com/quaternion-transform-vec3-implementations
   const qx = q[0]!;
   const qy = q[1]!;
   const qz = q[2]!;
   const qw = q[3]!;

   const x = v.x
   const y = v.y
   const z = v.z;

   // var qvec = [qx, qy, qz];
   // var uv = vec3.cross([], qvec, a);
   let uvx = qy * z - qz * y;
   let uvy = qz * x - qx * z;
   let uvz = qx * y - qy * x;

   // var uuv = vec3.cross([], qvec, uv);
   let uuvx = qy * uvz - qz * uvy;
   let uuvy = qz * uvx - qx * uvz;
   let uuvz = qx * uvy - qy * uvx;

   // vec3.scale(uv, uv, 2 * w);
   const w2 = qw * 2;

   uvx *= w2;
   uvy *= w2;
   uvz *= w2;

   // vec3.scale(uuv, uuv, 2);
   uuvx *= 2;
   uuvy *= 2;
   uuvz *= 2;

   // return vec3.add(out, a, vec3.add(out, uv, uuv));
   out.x = (x + uvx + uuvx);
   out.y = (y + uvy + uuvy);
   out.z = (z + uvz + uuvz);

   return out;
}