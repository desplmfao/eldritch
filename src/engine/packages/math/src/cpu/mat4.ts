/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/src/cpu/mat4.ts
 */

import type { f32, t } from '@eldritch-engine/type-utils/guerrero/markers';

import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import * as mat4_ops from '@self/cpu/mat4_ops';
import type { Vec3 } from '@self/cpu/vec3';
import type { Quat } from '@self/cpu/quat';

@Reflectable({ alias_for: 'fixed_arr<f32, 16>', alias_mode: 'extend' })
export class Mat4 {

   static identity = mat4_ops.identity;
   static copy = mat4_ops.copy;
   static multiply = mat4_ops.multiply;
   static transpose = mat4_ops.transpose;
   static invert = mat4_ops.invert;
   static determinant = mat4_ops.determinant;
   static translate = mat4_ops.translate;
   static rotate = mat4_ops.rotate;
   static rotate_x = mat4_ops.rotate_x;
   static rotate_y = mat4_ops.rotate_y;
   static rotate_z = mat4_ops.rotate_z;
   static scale = mat4_ops.scale;
   static from_translation = mat4_ops.from_translation;
   static from_rotation = mat4_ops.from_rotation;
   static from_scaling = mat4_ops.from_scaling;
   static from_quat = mat4_ops.from_quat;
   static perspective = mat4_ops.perspective;
   static ortho = mat4_ops.ortho;
   static look_at = mat4_ops.look_at;
   static equals = mat4_ops.equals;
   static equals_approximately = mat4_ops.equals_approximately;
   static lerp = mat4_ops.lerp;
   static adjoint = mat4_ops.adjoint;

   identity(): Mat4 {
      return mat4_ops.identity(this);
   }

   copy(a: Mat4): Mat4 {
      return mat4_ops.copy(this, a);
   }

   multiply(b: Mat4, out: Mat4 = this): Mat4 {
      return mat4_ops.multiply(out, this, b);
   }

   transpose(out: Mat4 = this): Mat4 {
      return mat4_ops.transpose(out, this);
   }

   invert(out: Mat4 = this): Mat4 {
      return mat4_ops.invert(out, this);
   }

   determinant(): number {
      return mat4_ops.determinant(this);
   }

   translate(v: Vec3, out: Mat4 = this): Mat4 {
      return mat4_ops.translate(out, this, v);
   }

   rotate(rad: number, axis: Vec3, out: Mat4 = this): Mat4 {
      return mat4_ops.rotate(out, this, rad, axis);
   }

   rotate_x(rad: number, out: Mat4 = this): Mat4 {
      return mat4_ops.rotate_x(out, this, rad);
   }

   rotate_y(rad: number, out: Mat4 = this): Mat4 {
      return mat4_ops.rotate_y(out, this, rad);
   }

   rotate_z(rad: number, out: Mat4 = this): Mat4 {
      return mat4_ops.rotate_z(out, this, rad);
   }

   scale(v: Vec3, out: Mat4 = this): Mat4 {
      return mat4_ops.scale(out, this, v);
   }

   from_translation(v: Vec3): Mat4 {
      return mat4_ops.from_translation(this, v);
   }

   from_rotation(rad: number, axis: Vec3): Mat4 {
      return mat4_ops.from_rotation(this, rad, axis);
   }

   from_scaling(v: Vec3): Mat4 {
      return mat4_ops.from_scaling(this, v);
   }

   from_quat(q: Quat): Mat4 {
      return mat4_ops.from_quat(this, q);
   }

   equals(b: Mat4): boolean {
      return mat4_ops.equals(this, b);
   }

   equals_approximately(b: Mat4): boolean {
      return mat4_ops.equals_approximately(this, b);
   }

   lerp(b: Mat4, t: number, out: Mat4 = this): Mat4 {
      return mat4_ops.lerp(out, this, b, t);
   }

   adjoint(out: Mat4 = this): Mat4 {
      return mat4_ops.adjoint(out, this);
   }
}

export interface Mat4 {
   readonly length: 16;

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
   [9]: t<f32>;
   [10]: t<f32>;
   [11]: t<f32>;
   [12]: t<f32>;
   [13]: t<f32>;
   [14]: t<f32>;
   [15]: t<f32>;

   get(index: number): t<f32> | undefined;
   set(index: number, value: t<f32>): boolean;
}