/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/tests/cpu/mat4.test.ts
 */

// @ts-nocheck

import { describe, it, expect, beforeEach } from 'bun:test';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

import { Vec3 } from '@self/cpu/vec3';
import { Vec4 } from '@self/cpu/vec4';
import { Quat } from '@self/cpu/quat';
import { Mat4 } from '@self/cpu/mat4';

describe('Mat4', () => {
   let allocator: TlsfAllocator;
   let buffer: ArrayBuffer;
   let mat_a: Mat4;
   let mat_b: Mat4;
   let out: Mat4;

   beforeEach(() => {
      buffer = new ArrayBuffer(1024 * 16);
      allocator = new TlsfAllocator(buffer);

      const mat_a_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
      mat_a = new Mat4(buffer, mat_a_ptr, allocator);
      Mat4.identity(mat_a);

      const mat_b_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
      mat_b = new Mat4(buffer, mat_b_ptr, allocator);
      Mat4.identity(mat_b);

      const out_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
      out = new Mat4(buffer, out_ptr, allocator);
      Mat4.identity(out);
   });

   describe('creation and properties', () => {
      it('should create a new identity mat4 when using the allocator', () => {
         const m_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const m = new Mat4(buffer, m_ptr, allocator);
         Mat4.identity(m);

         const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

         for (let i = 0; i < 16; i++) {
            expect(m[i]).toBe(identity[i]);
         }
      });

      it('should allow getting and setting via index access', () => {
         const m_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const m = new Mat4(buffer, m_ptr, allocator);
         Mat4.identity(m);

         m[5] = 2.5;
         expect(m[5]).toBe(2.5);
      });

      it('should have a length property of 16', () => {
         expect(mat_a.length).toBe(16);
      });
   });

   describe('static operations', () => {
      it('Mat4.copy should copy a matrix', () => {
         mat_a[0] = 5;
         mat_a[5] = 10;
         mat_a[15] = 20;

         Mat4.copy(out, mat_a);
         expect(out.equals(mat_a)).toBe(true);
      });

      it('Mat4.multiply should multiply two matrices', () => {
         const rot_y_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const rot_y = new Mat4(buffer, rot_y_ptr, allocator);
         Mat4.identity(rot_y);

         const rot_vec_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const rot_vec = new Vec3(buffer, rot_vec_ptr, allocator);
         rot_vec.x = 0;
         rot_vec.y = 1;
         rot_vec.z = 0;
         Mat4.from_rotation(rot_y, Math.PI / 2, rot_vec);

         const trans_x_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const trans_x = new Mat4(buffer, trans_x_ptr, allocator);
         Mat4.identity(trans_x);

         const trans_vec_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const trans_vec = new Vec3(buffer, trans_vec_ptr, allocator);
         trans_vec.x = 10;
         trans_vec.y = 0;
         trans_vec.z = 0;
         Mat4.from_translation(trans_x, trans_vec);

         Mat4.multiply(out, rot_y, trans_x);

         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 0;
         v.y = 0;
         v.z = 0;
         v.w = 1;
         v.transform_mat4(out);

         expect(v.x).toBeCloseTo(0);
         expect(v.y).toBeCloseTo(0);
         expect(v.z).toBeCloseTo(-10);
      });

      it('Mat4.invert should produce the inverse', () => {
         const trans_vec_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const trans_vec = new Vec3(buffer, trans_vec_ptr, allocator);
         trans_vec.x = 1;
         trans_vec.y = 2;
         trans_vec.z = 3;
         Mat4.from_translation(mat_a, trans_vec);
         Mat4.invert(out, mat_a);

         const expected_inv_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const expected_inv = new Mat4(buffer, expected_inv_ptr, allocator);
         Mat4.identity(expected_inv);
         expected_inv[12] = -1;
         expected_inv[13] = -2;
         expected_inv[14] = -3;

         expect(out.equals_approximately(expected_inv)).toBe(true);
         Mat4.multiply(out, mat_a, out);

         const ident_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const ident = new Mat4(buffer, ident_ptr, allocator);
         Mat4.identity(ident);
         expect(out.equals_approximately(ident)).toBe(true);
      });

      it('Mat4.determinant of identity should be 1', () => {
         expect(Mat4.determinant(mat_a)).toBe(1);
      });

      it('Mat4.determinant of a scaled matrix should be scale_x * scale_y * scale_z', () => {
         const scale_vec_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const scale_vec = new Vec3(buffer, scale_vec_ptr, allocator);
         scale_vec.x = 2;
         scale_vec.y = 3;
         scale_vec.z = 4;
         Mat4.from_scaling(mat_a, scale_vec);

         expect(Mat4.determinant(mat_a)).toBe(2 * 3 * 4);
      });

      it('Mat4.from_translation should create a translation matrix', () => {
         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;
         v.z = 3;
         Mat4.from_translation(out, v);

         expect(out[12]).toBe(1);
         expect(out[13]).toBe(2);
         expect(out[14]).toBe(3);
      });

      it('Mat4.from_scaling should create a scaling matrix', () => {
         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;
         v.z = 3;
         Mat4.from_scaling(out, v);

         expect(out[0]).toBe(1);
         expect(out[5]).toBe(2);
         expect(out[10]).toBe(3);
      });

      it('Mat4.from_rotation should create a rotation matrix', () => {
         const axis_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const axis = new Vec3(buffer, axis_ptr, allocator);
         axis.x = 0;
         axis.y = 1;
         axis.z = 0;
         Mat4.from_rotation(out, Math.PI / 2, axis);

         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 0;
         v.z = 0;
         v.w = 1;
         v.transform_mat4(out);

         expect(v.x).toBeCloseTo(0);
         expect(v.z).toBeCloseTo(-1);
      });

      it('Mat4.from_quat should create a rotation matrix from a quaternion', () => {
         const q_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const q = new Quat(buffer, q_ptr, allocator);
         q.x = 0;
         q.y = 0;
         q.z = 0;
         q.w = 1;

         const axis_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const axis = new Vec3(buffer, axis_ptr, allocator);
         axis.x = 0;
         axis.y = 1;
         axis.z = 0;

         Quat.set_axis_angle(q, axis, Math.PI / 2);
         Mat4.from_quat(out, q);

         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 0;
         v.z = 0;
         v.w = 1;
         v.transform_mat4(out);

         expect(v.x).toBeCloseTo(0);
         expect(v.z).toBeCloseTo(-1);
      });

      it('Mat4.perspective should create a perspective matrix', () => {
         Mat4.perspective(out, Math.PI / 2, 1.0, 0.1, 100.0);
         expect(out[0]).toBeCloseTo(1.0);
         expect(out[5]).toBeCloseTo(1.0);
         expect(out[10]).toBeCloseTo(-100.1 / 99.9);
         expect(out[11]).toBe(-1);
         expect(out[14]).toBeCloseTo(-20 / 99.9);
      });

      it('Mat4.look_at should create a view matrix', () => {
         const eye_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const eye = new Vec3(buffer, eye_ptr, allocator);
         eye.x = 0;
         eye.y = 0;
         eye.z = 5;

         const center_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const center = new Vec3(buffer, center_ptr, allocator);
         center.x = 0;
         center.y = 0;
         center.z = 0;

         const up_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const up = new Vec3(buffer, up_ptr, allocator);
         up.x = 0;
         up.y = 1;
         up.z = 0;

         Mat4.look_at(out, eye, center, up);

         expect(out[14]).toBe(-5);
      });
   });

   describe('instance methods', () => {
      it('multiply should perform multiplication and modify the instance by default', () => {
         const a_orig_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const a_orig = new Mat4(buffer, a_orig_ptr, allocator);
         a_orig.copy(mat_a);

         const b_orig_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const b_orig = new Mat4(buffer, b_orig_ptr, allocator);
         b_orig.copy(mat_b);

         mat_a.multiply(mat_b);

         const expected_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const expected = new Mat4(buffer, expected_ptr, allocator);
         Mat4.identity(expected);
         Mat4.multiply(expected, a_orig, b_orig);

         expect(mat_a.equals(expected)).toBe(true);
      });

      it('invert should modify the instance by default', () => {
         const trans_vec_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const trans_vec = new Vec3(buffer, trans_vec_ptr, allocator);
         trans_vec.x = 1;
         trans_vec.y = 2;
         trans_vec.z = 3;
         Mat4.from_translation(mat_a, trans_vec);

         const a_orig_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const a_orig = new Mat4(buffer, a_orig_ptr, allocator); a_orig.copy(mat_a);
         mat_a.invert();

         const expected_inv_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const expected_inv = new Mat4(buffer, expected_inv_ptr, allocator);
         Mat4.identity(expected_inv);
         Mat4.invert(expected_inv, a_orig);

         expect(mat_a.equals(expected_inv)).toBe(true);
      });
   });

   describe('comparisons', () => {
      it('equals should return true for identical matrices', () => {
         const m_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const m = new Mat4(buffer, m_ptr, allocator);
         Mat4.identity(m);

         expect(mat_a.equals(m)).toBe(true);
      });

      it('equals_approximately should return true for nearly identical matrices', () => {
         const m_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const m = new Mat4(buffer, m_ptr, allocator);
         Mat4.identity(m);

         m[10] = 1.00000001;

         expect(mat_a.equals_approximately(m)).toBe(true);
      });
   });

   describe('mathematical properties', () => {
      it('A * I = A', () => {
         mat_a[5] = 1.23;
         mat_a[12] = 4.56;

         const a_orig_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const a_orig = new Mat4(buffer, a_orig_ptr, allocator);
         a_orig.copy(mat_a);
         const ident_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const ident = new Mat4(buffer, ident_ptr, allocator);
         Mat4.identity(ident);
         mat_a.multiply(ident);

         expect(mat_a.equals(a_orig)).toBe(true);
      });

      it('A * A_inv = I', () => {
         const rot_axis_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const rot_axis = new Vec3(buffer, rot_axis_ptr, allocator);
         rot_axis.x = 1;
         rot_axis.y = 2;
         rot_axis.z = 3;
         Mat4.from_rotation(mat_a, Math.PI / 4, rot_axis);
         const inv_a_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const inv_a = new Mat4(buffer, inv_a_ptr, allocator);
         Mat4.identity(inv_a);
         Mat4.invert(inv_a, mat_a);
         mat_a.multiply(inv_a);
         const ident_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const ident = new Mat4(buffer, ident_ptr, allocator);
         Mat4.identity(ident);
         expect(mat_a.equals_approximately(ident)).toBe(true);
      });

      it('(A^T)^T = A', () => {
         const rot_axis_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const rot_axis = new Vec3(buffer, rot_axis_ptr, allocator);
         rot_axis.x = 1;
         rot_axis.y = 2;
         rot_axis.z = 3;
         Mat4.from_rotation(mat_a, Math.PI / 4, rot_axis);

         const a_orig_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const a_orig = new Mat4(buffer, a_orig_ptr, allocator); a_orig.copy(mat_a);
         mat_a.transpose().transpose();

         expect(mat_a.equals_approximately(a_orig)).toBe(true);
      });
   });
});