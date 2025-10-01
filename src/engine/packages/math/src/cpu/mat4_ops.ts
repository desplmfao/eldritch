/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/src/cpu/mat4_ops.ts
 */

import { EPSILON } from '@self/common';

import { Mat4 } from '@self/cpu/mat4';
import type { Vec3 } from '@self/cpu/vec3';
import type { Quat } from '@self/cpu/quat';

/**
 * sets a mat4 to the identity matrix
 *
 * @param out - mat4 to modify
 *
 * @returns `out`
 */
export function identity(
   out: Mat4
): Mat4 {
   out[0] = 1;
   out[1] = 0;
   out[2] = 0;
   out[3] = 0;
   out[4] = 0;
   out[5] = 1;
   out[6] = 0;
   out[7] = 0;
   out[8] = 0;
   out[9] = 0;
   out[10] = 1;
   out[11] = 0;
   out[12] = 0;
   out[13] = 0;
   out[14] = 0;
   out[15] = 1;

   return out;
}

/**
 * copies the values from one mat4 to another
 *
 * @param out - the receiving matrix
 * @param a - the source matrix
 *
 * @returns `out`
 */
export function copy(
   out: Mat4,
   a: Mat4
): Mat4 {
   out[0] = a[0];
   out[1] = a[1];
   out[2] = a[2];
   out[3] = a[3];
   out[4] = a[4];
   out[5] = a[5];
   out[6] = a[6];
   out[7] = a[7];
   out[8] = a[8];
   out[9] = a[9];
   out[10] = a[10];
   out[11] = a[11];
   out[12] = a[12];
   out[13] = a[13];
   out[14] = a[14];
   out[15] = a[15];

   return out;
}

/**
 * multiplies two mat4's
 *
 * @param out - the receiving matrix
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns `out`
 */
export function multiply(
   out: Mat4,
   a: Mat4,
   b: Mat4
): Mat4 {
   const a00 = a[0]!;
   const a01 = a[1]!;
   const a02 = a[2]!;
   const a03 = a[3]!;

   const a10 = a[4]!;
   const a11 = a[5]!;
   const a12 = a[6]!;
   const a13 = a[7]!;

   const a20 = a[8]!;
   const a21 = a[9]!;
   const a22 = a[10]!;
   const a23 = a[11]!;

   const a30 = a[12]!;
   const a31 = a[13]!;
   const a32 = a[14]!;
   const a33 = a[15]!;

   let b0 = b[0]!;
   let b1 = b[1]!;
   let b2 = b[2]!;
   let b3 = b[3]!;

   out[0] = (b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30);
   out[1] = (b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31);
   out[2] = (b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32);
   out[3] = (b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33);

   b0 = b[4]!;
   b1 = b[5]!;
   b2 = b[6]!;
   b3 = b[7]!;

   out[4] = (b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30);
   out[5] = (b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31);
   out[6] = (b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32);
   out[7] = (b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33);

   b0 = b[8]!;
   b1 = b[9]!;
   b2 = b[10]!;
   b3 = b[11]!;

   out[8] = (b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30);
   out[9] = (b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31);
   out[10] = (b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32);
   out[11] = (b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33);

   b0 = b[12]!;
   b1 = b[13]!;
   b2 = b[14]!;
   b3 = b[15]!;

   out[12] = (b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30);
   out[13] = (b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31);
   out[14] = (b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32);
   out[15] = (b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33);

   return out;
}

/**
 * transpose the values of a mat4
 *
 * @param out - the receiving matrix
 * @param a - the source matrix
 *
 * @returns `out`
 */
export function transpose(out: Mat4, a: Mat4): Mat4 {
   if (out === a) {
      const a01 = a[1];
      const a02 = a[2];
      const a03 = a[3];

      const a12 = a[6];
      const a13 = a[7];

      const a23 = a[11];

      out[1] = a[4];
      out[2] = a[8];
      out[3] = a[12];
      out[4] = a01;
      out[6] = a[9];
      out[7] = a[13];
      out[8] = a02;
      out[9] = a12;
      out[11] = a[14];
      out[12] = a03;
      out[13] = a13;
      out[14] = a23;
   } else {
      out[0] = a[0];
      out[1] = a[4];
      out[2] = a[8];
      out[3] = a[12];

      out[4] = a[1];
      out[5] = a[5];
      out[6] = a[9];
      out[7] = a[13];

      out[8] = a[2];
      out[9] = a[6];
      out[10] = a[10];
      out[11] = a[14];

      out[12] = a[3];
      out[13] = a[7];
      out[14] = a[11];
      out[15] = a[15];
   }

   return out;
}

/**
 * calculates the determinant of a mat4
 *
 * @param a - the source matrix
 *
 * @returns determinant of a
 */
export function determinant(
   a: Mat4
): number {
   const a00 = a[0]!;
   const a01 = a[1]!;
   const a02 = a[2]!;
   const a03 = a[3]!;

   const a10 = a[4]!;
   const a11 = a[5]!;
   const a12 = a[6]!;
   const a13 = a[7]!;

   const a20 = a[8]!;
   const a21 = a[9]!;
   const a22 = a[10]!;
   const a23 = a[11]!;

   const a30 = a[12]!;
   const a31 = a[13]!;
   const a32 = a[14]!;
   const a33 = a[15]!;

   const b00 = a00 * a11 - a01 * a10;
   const b01 = a00 * a12 - a02 * a10;
   const b02 = a00 * a13 - a03 * a10;
   const b03 = a01 * a12 - a02 * a11;
   const b04 = a01 * a13 - a03 * a11;
   const b05 = a02 * a13 - a03 * a12;
   const b06 = a20 * a31 - a21 * a30;
   const b07 = a20 * a32 - a22 * a30;
   const b08 = a20 * a33 - a23 * a30;
   const b09 = a21 * a32 - a22 * a31;
   const b10 = a21 * a33 - a23 * a31;
   const b11 = a22 * a33 - a23 * a32;

   return (
      b00 * b11
      - b01 * b10
      + b02 * b09
      + b03 * b08
      - b04 * b07
      + b05 * b06
   );
}

/**
 * calculates the adjugate of a mat4
 *
 * @param out - the receiving matrix
 * @param a - the source matrix
 *
 * @returns `out`
 */
export function adjoint(
   out: Mat4,
   a: Mat4
): Mat4 {
   const a00 = a[0]!;
   const a01 = a[1]!;
   const a02 = a[2]!;
   const a03 = a[3]!;

   const a10 = a[4]!;
   const a11 = a[5]!;
   const a12 = a[6]!;
   const a13 = a[7]!;

   const a20 = a[8]!;
   const a21 = a[9]!;
   const a22 = a[10]!;
   const a23 = a[11]!;

   const a30 = a[12]!;
   const a31 = a[13]!;
   const a32 = a[14]!;
   const a33 = a[15]!;

   out[0] = (a11 * (a22 * a33 - a23 * a32) - a21 * (a12 * a33 - a13 * a32) + a31 * (a12 * a23 - a13 * a22));
   out[1] = (-(a01 * (a22 * a33 - a23 * a32) - a21 * (a02 * a33 - a03 * a32) + a31 * (a02 * a23 - a03 * a22)));
   out[2] = (a01 * (a12 * a33 - a13 * a32) - a11 * (a02 * a33 - a03 * a32) + a31 * (a02 * a13 - a03 * a12));
   out[3] = (-(a01 * (a12 * a23 - a13 * a22) - a11 * (a02 * a23 - a03 * a22) + a21 * (a02 * a13 - a03 * a12)));
   out[4] = (-(a10 * (a22 * a33 - a23 * a32) - a20 * (a12 * a33 - a13 * a32) + a30 * (a12 * a23 - a13 * a22)));
   out[5] = (a00 * (a22 * a33 - a23 * a32) - a20 * (a02 * a33 - a03 * a32) + a30 * (a02 * a23 - a03 * a22));
   out[6] = (-(a00 * (a12 * a33 - a13 * a32) - a10 * (a02 * a33 - a03 * a32) + a30 * (a02 * a13 - a03 * a12)));
   out[7] = (a00 * (a12 * a23 - a13 * a22) - a10 * (a02 * a23 - a03 * a22) + a20 * (a02 * a13 - a03 * a12));
   out[8] = (a10 * (a21 * a33 - a23 * a31) - a20 * (a11 * a33 - a13 * a31) + a30 * (a11 * a23 - a13 * a21));
   out[9] = (-(a00 * (a21 * a33 - a23 * a31) - a20 * (a01 * a33 - a03 * a31) + a30 * (a01 * a23 - a03 * a21)));
   out[10] = (a00 * (a11 * a33 - a13 * a31) - a10 * (a01 * a33 - a03 * a31) + a30 * (a01 * a13 - a03 * a11));
   out[11] = (-(a00 * (a11 * a23 - a13 * a21) - a10 * (a01 * a23 - a03 * a21) + a20 * (a01 * a13 - a03 * a11)));
   out[12] = (-(a10 * (a21 * a32 - a22 * a31) - a20 * (a11 * a32 - a12 * a31) + a30 * (a11 * a22 - a12 * a21)));
   out[13] = (a00 * (a21 * a32 - a22 * a31) - a20 * (a01 * a32 - a02 * a31) + a30 * (a01 * a22 - a02 * a21));
   out[14] = (-(a00 * (a11 * a32 - a12 * a31) - a10 * (a01 * a32 - a02 * a31) + a30 * (a01 * a12 - a02 * a11)));
   out[15] = (a00 * (a11 * a22 - a12 * a21) - a10 * (a01 * a22 - a02 * a21) + a20 * (a01 * a12 - a02 * a11));

   return out;
}

/**
 * inverts a mat4
 *
 * @param out - the receiving matrix
 * @param a - the source matrix
 *
 * @returns `out`
 */
export function invert(
   out: Mat4,
   a: Mat4
): Mat4 {
   const a00 = a[0]!;
   const a01 = a[1]!;
   const a02 = a[2]!;
   const a03 = a[3]!;

   const a10 = a[4]!;
   const a11 = a[5]!;
   const a12 = a[6]!;
   const a13 = a[7]!;

   const a20 = a[8]!;
   const a21 = a[9]!;
   const a22 = a[10]!;
   const a23 = a[11]!;

   const a30 = a[12]!;
   const a31 = a[13]!;
   const a32 = a[14]!;
   const a33 = a[15]!;

   const b00 = a00 * a11 - a01 * a10;
   const b01 = a00 * a12 - a02 * a10;
   const b02 = a00 * a13 - a03 * a10;
   const b03 = a01 * a12 - a02 * a11;
   const b04 = a01 * a13 - a03 * a11;
   const b05 = a02 * a13 - a03 * a12;
   const b06 = a20 * a31 - a21 * a30;
   const b07 = a20 * a32 - a22 * a30;
   const b08 = a20 * a33 - a23 * a30;
   const b09 = a21 * a32 - a22 * a31;
   const b10 = a21 * a33 - a23 * a31;
   const b11 = a22 * a33 - a23 * a32;

   let det = (
      b00 * b11
      - b01 * b10
      + b02 * b09
      + b03 * b08
      - b04 * b07
      + b05 * b06
   );

   // TODO: error here?
   if (!det) {
      return out;
   }

   det = 1.0 / det;

   out[0] = ((a11 * b11 - a12 * b10 + a13 * b09) * det);
   out[1] = ((a02 * b10 - a01 * b11 - a03 * b09) * det);
   out[2] = ((a31 * b05 - a32 * b04 + a33 * b03) * det);
   out[3] = ((a22 * b04 - a21 * b05 - a23 * b03) * det);
   out[4] = ((a12 * b08 - a10 * b11 - a13 * b07) * det);
   out[5] = ((a00 * b11 - a02 * b08 + a03 * b07) * det);
   out[6] = ((a32 * b02 - a30 * b05 - a33 * b01) * det);
   out[7] = ((a20 * b05 - a22 * b02 + a23 * b01) * det);
   out[8] = ((a10 * b10 - a11 * b08 + a13 * b06) * det);
   out[9] = ((a01 * b08 - a00 * b10 - a03 * b06) * det);
   out[10] = ((a30 * b04 - a31 * b02 + a33 * b00) * det);
   out[11] = ((a21 * b02 - a20 * b04 - a23 * b00) * det);
   out[12] = ((a11 * b07 - a10 * b09 - a12 * b06) * det);
   out[13] = ((a00 * b09 - a01 * b07 + a02 * b06) * det);
   out[14] = ((a31 * b01 - a30 * b03 - a32 * b00) * det);
   out[15] = ((a20 * b03 - a21 * b01 + a22 * b00) * det);

   return out;
}

/**
 * creates a matrix from a vector translation
 *
 * @param out - mat4 to create from the translation
 * @param v - translation vector
 *
 * @returns `out`
 */
export function from_translation(
   out: Mat4,
   v: Vec3
): Mat4 {
   out[0] = 1;
   out[1] = 0;
   out[2] = 0;
   out[3] = 0;

   out[4] = 0;
   out[5] = 1;
   out[6] = 0;
   out[7] = 0;

   out[8] = 0;
   out[9] = 0;
   out[10] = 1;
   out[11] = 0;

   out[12] = v.x;
   out[13] = v.y;
   out[14] = v.z;
   out[15] = 1;

   return out;
}

/**
 * creates a matrix from a vector scaling
 *
 * @param out - mat4 to create from the scaling
 * @param v - scaling vector
 *
 * @returns `out`
 */
export function from_scaling(
   out: Mat4,
   v: Vec3
): Mat4 {
   out[0] = v.x;
   out[1] = 0;
   out[2] = 0;
   out[3] = 0;

   out[4] = 0;
   out[5] = v.y;
   out[6] = 0;
   out[7] = 0;

   out[8] = 0;
   out[9] = 0;
   out[10] = v.z;
   out[11] = 0;

   out[12] = 0;
   out[13] = 0;
   out[14] = 0;
   out[15] = 1;

   return out;
}

/**
 * creates a matrix from a given angle around a given axis
 *
 * @param out - mat4 to create from the rotation
 * @param rad - the angle to rotate the matrix by
 * @param axis - the axis to rotate around
 *
 * @returns `out`
 */
export function from_rotation(
   out: Mat4,
   rad: number,
   axis: Vec3
): Mat4 {
   let x = axis.x;
   let y = axis.y;
   let z = axis.z;

   let len = Math.sqrt(x * x + y * y + z * z);

   let s: number;
   let c: number;
   let t: number;

   if (len < EPSILON) {
      return out;
   }

   len = 1 / len;

   // *=
   x = (x * len);
   y = (y * len);
   z = (z * len);

   s = Math.sin(rad); c = Math.cos(rad); t = 1 - c;

   out[0] = (x * x * t + c);
   out[1] = (y * x * t + z * s);
   out[2] = (z * x * t - y * s);
   out[3] = 0;

   out[4] = (x * y * t - z * s);
   out[5] = (y * y * t + c);
   out[6] = (z * y * t + x * s);
   out[7] = 0;

   out[8] = (x * z * t + y * s);
   out[9] = (y * z * t - x * s);
   out[10] = (z * z * t + c);
   out[11] = 0;

   out[12] = 0;
   out[13] = 0;
   out[14] = 0;
   out[15] = 1;

   return out;
}

/**
 * creates a matrix from a quaternion rotation
 *
 * @param out - mat4 to create from the rotation
 * @param q - quaternion to create matrix from
 *
 * @returns `out`
 */
export function from_quat(
   out: Mat4,
   q: Quat
): Mat4 {
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
   out[1] = (yx + wz);
   out[2] = (zx - wy);
   out[3] = 0;

   out[4] = (yx - wz);
   out[5] = (1 - xx - zz);
   out[6] = (zy + wx);
   out[7] = 0;

   out[8] = (zx + wy);
   out[9] = (zy - wx);
   out[10] = (1 - xx - yy);
   out[11] = 0;

   out[12] = 0;
   out[13] = 0;
   out[14] = 0;
   out[15] = 1;

   return out;
}

/**
 * translates a mat4 by the given vector
 *
 * @param out - the receiving matrix
 * @param a - the matrix to translate
 * @param v - vector to translate by
 *
 * @returns `out`
 */
export function translate(
   out: Mat4,
   a: Mat4,
   v: Vec3
): Mat4 {
   const x = v.x;
   const y = v.y;
   const z = v.z;

   let a00: number;
   let a01: number;
   let a02: number;
   let a03: number;

   let a10: number;
   let a11: number;
   let a12: number;
   let a13: number;

   let a20: number;
   let a21: number;
   let a22: number;
   let a23: number;

   if (a === out) {
      out[12] = (a[0]! * x + a[4]! * y + a[8]! * z + a[12]!);
      out[13] = (a[1]! * x + a[5]! * y + a[9]! * z + a[13]!);
      out[14] = (a[2]! * x + a[6]! * y + a[10]! * z + a[14]!);
      out[15] = (a[3]! * x + a[7]! * y + a[11]! * z + a[15]!);
   } else {
      a00 = a[0]!;
      a01 = a[1]!;
      a02 = a[2]!;
      a03 = a[3]!;

      a10 = a[4]!;
      a11 = a[5]!;
      a12 = a[6]!;
      a13 = a[7]!;

      a20 = a[8]!;
      a21 = a[9]!;
      a22 = a[10]!;
      a23 = a[11]!;

      out[0] = a00;
      out[1] = a01;
      out[2] = a02;
      out[3] = a03;

      out[4] = a10;
      out[5] = a11;
      out[6] = a12;
      out[7] = a13;

      out[8] = a20;
      out[9] = a21;
      out[10] = a22;
      out[11] = a23;

      out[12] = (a00 * x + a10 * y + a20 * z + a[12]!);
      out[13] = (a01 * x + a11 * y + a21 * z + a[13]!);
      out[14] = (a02 * x + a12 * y + a22 * z + a[14]!);
      out[15] = (a03 * x + a13 * y + a23 * z + a[15]!);
   }

   return out;
}

/**
 * scales the mat4 by the dimensions in the given vec3
 *
 * @param out - the receiving matrix
 * @param a - the matrix to scale
 * @param v - the vec3 to scale the matrix by
 *
 * @returns `out`
 */
export function scale(out: Mat4, a: Mat4, v: Vec3): Mat4 {
   const x = v.x;
   const y = v.y;
   const z = v.z;

   out[0] = (a[0] * x);
   out[1] = (a[1] * x);
   out[2] = (a[2] * x);
   out[3] = (a[3] * x);

   out[4] = (a[4] * y);
   out[5] = (a[5] * y);
   out[6] = (a[6] * y);
   out[7] = (a[7] * y);

   out[8] = (a[8] * z);
   out[9] = (a[9] * z);
   out[10] = (a[10] * z);
   out[11] = (a[11] * z);

   out[12] = a[12];
   out[13] = a[13];
   out[14] = a[14];
   out[15] = a[15];

   return out;
}

/**
 * rotates a mat4 by the given angle around the given axis
 *
 * @param out - the receiving matrix
 * @param a - the matrix to rotate
 * @param rad - the angle to rotate the matrix by
 * @param axis - the axis to rotate around
 *
 * @returns `out`
 */
export function rotate(
   out: Mat4,
   a: Mat4,
   rad: number,
   axis: Vec3
): Mat4 {
   let x = axis.x;
   let y = axis.y;
   let z = axis.z;

   let len = Math.sqrt(
      x * x
      + y * y
      + z * z
   );

   let s: number;
   let c: number;
   let t: number;

   const a00 = a[0];
   const a01 = a[1];
   const a02 = a[2];
   const a03 = a[3];

   const a10 = a[4];
   const a11 = a[5];
   const a12 = a[6];
   const a13 = a[7];

   const a20 = a[8];
   const a21 = a[9];
   const a22 = a[10];
   const a23 = a[11];

   if (len < EPSILON) {
      return out;
   }

   len = 1 / len;

   // *=
   x = (x * len);
   y = (y * len);
   z = (z * len);

   s = Math.sin(rad);
   c = Math.cos(rad);
   t = 1 - c;

   const b00 = x * x * t + c;
   const b01 = y * x * t + z * s;
   const b02 = z * x * t - y * s;

   const b10 = x * y * t - z * s;
   const b11 = y * y * t + c;
   const b12 = z * y * t + x * s;

   const b20 = x * z * t + y * s;
   const b21 = y * z * t - x * s;
   const b22 = z * z * t + c;

   out[0] = (a00 * b00 + a10 * b01 + a20 * b02);
   out[1] = (a01 * b00 + a11 * b01 + a21 * b02);
   out[2] = (a02 * b00 + a12 * b01 + a22 * b02);
   out[3] = (a03 * b00 + a13 * b01 + a23 * b02);

   out[4] = (a00 * b10 + a10 * b11 + a20 * b12);
   out[5] = (a01 * b10 + a11 * b11 + a21 * b12);
   out[6] = (a02 * b10 + a12 * b11 + a22 * b12);
   out[7] = (a03 * b10 + a13 * b11 + a23 * b12);

   out[8] = (a00 * b20 + a10 * b21 + a20 * b22);
   out[9] = (a01 * b20 + a11 * b21 + a21 * b22);
   out[10] = (a02 * b20 + a12 * b21 + a22 * b22);
   out[11] = (a03 * b20 + a13 * b21 + a23 * b22);

   if (a !== out) {
      out[12] = a[12];
      out[13] = a[13];
      out[14] = a[14];
      out[15] = a[15];
   }

   return out;
}

/**
 * rotates a matrix by the given angle around the X axis
 *
 * @param out - the receiving matrix
 * @param a - the matrix to rotate
 * @param rad - the angle to rotate the matrix by
 *
 * @returns `out`
 */
export function rotate_x(
   out: Mat4,
   a: Mat4,
   rad: number
): Mat4 {
   const s = Math.sin(rad);
   const c = Math.cos(rad);

   const a10 = a[4];
   const a11 = a[5];
   const a12 = a[6];
   const a13 = a[7];

   const a20 = a[8];
   const a21 = a[9];
   const a22 = a[10];
   const a23 = a[11];

   if (a !== out) {
      out[0] = a[0];
      out[1] = a[1];
      out[2] = a[2];
      out[3] = a[3];

      out[12] = a[12];
      out[13] = a[13];
      out[14] = a[14];
      out[15] = a[15];
   }

   out[4] = (a10 * c + a20 * s);
   out[5] = (a11 * c + a21 * s);
   out[6] = (a12 * c + a22 * s);
   out[7] = (a13 * c + a23 * s);

   out[8] = (a20 * c - a10 * s);
   out[9] = (a21 * c - a11 * s);
   out[10] = (a22 * c - a12 * s);
   out[11] = (a23 * c - a13 * s);

   return out;
}

/**
 * rotates a matrix by the given angle around the Y axis
 *
 * @param out - the receiving matrix
 * @param a - the matrix to rotate
 * @param rad - the angle to rotate the matrix by
 *
 * @returns `out`
 */
export function rotate_y(
   out: Mat4,
   a: Mat4,
   rad: number
): Mat4 {
   const s = Math.sin(rad);
   const c = Math.cos(rad);

   const a00 = a[0];
   const a01 = a[1];
   const a02 = a[2];
   const a03 = a[3];

   const a20 = a[8];
   const a21 = a[9];
   const a22 = a[10];
   const a23 = a[11];

   if (a !== out) {
      out[4] = a[4];
      out[5] = a[5];
      out[6] = a[6];
      out[7] = a[7];

      out[12] = a[12];
      out[13] = a[13];
      out[14] = a[14];
      out[15] = a[15];
   }

   out[0] = (a00 * c - a20 * s);
   out[1] = (a01 * c - a21 * s);
   out[2] = (a02 * c - a22 * s);
   out[3] = (a03 * c - a23 * s);

   out[8] = (a00 * s + a20 * c);
   out[9] = (a01 * s + a21 * c);
   out[10] = (a02 * s + a22 * c);
   out[11] = (a03 * s + a23 * c);

   return out;
}

/**
 * rotates a matrix by the given angle around the Z axis
 *
 * @param out - the receiving matrix
 * @param a - the matrix to rotate
 * @param rad - the angle to rotate the matrix by
 *
 * @returns `out`
 */
export function rotate_z(
   out: Mat4,
   a: Mat4,
   rad: number
): Mat4 {
   const s = Math.sin(rad);
   const c = Math.cos(rad);

   const a00 = a[0];
   const a01 = a[1];
   const a02 = a[2];
   const a03 = a[3];

   const a10 = a[4];
   const a11 = a[5];
   const a12 = a[6];
   const a13 = a[7];

   if (a !== out) {
      out[8] = a[8];
      out[9] = a[9];
      out[10] = a[10];
      out[11] = a[11];

      out[12] = a[12];
      out[13] = a[13];
      out[14] = a[14];
      out[15] = a[15];
   }

   out[0] = (a00 * c + a10 * s);
   out[1] = (a01 * c + a11 * s);
   out[2] = (a02 * c + a12 * s);
   out[3] = (a03 * c + a13 * s);

   out[4] = (a10 * c - a00 * s);
   out[5] = (a11 * c - a01 * s);
   out[6] = (a12 * c - a02 * s);
   out[7] = (a13 * c - a03 * s);

   return out;
}

/**
 * generates a perspective projection matrix
 *
 * @param out - mat4 frustum matrix will be written into
 * @param fovy - vertical field of view in radians
 * @param aspect - aspect ratio. typically viewport width/height
 * @param near - near bound of the frustum
 * @param far - far bound of the frustum
 *
 * @returns `out`
 */
export function perspective(
   out: Mat4,
   fovy: number,
   aspect: number,
   near: number,
   far: number
): Mat4 {
   const f = 1.0 / Math.tan(fovy / 2);

   out[0] = (f / aspect);
   out[1] = 0;
   out[2] = 0;
   out[3] = 0;

   out[4] = 0;
   out[5] = f;
   out[6] = 0;
   out[7] = 0;

   out[8] = 0;
   out[9] = 0;
   // 10
   out[11] = -1;

   out[12] = 0;
   out[13] = 0;
   // 14
   out[15] = 0;

   if (
      far != null
      && far !== Number.POSITIVE_INFINITY
   ) {
      const nf = 1 / (near - far);

      out[10] = ((far + near) * nf);
      out[14] = (2 * far * near * nf);
   } else {
      out[10] = -1;
      out[14] = (-2 * near);
   }

   return out;
}

/**
 * generates an orthogonal projection matrix
 *
 * @param out - mat4 frustum matrix will be written into
 * @param left - left bound of the frustum
 * @param right - right bound of the frustum
 * @param bottom - bottom bound of the frustum
 * @param top - top bound of the frustum
 * @param near - near bound of the frustum
 * @param far - far bound of the frustum
 *
 * @returns `out`
 */
export function ortho(
   out: Mat4,
   left: number,
   right: number,
   bottom: number,
   top: number,
   near: number,
   far: number
): Mat4 {
   const lr = 1 / (left - right);
   const bt = 1 / (bottom - top);
   const nf = 1 / (near - far);

   out[0] = (-2 * lr);
   out[1] = 0;
   out[2] = 0;
   out[3] = 0;

   out[4] = 0;
   out[5] = (-2 * bt);
   out[6] = 0;
   out[7] = 0;

   out[8] = 0;
   out[9] = 0;
   out[10] = (2 * nf);
   out[11] = 0;

   out[12] = ((left + right) * lr);
   out[13] = ((top + bottom) * bt);
   out[14] = ((far + near) * nf);
   out[15] = 1;

   return out;
}

/**
 * generates a look-at matrix
 *
 * @param out - mat4 frustum matrix will be written into
 * @param eye - position of the viewer
 * @param center - point the viewer is looking at
 * @param up - vec3 pointing up
 *
 * @returns `out`
 */
export function look_at(
   out: Mat4,
   eye: Vec3,
   center: Vec3,
   up: Vec3
): Mat4 {
   let x0: number;
   let x1: number;
   let x2: number;

   let y0: number;
   let y1: number;
   let y2: number;

   let z0: number;
   let z1: number;
   let z2: number;

   let len: number;

   const eyex = eye.x;
   const eyey = eye.y;
   const eyez = eye.z;

   const upx = up.x;
   const upy = up.y;
   const upz = up.z;

   const centerx = center.x;
   const centery = center.y;
   const centerz = center.z;

   if (
      Math.abs(eyex - centerx) < EPSILON
      && Math.abs(eyey - centery) < EPSILON
      && Math.abs(eyez - centerz) < EPSILON
   ) {
      return identity(out);
   }

   z0 = eyex - centerx;
   z1 = eyey - centery;
   z2 = eyez - centerz;

   len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
   z0 *= len; z1 *= len; z2 *= len;

   x0 = upy * z2 - upz * z1;
   x1 = upz * z0 - upx * z2;
   x2 = upx * z1 - upy * z0;

   len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);

   if (!len) {
      x0 = 0; x1 = 0; x2 = 0;
   } else {
      len = 1 / len;

      x0 *= len; x1 *= len; x2 *= len;
   }

   y0 = z1 * x2 - z2 * x1;
   y1 = z2 * x0 - z0 * x2;
   y2 = z0 * x1 - z1 * x0;

   len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);

   if (!len) {
      y0 = 0; y1 = 0; y2 = 0;
   } else {
      len = 1 / len;

      y0 *= len; y1 *= len; y2 *= len;
   }

   out[0] = x0;
   out[1] = y0;
   out[2] = z0;
   out[3] = 0;

   out[4] = x1;
   out[5] = y1;
   out[6] = z1;
   out[7] = 0;

   out[8] = x2;
   out[9] = y2;
   out[10] = z2;
   out[11] = 0;

   out[12] = (-(x0 * eyex + x1 * eyey + x2 * eyez));
   out[13] = (-(y0 * eyex + y1 * eyey + y2 * eyez));
   out[14] = (-(z0 * eyex + z1 * eyey + z2 * eyez));
   out[15] = 1;

   return out;
}

/**
 * performs a linear interpolation between two mat4's
 *
 * @param out - the receiving matrix
 * @param a - the first operand
 * @param b - the second operand
 * @param t - interpolation amount, in the range [0-1]
 *
 * @returns `out`
 */
export function lerp(
   out: Mat4,
   a: Mat4,
   b: Mat4,

   t: number): Mat4 {
   out[0] = (a[0] + t * (b[0] - a[0]));
   out[1] = (a[1] + t * (b[1] - a[1]));
   out[2] = (a[2] + t * (b[2] - a[2]));
   out[3] = (a[3] + t * (b[3] - a[3]));
   out[4] = (a[4] + t * (b[4] - a[4]));
   out[5] = (a[5] + t * (b[5] - a[5]));
   out[6] = (a[6] + t * (b[6] - a[6]));
   out[7] = (a[7] + t * (b[7] - a[7]));
   out[8] = (a[8] + t * (b[8] - a[8]));
   out[9] = (a[9] + t * (b[9] - a[9]));
   out[10] = (a[10] + t * (b[10] - a[10]));
   out[11] = (a[11] + t * (b[11] - a[11]));
   out[12] = (a[12] + t * (b[12] - a[12]));
   out[13] = (a[13] + t * (b[13] - a[13]));
   out[14] = (a[14] + t * (b[14] - a[14]));
   out[15] = (a[15] + t * (b[15] - a[15]));

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
   a: Mat4,
   b: Mat4
): boolean {
   for (let i = 0; i < 16; i++) {
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
   a: Mat4,
   b: Mat4
): boolean {
   // 4x4
   for (let i = 0; i < 16; i++) {
      if (a[i] !== b[i]) {
         return false;
      }
   }

   return true;
}