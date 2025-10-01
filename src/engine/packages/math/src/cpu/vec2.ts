/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/src/cpu/vec2.ts
 */

import type { f32, t } from '@eldritch-engine/type-utils/guerrero/markers';
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import * as vec2_ops from '@self/cpu/vec2_ops';
import type { Mat3 } from '@self/cpu/mat3';

@Reflectable({ alias_for: 'fixed_arr<f32, 2>', alias_mode: 'extend' })
export class Vec2 {

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

   static add = vec2_ops.add;
   static subtract = vec2_ops.subtract;
   static multiply = vec2_ops.multiply;
   static divide = vec2_ops.divide;
   static scale = vec2_ops.scale;
   static dot = vec2_ops.dot;
   static normalize = vec2_ops.normalize;
   static copy = vec2_ops.copy;
   static lerp = vec2_ops.lerp;
   static equals = vec2_ops.equals;
   static equals_approximately = vec2_ops.equals_approximately;
   static magnitude = vec2_ops.length;
   static magnitude_sq = vec2_ops.length_sq;
   static distance = vec2_ops.distance;
   static distance_sq = vec2_ops.distance_sq;
   static negate = vec2_ops.negate;
   static transform_mat3 = vec2_ops.transform_mat3;

   add(b: Vec2, out: Vec2 = this): Vec2 {
      return vec2_ops.add(out, this, b);
   }

   subtract(b: Vec2, out: Vec2 = this): Vec2 {
      return vec2_ops.subtract(out, this, b);
   }

   multiply(b: Vec2, out: Vec2 = this): Vec2 {
      return vec2_ops.multiply(out, this, b);
   }

   divide(b: Vec2, out: Vec2 = this): Vec2 {
      return vec2_ops.divide(out, this, b);
   }

   scale(s: number, out: Vec2 = this): Vec2 {
      return vec2_ops.scale(out, this, s);
   }

   normalize(out: Vec2 = this): Vec2 {
      return vec2_ops.normalize(out, this);
   }

   negate(out: Vec2 = this): Vec2 {
      return vec2_ops.negate(out, this);
   }

   copy(a: Vec2): Vec2 {
      return vec2_ops.copy(this, a);
   }

   lerp(b: Vec2, t: number, out: Vec2 = this): Vec2 {
      return vec2_ops.lerp(out, this, b, t);
   }

   transform_mat3(m: Mat3, out: Vec2 = this): Vec2 {
      return vec2_ops.transform_mat3(out, this, m);
   }

   dot(b: Vec2): number {
      return vec2_ops.dot(this, b);
   }

   magnitude(): number {
      return vec2_ops.length(this);
   }

   magnitude_sq(): number {
      return vec2_ops.length_sq(this);
   }

   distance(b: Vec2): number {
      return vec2_ops.distance(this, b);
   }

   distance_sq(b: Vec2): number {
      return vec2_ops.distance_sq(this, b);
   }

   equals(b: Vec2): boolean {
      return vec2_ops.equals(this, b);
   }

   equals_approximately(b: Vec2): boolean {
      return vec2_ops.equals_approximately(this, b);
   }
}

export interface Vec2 {
   readonly length: 2;

   [index: number]: t<f32> | undefined;

   [0]: t<f32>;
   [1]: t<f32>;

   get(index: number): t<f32> | undefined;
   set(index: number, value: t<f32>): boolean;
}