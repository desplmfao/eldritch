/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/src/cpu/mat3_ops.ts
 */

import { EPSILON } from '@self/common';

import { Mat3 } from '@self/cpu/mat3';
import type { Vec2 } from '@self/cpu/vec2';
import type { Mat4 } from '@self/cpu/mat4';
import type { Quat } from '@self/cpu/quat';

/**
 * sets a mat3 to the identity matrix
 *
 * @param out - mat3 to modify
 *
 * @returns `out`
 */
export function identity(
   out: Mat3
): Mat3 {
   out[0] = 1;
   out[1] = 0;
   out[2] = 0;

   out[3] = 0;
   out[4] = 1;
   out[5] = 0;

   out[6] = 0;
   out[7] = 0;
   out[8] = 1;

   return out;
}

/**
 * copies the values from one mat3 to another
 *
 * @param out - the receiving matrix
 * @param a - the source matrix
 *
 * @returns `out`
 */
export function copy(
   out: Mat3,
   a: Mat3
): Mat3 {
   out[0] = a[0];
   out[1] = a[1];
   out[2] = a[2];

   out[3] = a[3];
   out[4] = a[4];
   out[5] = a[5];

   out[6] = a[6];
   out[7] = a[7];
   out[8] = a[8];

   return out;
}

/**
 * multiplies two mat3's
 *
 * @param out - the receiving matrix
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns `out`
 */
export function multiply(
   out: Mat3,
   a: Mat3,
   b: Mat3
): Mat3 {
   const a00 = a[0];
   const a01 = a[1];
   const a02 = a[2];

   const a10 = a[3];
   const a11 = a[4];
   const a12 = a[5];

   const a20 = a[6];
   const a21 = a[7];
   const a22 = a[8];

   const b00 = b[0];
   const b01 = b[1];
   const b02 = b[2];

   const b10 = b[3];
   const b11 = b[4];
   const b12 = b[5];

   const b20 = b[6];
   const b21 = b[7];
   const b22 = b[8];

   out[0] = (b00 * a00 + b01 * a10 + b02 * a20);
   out[1] = (b00 * a01 + b01 * a11 + b02 * a21);
   out[2] = (b00 * a02 + b01 * a12 + b02 * a22);

   out[3] = (b10 * a00 + b11 * a10 + b12 * a20);
   out[4] = (b10 * a01 + b11 * a11 + b12 * a21);
   out[5] = (b10 * a02 + b11 * a12 + b12 * a22);

   out[6] = (b20 * a00 + b21 * a10 + b22 * a20);
   out[7] = (b20 * a01 + b21 * a11 + b22 * a21);
   out[8] = (b20 * a02 + b21 * a12 + b22 * a22);

   return out;
}

/**
 * transpose the values of a mat3
 *
 * @param out - the receiving matrix
 * @param a - the source matrix
 *
 * @returns `out`
 */
export function transpose(
   out: Mat3,
   a: Mat3
): Mat3 {
   if (out === a) {
      const a01 = a[1];
      const a02 = a[2];

      const a12 = a[5];

      // 0
      out[1] = a[3];
      out[2] = a[6];

      out[3] = a01;
      // 4
      out[5] = a[7];

      out[6] = a02;
      out[7] = a12;
      // 8
   } else {
      out[0] = a[0];
      out[1] = a[3];
      out[2] = a[6];

      out[3] = a[1];
      out[4] = a[4];
      out[5] = a[7];

      out[6] = a[2];
      out[7] = a[5];
      out[8] = a[8];
   }

   return out;
}

/**
 * calculates the determinant of a mat3
 *
 * @param a - the source matrix
 *
 * @returns determinant of a
 */
export function determinant(
   a: Mat3
): number {
   const a00 = a[0];
   const a01 = a[1];
   const a02 = a[2];

   const a10 = a[3];
   const a11 = a[4];
   const a12 = a[5];

   const a20 = a[6];
   const a21 = a[7];
   const a22 = a[8];

   return (
      a00 * (a22 * a11 - a12 * a21)
      + a01 * (-a22 * a10 + a12 * a20)
      + a02 * (a21 * a10 - a11 * a20)
   );
}

/**
 * calculates the adjugate of a mat3
 *
 * @param out - the receiving matrix
 * @param a - the source matrix
 *
 * @returns `out`
 */
export function adjoint(
   out: Mat3,
   a: Mat3
): Mat3 {
   const a00 = a[0];
   const a01 = a[1];
   const a02 = a[2];

   const a10 = a[3];
   const a11 = a[4];
   const a12 = a[5];

   const a20 = a[6];
   const a21 = a[7];
   const a22 = a[8];

   out[0] = (a11 * a22 - a12 * a21);
   out[1] = (a02 * a21 - a01 * a22);
   out[2] = (a01 * a12 - a02 * a11);

   out[3] = (a12 * a20 - a10 * a22);
   out[4] = (a00 * a22 - a02 * a20);
   out[5] = (a02 * a10 - a00 * a12);

   out[6] = (a10 * a21 - a11 * a20);
   out[7] = (a01 * a20 - a00 * a21);
   out[8] = (a00 * a11 - a01 * a10);

   return out;
}

/**
 * inverts a mat3
 *
 * @param out - the receiving matrix
 * @param a - the source matrix
 *
 * @returns `out`
 */
export function invert(
   out: Mat3,
   a: Mat3
): Mat3 {
   const a00 = a[0];
   const a01 = a[1];
   const a02 = a[2];

   const a10 = a[3];
   const a11 = a[4];
   const a12 = a[5];

   const a20 = a[6];
   const a21 = a[7];
   const a22 = a[8];

   const b01 = a22 * a11 - a12 * a21;
   const b11 = -a22 * a10 + a12 * a20;
   const b21 = a21 * a10 - a11 * a20;

   let det = a00 * b01 + a01 * b11 + a02 * b21;

   // TODO: error here?
   if (!det) {
      return out;
   }

   det = 1.0 / det;

   out[0] = (b01 * det);
   out[1] = ((-a22 * a01 + a02 * a21) * det);
   out[2] = ((a12 * a01 - a02 * a11) * det);

   out[3] = (b11 * det);
   out[4] = ((a22 * a00 - a02 * a20) * det);
   out[5] = ((-a12 * a00 + a02 * a10) * det);

   out[6] = (b21 * det);
   out[7] = ((-a21 * a00 + a01 * a20) * det);
   out[8] = ((a11 * a00 - a01 * a10) * det);

   return out;
}

/**
 * creates a mat3 from the upper-left 3x3 part of a mat4
 *
 * @param out - the receiving matrix
 * @param a - the source matrix
 *
 * @returns `out`
 */
export function from_mat4(
   out: Mat3,
   a: Mat4
): Mat3 {
   out[0] = a[0];
   out[1] = a[1];
   out[2] = a[2];

   out[3] = a[4];
   out[4] = a[5];
   out[5] = a[6];

   out[6] = a[8];
   out[7] = a[9];
   out[8] = a[10];

   return out;
}

/**
 * creates a mat3 from a quaternion rotation
 *
 * @param out - mat3 to create from the rotation
 * @param q - quaternion to create matrix from
 *
 * @returns `out`
 */
export function from_quat(
   out: Mat3,
   q: Quat
): Mat3 {
   const x = q.x;
   const y = q.y;
   const z = q.z;
   const w = q.w;

   const x2 = x + x;
   const y2 = y + y;
   const z2 = z + z;

   const xx = x * x2;
   const yx = y * x2;
   const yy = y * y2;

   const zx = z * x2;
   const zy = z * y2;
   const zz = z * z2;

   const wx = w * x2;
   const wy = w * y2;
   const wz = w * z2;

   out[0] = (1 - yy - zz);
   out[3] = (yx - wz);
   out[6] = (zx + wy);

   out[1] = (yx + wz);
   out[4] = (1 - xx - zz);
   out[7] = (zy - wx);

   out[2] = (zx - wy);
   out[5] = (zy + wx);
   out[8] = (1 - xx - yy);

   return out;
}

/**
 * creates a 2D translation matrix
 *
 * @param out - mat3 to create from the translation
 * @param v - translation vector
 *
 * @returns `out`
 */
export function from_translation(
   out: Mat3,
   v: Vec2
): Mat3 {
   out[0] = 1;
   out[1] = 0;
   out[2] = 0;

   out[3] = 0;
   out[4] = 1;
   out[5] = 0;

   out[6] = v.x;
   out[7] = v.y;
   out[8] = 1;

   return out;
}

/**
 * creates a 2D rotation matrix
 *
 * @param out - mat3 to create from the rotation
 * @param rad - the angle to rotate the matrix by
 *
 * @returns `out`
 */
export function from_rotation(
   out: Mat3,
   rad: number
): Mat3 {
   const s = Math.sin(rad);
   const c = Math.cos(rad);

   out[0] = c;
   out[1] = s;
   out[2] = 0;

   out[3] = -s;
   out[4] = c;
   out[5] = 0;

   out[6] = 0;
   out[7] = 0;
   out[8] = 1;

   return out;
}

/**
 * creates a 2D scaling matrix
 *
 * @param out - mat3 to create from the scaling
 * @param v - scaling vector
 *
 * @returns `out`
 */
export function from_scaling(
   out: Mat3,
   v: Vec2
): Mat3 {
   out[0] = v.x;
   out[1] = 0;
   out[2] = 0;

   out[3] = 0;
   out[4] = v.y;
   out[5] = 0;

   out[6] = 0;
   out[7] = 0;
   out[8] = 1;

   return out;
}

/**
 * translates a mat3 by the given vector
 *
 * @param out - the receiving matrix
 * @param a - the matrix to translate
 * @param v - vector to translate by
 *
 * @returns `out`
 */
export function translate(
   out: Mat3,
   a: Mat3,
   v: Vec2
): Mat3 {
   const a00 = a[0];
   const a01 = a[1];
   const a02 = a[2];

   const a10 = a[3];
   const a11 = a[4];
   const a12 = a[5];

   const a20 = a[6];
   const a21 = a[7];
   const a22 = a[8];

   const x = v.x;
   const y = v.y;

   out[0] = a00;
   out[1] = a01;
   out[2] = a02;

   out[3] = a10;
   out[4] = a11;
   out[5] = a12;

   out[6] = (x * a00 + y * a10 + a20);
   out[7] = (x * a01 + y * a11 + a21);
   out[8] = (x * a02 + y * a12 + a22);

   return out;
}

/**
 * rotates a mat3 by the given angle
 *
 * @param out - the receiving matrix
 * @param a - the matrix to rotate
 * @param rad - the angle to rotate the matrix by
 *
 * @returns `out`
 */
export function rotate(
   out: Mat3,
   a: Mat3,
   rad: number
): Mat3 {
   const a00 = a[0];
   const a01 = a[1];
   const a02 = a[2];

   const a10 = a[3];
   const a11 = a[4];
   const a12 = a[5];

   const s = Math.sin(rad);
   const c = Math.cos(rad);

   out[0] = (c * a00 + s * a10);
   out[1] = (c * a01 + s * a11);
   out[2] = (c * a02 + s * a12);

   out[3] = (c * a10 - s * a00);
   out[4] = (c * a11 - s * a01);
   out[5] = (c * a12 - s * a02);

   if (a !== out) {
      out[6] = a[6];
      out[7] = a[7];
      out[8] = a[8];
   }

   return out;
}

/**
 * scales the mat3 by the dimensions in the given vec2
 *
 * @param out - the receiving matrix
 * @param a - the matrix to scale
 * @param v - the vec2 to scale the matrix by
 *
 * @returns `out`
 */
export function scale(
   out: Mat3,
   a: Mat3,
   v: Vec2
): Mat3 {
   const x = v.x;
   const y = v.y;

   out[0] = (a[0] * x);
   out[1] = (a[1] * x);
   out[2] = (a[2] * x);

   out[3] = (a[3] * y);
   out[4] = (a[4] * y);
   out[5] = (a[5] * y);

   if (a !== out) {
      out[6] = a[6];
      out[7] = a[7];
      out[8] = a[8];
   }

   return out;
}

/**
 * performs a linear interpolation between two mat3's
 *
 * @param out - the receiving matrix
 * @param a - the first operand
 * @param b - the second operand
 * @param t - interpolation amount, in the range [0-1]
 *
 * @returns `out`
 */
export function lerp(
   out: Mat3,
   a: Mat3,
   b: Mat3,
   t: number
): Mat3 {
   out[0] = (a[0] + t * (b[0] - a[0]));
   out[1] = (a[1] + t * (b[1] - a[1]));
   out[2] = (a[2] + t * (b[2] - a[2]));
   out[3] = (a[3] + t * (b[3] - a[3]));
   out[4] = (a[4] + t * (b[4] - a[4]));
   out[5] = (a[5] + t * (b[5] - a[5]));
   out[6] = (a[6] + t * (b[6] - a[6]));
   out[7] = (a[7] + t * (b[7] - a[7]));
   out[8] = (a[8] + t * (b[8] - a[8]));

   return out;
}

/**
 * returns whether or not the matrices have approximately the same elements.
 *
 * @param a - the first matrix.
 * @param b - the second matrix.
 *
 * @returns true if the matrices are approximately equal
 */
export function equals_approximately(
   a: Mat3,
   b: Mat3
): boolean {
   for (let i = 0; i < 9; i++) {
      if (
         Math.abs(a[i]! - b[i]!) > EPSILON
         * Math.max(
            1.0,
            Math.abs(a[i]!),
            Math.abs(b[i]!)
         )
      ) {
         return false;
      }
   }

   return true;
}

/**
 * returns whether or not the matrices have exactly the same elements.
 *
 * @param a - the first matrix.
 * @param b - the second matrix.
 *
 * @returns true if the matrices are equal
 */
export function equals(
   a: Mat3,
   b: Mat3
): boolean {
   for (let i = 0; i < 9; i++) {
      if (a[i] !== b[i]) {
         return false;
      }
   }

   return true;
}