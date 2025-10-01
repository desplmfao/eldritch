/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/src/cpu/quat_ops.ts
 */

import { EPSILON } from '@self/common';

import { Quat } from '@self/cpu/quat';
import type { Vec3 } from '@self/cpu/vec3';
import type { Mat3 } from '@self/cpu/mat3';

/**
 * sets a quaternion to the identity quaternion
 *
 * @param out - quat to modify
 *
 * @returns `out`
 */
export function identity(
   out: Quat
): Quat {
   out.x = 0;
   out.y = 0;
   out.z = 0;
   out.w = 1;

   return out;
}

/**
 * sets a quat from the given angle and rotation axis
 *
 * @param out - quat to modify
 * @param axis - the axis to rotate around
 * @param rad - the angle in radians
 *
 * @returns `out`
 */
export function set_axis_angle(
   out: Quat,
   axis: Vec3,
   rad: number
): Quat {
   rad = rad * 0.5;

   const s = Math.sin(rad);

   out.x = (s * axis.x);
   out.y = (s * axis.y);
   out.z = (s * axis.z);
   out.w = Math.cos(rad);

   return out;
}

/**
 * multiplies two quat's
 *
 * @param out - the receiving quaternion
 * @param a - the first operand
 * @param b - the second operand
 *
 * @returns `out`
 */
export function multiply(
   out: Quat,
   a: Quat,
   b: Quat
): Quat {
   const ax = a.x;
   const ay = a.y;
   const az = a.z;
   const aw = a.w;

   const bx = b.x;
   const by = b.y;
   const bz = b.z;
   const bw = b.w;

   out.x = (ax * bw + aw * bx + ay * bz - az * by);
   out.y = (ay * bw + aw * by + az * bx - ax * bz);
   out.z = (az * bw + aw * bz + ax * by - ay * bx);
   out.w = (aw * bw - ax * bx - ay * by - az * bz);

   return out;
}

/**
 * rotates a quat by the given angle about the X axis
 *
 * @param out - quat to store result in
 * @param a - quat to rotate
 * @param rad - angle (in radians) to rotate
 *
 * @returns `out`
 */
export function rotate_x(
   out: Quat,
   a: Quat,
   rad: number
): Quat {
   rad *= 0.5;

   const ax = a.x;
   const ay = a.y;
   const az = a.z;
   const aw = a.w;

   const bx = Math.sin(rad);
   const bw = Math.cos(rad);

   out.x = (ax * bw + aw * bx);
   out.y = (ay * bw + az * bx);
   out.z = (az * bw - ay * bx);
   out.w = (aw * bw - ax * bx);

   return out;
}

/**
 * rotates a quat by the given angle about the Y axis
 *
 * @param out - quat to store result in
 * @param a - quat to rotate
 * @param rad - angle (in radians) to rotate
 *
 * @returns `out`
 */
export function rotate_y(
   out: Quat,
   a: Quat,
   rad: number
): Quat {
   rad *= 0.5;

   const ax = a.x;
   const ay = a.y;
   const az = a.z;
   const aw = a.w;

   const by = Math.sin(rad);
   const bw = Math.cos(rad);

   out.x = (ax * bw - az * by);
   out.y = (ay * bw + aw * by);
   out.z = (az * bw + ax * by);
   out.w = (aw * bw - ay * by);
   return out;
}

/**
 * rotates a quat by the given angle about the Z axis
 *
 * @param out - quat to store result in
 * @param a - quat to rotate
 * @param rad - angle (in radians) to rotate
 *
 * @returns `out`
 */
export function rotate_z(
   out: Quat,
   a: Quat,
   rad: number
): Quat {
   rad *= 0.5;

   const ax = a.x;
   const ay = a.y;
   const az = a.z;
   const aw = a.w;

   const bz = Math.sin(rad);
   const bw = Math.cos(rad);

   out.x = (ax * bw + ay * bz);
   out.y = (ay * bw - ax * bz);
   out.z = (az * bw + aw * bz);
   out.w = (aw * bw - az * bz);
   return out;
}

/**
 * creates a quaternion from the given 3x3 rotation matrix.
 *
 * @param out - the receiving quaternion
 * @param m - the rotation matrix
 *
 * @returns `out`
 */
export function from_mat3(
   out: Quat,
   m: Mat3
): Quat {
   const f_trace = m[0] + m[4] + m[8];

   let f_root: number;

   if (f_trace > 0.0) {
      f_root = Math.sqrt(f_trace + 1.0);
      out.w = (0.5 * f_root);
      f_root = 0.5 / f_root;

      out.x = ((m[5] - m[7]) * f_root);
      out.y = ((m[6] - m[2]) * f_root);
      out.z = ((m[1] - m[3]) * f_root);
   } else {
      let i = 0;

      if (m[4] > m[0]) {
         i = 1;
      }

      if (m[8] > m[i * 3 + i]!) {
         i = 2;
      }

      const j = (i + 1) % 3;
      const k = (i + 2) % 3;

      f_root = Math.sqrt(m[i * 3 + i]! - m[j * 3 + j]! - m[k * 3 + k]! + 1.0);
      out[i] = (0.5 * f_root);
      f_root = 0.5 / f_root;

      out.w = ((m[j * 3 + k]! - m[k * 3 + j]!) * f_root);
      out[j] = ((m[j * 3 + i]! + m[i * 3 + j]!) * f_root);
      out[k] = ((m[k * 3 + i]! + m[i * 3 + k]!) * f_root);
   }

   return out;
}

/**
 * creates a quaternion from the given euler angle x, y, z.
 *
 * @param out - the receiving quaternion
 * @param x - angle of rotation around the X axis (pitch)
 * @param y - angle of rotation around the Y axis (yaw)
 * @param z - angle of rotation around the Z axis (roll)
 *
 * @returns `out`
 */
export function from_euler(
   out: Quat,
   x: number,
   y: number,
   z: number
): Quat {
   const half_to_rad = 0.5;

   x *= half_to_rad;
   y *= half_to_rad;
   z *= half_to_rad;

   const sx = Math.sin(x);
   const cx = Math.cos(x);
   const sy = Math.sin(y);
   const cy = Math.cos(y);
   const sz = Math.sin(z);
   const cz = Math.cos(z);

   out.x = (sx * cy * cz - cx * sy * sz);
   out.y = (cx * sy * cz + sx * cy * sz);
   out.z = (cx * cy * sz - sx * sy * cz);
   out.w = (cx * cy * cz + sx * sy * sz);

   return out;
}

/**
 * calculates the euler angles (pitch, yaw, roll) from a quaternion.
 *
 * @param out - vec3 to store the Euler angles in
 * @param q - the quaternion to convert
 *
 * @returns `out`
 */
export function to_euler(
   out: Vec3,
   q: Quat
): Vec3 {
   const x = q.x;
   const y = q.y;
   const z = q.z;
   const w = q.w;

   const sinr_cosp = 2 * (w * x + y * z);
   const cosr_cosp = 1 - 2 * (x * x + y * y);
   out.x = Math.atan2(sinr_cosp, cosr_cosp);

   const sinp = 2 * (w * y - z * x);

   if (Math.abs(sinp) >= 1) {
      out.y = Math.sign(sinp) * (Math.PI / 2);
   } else {
      out.y = Math.asin(sinp);
   }

   const siny_cosp = 2 * (w * z + x * y);
   const cosy_cosp = 1 - 2 * (y * y + z * z);

   out.z = Math.atan2(siny_cosp, cosy_cosp);

   return out;
}

/**
 * performs a spherical linear interpolation between two quat's
 *
 * @param out - the receiving quaternion
 * @param a - the first operand
 * @param b - the second operand
 * @param t - interpolation amount, in the range [0-1]
 *
 * @returns `out`
 */
export function slerp(
   out: Quat,
   a: Quat,
   b: Quat,
   t: number
): Quat {
   const ax = a.x;
   const ay = a.y;
   const az = a.z;
   const aw = a.w;

   let bx = b.x;
   let by = b.y;
   let bz = b.z;
   let bw = b.w;

   let scale0: number;
   let scale1: number;

   let cosom = (
      ax * bx
      + ay * by
      + az * bz
      + aw * bw
   );

   if (cosom < 0.0) {
      cosom = -cosom;

      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
   }

   if (1.0 - cosom > EPSILON) {
      const omega = Math.acos(cosom);
      const sinom = Math.sin(omega);

      scale0 = Math.sin((1.0 - t) * omega) / sinom;
      scale1 = Math.sin(t * omega) / sinom;
   } else {
      scale0 = 1.0 - t;
      scale1 = t;
   }

   out.x = (scale0 * ax + scale1 * bx);
   out.y = (scale0 * ay + scale1 * by);
   out.z = (scale0 * az + scale1 * bz);
   out.w = (scale0 * aw + scale1 * bw);

   return out;
}

/**
 * calculates the length of a quat
 *
 * @param a - quat to calculate length of
 *
 * @returns length of a
 */
export function length(
   a: Quat
): number {
   const x = a.x;
   const y = a.y;
   const z = a.z;
   const w = a.w;

   return Math.sqrt(x * x + y * y + z * z + w * w);
}

/**
 * calculates the squared length of a quat
 *
 * @param a - quat to calculate squared length of
 *
 * @returns squared length of a
 */
export function length_sq(
   a: Quat
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
 * normalizes a quat
 *
 * @param out - the receiving quaternion
 * @param a - the quaternion to normalize
 *
 * @returns `out`
 */
export function normalize(
   out: Quat,
   a: Quat
): Quat {
   let len = length_sq(a);

   if (len > 0) {
      len = 1 / Math.sqrt(len);
   }

   out.x = (a.x * len);
   out.y = (a.y * len);
   out.z = (a.z * len);
   out.w = (a.w * len);

   return out;
}

/**
 * calculates the inverse of a quat
 *
 * @param out - the receiving quaternion
 * @param a - quat to calculate inverse of
 *
 * @returns `out`
 */
export function invert(
   out: Quat,
   a: Quat
): Quat {
   const a0 = a.x;
   const a1 = a.y;
   const a2 = a.z;
   const a3 = a.w;

   const dot = (
      a0 * a0
      + a1 * a1
      + a2 * a2
      + a3 * a3
   );

   if (dot === 0) {
      out.x = 0;
      out.y = 0;
      out.z = 0;
      out.w = 0;

      return out;
   }

   const inv_dot = 1.0 / dot;

   out.x = (-a0 * inv_dot);
   out.y = (-a1 * inv_dot);
   out.z = (-a2 * inv_dot);
   out.w = (a3 * inv_dot);

   return out;
}

/**
 * calculates the conjugate of a quat
 *
 * @param out - the receiving quaternion
 * @param a - quat to calculate conjugate of
 *
 * @returns `out`
 */
export function conjugate(
   out: Quat,
   a: Quat
): Quat {
   out.x = -a.x;
   out.y = -a.y;
   out.z = -a.z;
   out.w = a.w;

   return out;
}

/**
 * copies the values from one quat to another
 *
 * @param out - the receiving quaternion
 * @param a - the source quaternion
 *
 * @returns `out`
 */
export function copy(
   out: Quat,
   a: Quat
): Quat {
   out.x = a.x;
   out.y = a.y;
   out.z = a.z;
   out.w = a.w;

   return out;
}

/**
 * performs a linear interpolation between two quats
 *
 * @param out - the receiving quaternion
 * @param a - the first operand
 * @param b - the second operand
 * @param t - interpolation amount, in the range [0-1]
 *
 * @returns `out`
 */
export function lerp(
   out: Quat,
   a: Quat,
   b: Quat,
   t: number
): Quat {
   out.x = (a.x + t * (b.x - a.x));
   out.y = (a.y + t * (b.y - a.y));
   out.z = (a.z + t * (b.z - a.z));
   out.w = (a.w + t * (b.w - a.w));

   return out;
}

/**
 * returns whether or not the quaternions have approximately the same elements.
 *
 * @param a - the first quaternion.
 * @param b - the second quaternion.
 *
 * @returns true if the quaternions are approximately equal
 */
export function equals_approximately(
   a: Quat,
   b: Quat
): boolean {
   return (
      Math.abs(a.x - b.x) <= EPSILON * Math.max(1.0, Math.abs(a.x), Math.abs(b.x))
      && Math.abs(a.y - b.y) <= EPSILON * Math.max(1.0, Math.abs(a.y), Math.abs(b.y))
      && Math.abs(a.z - b.z) <= EPSILON * Math.max(1.0, Math.abs(a.z), Math.abs(b.z))
      && Math.abs(a.w - b.w) <= EPSILON * Math.max(1.0, Math.abs(a.w), Math.abs(b.w))
   );
}

/**
 * returns whether or not the quaternions have exactly the same elements.
 *
 * @param a - the first quaternion.
 * @param b - the second quaternion.
 *
 * @returns true if the quaternions are equal
 */
export function equals(
   a: Quat,
   b: Quat
): boolean {
   return (
      a.x === b.x
      && a.y === b.y
      && a.z === b.z
      && a.w === b.w
   );
}