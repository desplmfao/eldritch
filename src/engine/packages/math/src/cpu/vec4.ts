/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/src/cpu/vec4.ts
 */

import type { f32, t } from '@eldritch-engine/type-utils/guerrero/markers';
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import * as vec4_ops from '@self/cpu/vec4_ops';
import type { Mat4 } from '@self/cpu/mat4';

@Reflectable({ alias_for: 'fixed_arr<f32, 4>', alias_mode: 'extend' })
export class Vec4 {

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

   set w(v: t<f32>) {
      this[3] = v;
   }

   static add = vec4_ops.add;
   static subtract = vec4_ops.subtract;
   static multiply = vec4_ops.multiply;
   static divide = vec4_ops.divide;
   static scale = vec4_ops.scale;
   static dot = vec4_ops.dot;
   static normalize = vec4_ops.normalize;
   static copy = vec4_ops.copy;
   static lerp = vec4_ops.lerp;
   static equals = vec4_ops.equals;
   static equals_approximately = vec4_ops.equals_approximately;
   static magnitude = vec4_ops.length;
   static magnitude_sq = vec4_ops.length_sq;
   static distance = vec4_ops.distance;
   static distance_sq = vec4_ops.distance_sq;
   static negate = vec4_ops.negate;
   static transform_mat4 = vec4_ops.transform_mat4;

   add(b: Vec4, out: Vec4 = this): Vec4 {
      return vec4_ops.add(out, this, b);
   }

   subtract(b: Vec4, out: Vec4 = this): Vec4 {
      return vec4_ops.subtract(out, this, b);
   }

   multiply(b: Vec4, out: Vec4 = this): Vec4 {
      return vec4_ops.multiply(out, this, b);
   }

   divide(b: Vec4, out: Vec4 = this): Vec4 {
      return vec4_ops.divide(out, this, b);
   }

   scale(s: number, out: Vec4 = this): Vec4 {
      return vec4_ops.scale(out, this, s);
   }

   normalize(out: Vec4 = this): Vec4 {
      return vec4_ops.normalize(out, this);
   }

   negate(out: Vec4 = this): Vec4 {
      return vec4_ops.negate(out, this);
   }

   copy(a: Vec4): Vec4 {
      return vec4_ops.copy(this, a);
   }

   lerp(b: Vec4, t: number, out: Vec4 = this): Vec4 {
      return vec4_ops.lerp(out, this, b, t);
   }

   transform_mat4(m: Mat4, out: Vec4 = this): Vec4 {
      return vec4_ops.transform_mat4(out, this, m);
   }

   dot(b: Vec4): number {
      return vec4_ops.dot(this, b);
   }

   magnitude(): number {
      return vec4_ops.length(this);
   }

   magnitude_sq(): number {
      return vec4_ops.length_sq(this);
   }

   distance(b: Vec4): number {
      return vec4_ops.distance(this, b);
   }

   distance_sq(b: Vec4): number {
      return vec4_ops.distance_sq(this, b);
   }

   equals(b: Vec4): boolean {
      return vec4_ops.equals(this, b);
   }

   equals_approximately(b: Vec4): boolean {
      return vec4_ops.equals_approximately(this, b);
   }
}

export interface Vec4 {
   readonly length: 4;

   [index: number]: t<f32> | undefined;

   [0]: t<f32>;
   [1]: t<f32>;
   [2]: t<f32>;
   [3]: t<f32>;

   get(index: number): t<f32> | undefined;
   set(index: number, value: t<f32>): boolean;
}