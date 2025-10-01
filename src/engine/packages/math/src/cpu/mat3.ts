/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/src/cpu/mat3.ts
 */

import type { f32, t } from '@eldritch-engine/type-utils/guerrero/markers';

import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import * as mat3_ops from '@self/cpu/mat3_ops';
import type { Vec2 } from '@self/cpu/vec2';
import type { Mat4 } from '@self/cpu/mat4';
import type { Quat } from '@self/cpu/quat';

@Reflectable({ alias_for: 'fixed_arr<f32, 9>', alias_mode: 'extend' })
export class Mat3 {

   static identity = mat3_ops.identity;
   static copy = mat3_ops.copy;
   static multiply = mat3_ops.multiply;
   static transpose = mat3_ops.transpose;
   static invert = mat3_ops.invert;
   static determinant = mat3_ops.determinant;
   static adjoint = mat3_ops.adjoint;
   static translate = mat3_ops.translate;
   static rotate = mat3_ops.rotate;
   static scale = mat3_ops.scale;
   static from_mat4 = mat3_ops.from_mat4;
   static from_quat = mat3_ops.from_quat;
   static from_translation = mat3_ops.from_translation;
   static from_rotation = mat3_ops.from_rotation;
   static from_scaling = mat3_ops.from_scaling;
   static equals = mat3_ops.equals;
   static equals_approximately = mat3_ops.equals_approximately;
   static lerp = mat3_ops.lerp;

   identity(): Mat3 {
      return mat3_ops.identity(this);
   }

   copy(a: Mat3): Mat3 {
      return mat3_ops.copy(this, a);
   }

   multiply(b: Mat3, out: Mat3 = this): Mat3 {
      return mat3_ops.multiply(out, this, b);
   }

   transpose(out: Mat3 = this): Mat3 {
      return mat3_ops.transpose(out, this);
   }

   invert(out: Mat3 = this): Mat3 {
      return mat3_ops.invert(out, this);
   }

   determinant(): number {
      return mat3_ops.determinant(this);
   }

   adjoint(out: Mat3 = this): Mat3 {
      return mat3_ops.adjoint(out, this);
   }

   translate(v: Vec2, out: Mat3 = this): Mat3 {
      return mat3_ops.translate(out, this, v);
   }

   rotate(rad: number, out: Mat3 = this): Mat3 {
      return mat3_ops.rotate(out, this, rad);
   }

   scale(v: Vec2, out: Mat3 = this): Mat3 {
      return mat3_ops.scale(out, this, v);
   }

   from_mat4(m: Mat4): Mat3 {
      return mat3_ops.from_mat4(this, m);
   }

   from_quat(q: Quat): Mat3 {
      return mat3_ops.from_quat(this, q);
   }

   from_translation(v: Vec2): Mat3 {
      return mat3_ops.from_translation(this, v);
   }

   from_rotation(rad: number): Mat3 {
      return mat3_ops.from_rotation(this, rad);
   }

   from_scaling(v: Vec2): Mat3 {
      return mat3_ops.from_scaling(this, v);
   }

   equals(b: Mat3): boolean {
      return mat3_ops.equals(this, b);
   }

   equals_approximately(b: Mat3): boolean {
      return mat3_ops.equals_approximately(this, b);
   }

   lerp(b: Mat3, t: number, out: Mat3 = this): Mat3 {
      return mat3_ops.lerp(out, this, b, t);
   }
}

export interface Mat3 {
   readonly length: 9;

   [index: number]: t<f32> | undefined;

   [0]: t<f32>;
   [1]: t<f32>;
   [2]: t<f32>;
   [3]: t<f32>;
   [4]: t<f32>;
   [5]: t<f32>;
   [6]: t<f32>;
   [7]: t<f32>;
   [8]: t<f32>;

   get(index: number): t<f32> | undefined;
   set(index: number, value: t<f32>): boolean;
}