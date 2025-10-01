/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/src/cpu/vec3.ts
 */

import type { f32, t } from '@eldritch-engine/type-utils/guerrero/markers';

import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import * as vec3_ops from '@self/cpu/vec3_ops';
import type { Mat3 } from '@self/cpu/mat3';
import type { Quat } from '@self/cpu/quat';

@Reflectable({ alias_for: 'fixed_arr<f32, 3>', alias_mode: 'extend' })
export class Vec3 {

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

   static add = vec3_ops.add;
   static subtract = vec3_ops.subtract;
   static multiply = vec3_ops.multiply;
   static divide = vec3_ops.divide;
   static scale = vec3_ops.scale;
   static dot = vec3_ops.dot;
   static cross = vec3_ops.cross;
   static normalize = vec3_ops.normalize;
   static copy = vec3_ops.copy;
   static lerp = vec3_ops.lerp;
   static equals = vec3_ops.equals;
   static equals_approximately = vec3_ops.equals_approximately;
   static magnitude = vec3_ops.length;
   static magnitude_sq = vec3_ops.length_sq;
   static distance = vec3_ops.distance;
   static distance_sq = vec3_ops.distance_sq;
   static negate = vec3_ops.negate;
   static transform_mat3 = vec3_ops.transform_mat3;
   static transform_quat = vec3_ops.transform_quat;

   add(b: Vec3, out: Vec3 = this): Vec3 {
      return vec3_ops.add(out, this, b);
   }

   subtract(b: Vec3, out: Vec3 = this): Vec3 {
      return vec3_ops.subtract(out, this, b);
   }

   multiply(b: Vec3, out: Vec3 = this): Vec3 {
      return vec3_ops.multiply(out, this, b);
   }

   divide(b: Vec3, out: Vec3 = this): Vec3 {
      return vec3_ops.divide(out, this, b);
   }

   scale(s: number, out: Vec3 = this): Vec3 {
      return vec3_ops.scale(out, this, s);
   }

   cross(b: Vec3, out: Vec3 = this): Vec3 {
      return vec3_ops.cross(out, this, b);
   }

   normalize(out: Vec3 = this): Vec3 {
      return vec3_ops.normalize(out, this);
   }

   negate(out: Vec3 = this): Vec3 {
      return vec3_ops.negate(out, this);
   }

   copy(a: Vec3): Vec3 {
      return vec3_ops.copy(this, a);
   }

   lerp(b: Vec3, t: number, out: Vec3 = this): Vec3 {
      return vec3_ops.lerp(out, this, b, t);
   }

   transform_mat3(m: Mat3, out: Vec3 = this): Vec3 {
      return vec3_ops.transform_mat3(out, this, m);
   }

   transform_quat(q: Quat, out: Vec3 = this): Vec3 {
      return vec3_ops.transform_quat(out, this, q);
   }

   dot(b: Vec3): number {
      return vec3_ops.dot(this, b);
   }

   magnitude(): number {
      return vec3_ops.length(this);
   }

   magnitude_sq(): number {
      return vec3_ops.length_sq(this);
   }

   distance(b: Vec3): number {
      return vec3_ops.distance(this, b);
   }

   distance_sq(b: Vec3): number {
      return vec3_ops.distance_sq(this, b);
   }

   equals(b: Vec3): boolean {
      return vec3_ops.equals(this, b);
   }

   equals_approximately(b: Vec3): boolean {
      return vec3_ops.equals_approximately(this, b);
   }
}

export interface Vec3 {
   readonly length: 3;

   [index: number]: t<f32> | undefined;

   [0]: t<f32>;
   [1]: t<f32>;
   [2]: t<f32>;

   get(index: number): t<f32> | undefined;
   set(index: number, value: t<f32>): boolean;
}