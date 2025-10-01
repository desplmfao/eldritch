/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/src/cpu/quat.ts
 */

import type { f32, t } from '@eldritch-engine/type-utils/guerrero/markers';

import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import * as quat_ops from '@self/cpu/quat_ops';
import type { Vec3 } from '@self/cpu/vec3';
import type { Mat3 } from '@self/cpu/mat3';

@Reflectable({ alias_for: 'fixed_arr<f32, 4>', alias_mode: 'extend' })
export class Quat {

   get x(): t<f32> {
      return this[0]!;
   }

   set x(v: t<f32>) {
      this[0] = v;
   }

   get y(): t<f32> {
      return this[1]!;
   }

   set y(v: t<f32>) {
      this[1] = v;
   }

   get z(): t<f32> {
      return this[2]!;
   }

   set z(v: t<f32>) {
      this[2] = v;
   }

   get w(): t<f32> {
      return this[3]!;
   }

   set w(v: number) {
      this[3] = v;
   }

   static multiply = quat_ops.multiply;
   static set_axis_angle = quat_ops.set_axis_angle;
   static from_euler = quat_ops.from_euler;
   static to_euler = quat_ops.to_euler;
   static normalize = quat_ops.normalize;
   static copy = quat_ops.copy;
   static lerp = quat_ops.lerp;
   static slerp = quat_ops.slerp;
   static equals = quat_ops.equals;
   static equals_approximately = quat_ops.equals_approximately;
   static magnitude = quat_ops.length;
   static magnitude_sq = quat_ops.length_sq;
   static invert = quat_ops.invert;
   static conjugate = quat_ops.conjugate;
   static identity = quat_ops.identity;
   static rotate_x = quat_ops.rotate_x;
   static rotate_y = quat_ops.rotate_y;
   static rotate_z = quat_ops.rotate_z;
   static from_mat3 = quat_ops.from_mat3;

   multiply(b: Quat, out: Quat = this): Quat {
      return quat_ops.multiply(out, this, b);
   }

   set_axis_angle(axis: Vec3, rad: number): Quat {
      return quat_ops.set_axis_angle(this, axis, rad);
   }

   from_euler(x: number, y: number, z: number): Quat {
      return quat_ops.from_euler(this, x, y, z);
   }

   to_euler(out: Vec3): Vec3 {
      return quat_ops.to_euler(out, this);
   }

   normalize(out: Quat = this): Quat {
      return quat_ops.normalize(out, this);
   }

   copy(a: Quat): Quat {
      return quat_ops.copy(this, a);
   }

   lerp(b: Quat, t: number, out: Quat = this): Quat {
      return quat_ops.lerp(out, this, b, t);
   }

   slerp(b: Quat, t: number, out: Quat = this): Quat {
      return quat_ops.slerp(out, this, b, t);
   }

   invert(out: Quat = this): Quat {
      return quat_ops.invert(out, this);
   }

   conjugate(out: Quat = this): Quat {
      return quat_ops.conjugate(out, this);
   }

   identity(): Quat {
      return quat_ops.identity(this);
   }

   rotate_x(rad: number, out: Quat = this): Quat {
      return quat_ops.rotate_x(out, this, rad);
   }

   rotate_y(rad: number, out: Quat = this): Quat {
      return quat_ops.rotate_y(out, this, rad);
   }

   rotate_z(rad: number, out: Quat = this): Quat {
      return quat_ops.rotate_z(out, this, rad);
   }

   from_mat3(m: Mat3): Quat {
      return quat_ops.from_mat3(this, m);
   }

   magnitude(): number {
      return quat_ops.length(this);
   }

   magnitude_sq(): number {
      return quat_ops.length_sq(this);
   }

   equals(b: Quat): boolean {
      return quat_ops.equals(this, b);
   }

   equals_approximately(b: Quat): boolean {
      return quat_ops.equals_approximately(this, b);
   }
}

export interface Quat {
   readonly length: 4;

   [index: number]: t<f32> | undefined;

   [0]: t<f32>;
   [1]: t<f32>;
   [2]: t<f32>;
   [3]: t<f32>;

   get(index: number): t<f32> | undefined;
   set(index: number, value: t<f32>): boolean;
}