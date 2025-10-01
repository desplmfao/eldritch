/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/tests/cpu/mat3.test.ts
 */

// @ts-nocheck

import { describe, it, expect, beforeEach } from 'bun:test';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

import { Vec2 } from '@self/cpu/vec2';
import { Mat3 } from '@self/cpu/mat3';
import { Mat4 } from '@self/cpu/mat4';
import { Quat } from '@self/cpu/quat';
import { Vec3 } from '@self/cpu/vec3';

describe('Mat3', () => {
   let allocator: TlsfAllocator;
   let buffer: ArrayBuffer;
   let mat_a: Mat3;
   let mat_b: Mat3;
   let out: Mat3;

   beforeEach(() => {
      buffer = new ArrayBuffer(1024 * 16);
      allocator = new TlsfAllocator(buffer);

      const mat_a_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
      mat_a = new Mat3(buffer, mat_a_ptr, allocator);
      Mat3.identity(mat_a);

      const mat_b_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
      mat_b = new Mat3(buffer, mat_b_ptr, allocator);
      Mat3.identity(mat_b);

      const out_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
      out = new Mat3(buffer, out_ptr, allocator);
      Mat3.identity(out);
   });

   describe('creation and properties', () => {
      it('should create a new identity mat3 when using the allocator', () => {
         const m_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const m = new Mat3(buffer, m_ptr, allocator);
         Mat3.identity(m);

         const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];

         for (let i = 0; i < 9; i++) {
            expect(m[i]).toBe(identity[i]);
         }
      });

      it('should allow getting and setting via index access', () => {
         const m_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const m = new Mat3(buffer, m_ptr, allocator);
         Mat3.identity(m);

         m[4] = 2.5;

         expect(m[4]).toBe(2.5);
      });

      it('should have a length property of 9', () => {
         expect(mat_a.length).toBe(9);
      });
   });

   describe('static operations', () => {
      it('Mat3.copy should copy a matrix', () => {
         mat_a[0] = 5;
         mat_a[4] = 10;
         mat_a[8] = 20;

         Mat3.copy(out, mat_a);
         expect(out.equals(mat_a)).toBe(true);
      });

      it('Mat3.multiply should multiply two matrices', () => {
         const rot_z_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const rot_z = new Mat3(buffer, rot_z_ptr, allocator);
         Mat3.identity(rot_z);
         Mat3.from_rotation(rot_z, Math.PI / 2);

         const trans_x_y_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const trans_x_y = new Mat3(buffer, trans_x_y_ptr, allocator);
         Mat3.identity(trans_x_y);

         const trans_vec_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const trans_vec = new Vec2(buffer, trans_vec_ptr, allocator);
         trans_vec.x = 10;
         trans_vec.y = 0;
         Mat3.from_translation(trans_x_y, trans_vec);

         Mat3.multiply(out, rot_z, trans_x_y);

         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 0;
         v.y = 0;
         v.transform_mat3(out);

         expect(v.x).toBeCloseTo(0);
         expect(v.y).toBeCloseTo(10);
      });

      it('Mat3.invert should produce the inverse', () => {
         const trans_vec_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const trans_vec = new Vec2(buffer, trans_vec_ptr, allocator);
         trans_vec.x = 1;
         trans_vec.y = 2;
         Mat3.from_translation(mat_a, trans_vec);
         Mat3.invert(out, mat_a);

         const expected_inv_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const expected_inv = new Mat3(buffer, expected_inv_ptr, allocator);
         Mat3.identity(expected_inv);
         expected_inv[6] = -1;
         expected_inv[7] = -2;

         expect(out.equals_approximately(expected_inv)).toBe(true);

         Mat3.multiply(out, mat_a, out); // A * A_inv

         const ident_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const ident = new Mat3(buffer, ident_ptr, allocator);
         Mat3.identity(ident);
         expect(out.equals_approximately(ident)).toBe(true);
      });

      it('Mat3.determinant of identity should be 1', () => {
         expect(Mat3.determinant(mat_a)).toBe(1);
      });

      it('Mat3.determinant of a scaled matrix should be scale_x * scale_y', () => {
         const scale_vec_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const scale_vec = new Vec2(buffer, scale_vec_ptr, allocator);
         scale_vec.x = 2;
         scale_vec.y = 3;
         Mat3.from_scaling(mat_a, scale_vec);

         expect(Mat3.determinant(mat_a)).toBe(2 * 3);
      });

      it('Mat3.from_translation should create a translation matrix', () => {
         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;
         Mat3.from_translation(out, v);

         expect(out[6]).toBe(1);
         expect(out[7]).toBe(2);
      });

      it('Mat3.from_scaling should create a scaling matrix', () => {
         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 2;
         v.y = 3;
         Mat3.from_scaling(out, v);

         expect(out[0]).toBe(2);
         expect(out[4]).toBe(3);
      });

      it('Mat3.from_rotation should create a rotation matrix', () => {
         Mat3.from_rotation(out, Math.PI / 2);
         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 0;
         v.transform_mat3(out);

         expect(v.x).toBeCloseTo(0);
         expect(v.y).toBeCloseTo(1);
      });

      it('Mat3.from_mat4 should create a mat3 from the upper-left of a mat4', () => {
         const m4_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         const m4 = new Mat4(buffer, m4_ptr, allocator);
         Mat4.identity(m4);

         m4[0] = 1;
         m4[1] = 2;
         m4[2] = 3;

         m4[4] = 5;
         m4[5] = 6;
         m4[6] = 7;

         m4[8] = 9;
         m4[9] = 10;
         m4[10] = 11;

         m4[15] = 42; // does nothing

         Mat3.from_mat4(out, m4);

         expect(out[0]).toBe(1);
         expect(out[1]).toBe(2);
         expect(out[2]).toBe(3);

         expect(out[3]).toBe(5);
         expect(out[4]).toBe(6);
         expect(out[5]).toBe(7);

         expect(out[6]).toBe(9);
         expect(out[7]).toBe(10);
         expect(out[8]).toBe(11);
      });

      it('Mat3.from_quat should create a rotation matrix from a quaternion', () => {
         const q_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const q = new Quat(buffer, q_ptr, allocator);
         q.x = 0;
         q.y = 0;
         q.z = 0;
         q.w = 1;

         const axis_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const axis = new Vec3(buffer, axis_ptr, allocator);
         axis.x = 0;
         axis.y = 0;
         axis.z = 1;

         Quat.set_axis_angle(q, axis, Math.PI / 2);
         Mat3.from_quat(out, q);

         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 0;
         v.transform_mat3(out);

         expect(v.x).toBeCloseTo(0);
         expect(v.y).toBeCloseTo(1);
      });
   });

   describe('instance methods', () => {
      it('multiply should perform multiplication and modify the instance by default', () => {
         const a_orig_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const a_orig = new Mat3(buffer, a_orig_ptr, allocator);
         a_orig.copy(mat_a);

         const b_orig_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const b_orig = new Mat3(buffer, b_orig_ptr, allocator);
         b_orig.copy(mat_b);

         mat_a.multiply(mat_b);

         const expected_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const expected = new Mat3(buffer, expected_ptr, allocator);
         Mat3.identity(expected);
         Mat3.multiply(expected, a_orig, b_orig);

         expect(mat_a.equals(expected)).toBe(true);
      });

      it('invert should modify the instance by default', () => {
         const trans_vec_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const trans_vec = new Vec2(buffer, trans_vec_ptr, allocator);
         trans_vec.x = 1;
         trans_vec.y = 2;
         Mat3.from_translation(mat_a, trans_vec);

         const a_orig_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const a_orig = new Mat3(buffer, a_orig_ptr, allocator);
         a_orig.copy(mat_a);

         mat_a.invert();

         const expected_inv_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const expected_inv = new Mat3(buffer, expected_inv_ptr, allocator);
         Mat3.identity(expected_inv);
         Mat3.invert(expected_inv, a_orig);

         expect(mat_a.equals(expected_inv)).toBe(true);
      });
   });

   describe('comparisons', () => {
      it('equals should return true for identical matrices', () => {
         const m_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const m = new Mat3(buffer, m_ptr, allocator);
         Mat3.identity(m);

         expect(mat_a.equals(m)).toBe(true);
      });

      it('equals_approximately should return true for nearly identical matrices', () => {
         const m_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const m = new Mat3(buffer, m_ptr, allocator);
         Mat3.identity(m);

         m[4] = 1.00000001;

         expect(mat_a.equals_approximately(m)).toBe(true);
      });
   });

   describe('mathematical properties', () => {
      it('A * I = A', () => {
         mat_a[4] = 1.23;
         mat_a[6] = 4.56;

         const a_orig_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const a_orig = new Mat3(buffer, a_orig_ptr, allocator);
         a_orig.copy(mat_a);

         const ident_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const ident = new Mat3(buffer, ident_ptr, allocator);
         Mat3.identity(ident);

         mat_a.multiply(ident);

         expect(mat_a.equals(a_orig)).toBe(true);
      });

      it('A * A_inv = I', () => {
         Mat3.from_rotation(mat_a, Math.PI / 4);
         const inv_a_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const inv_a = new Mat3(buffer, inv_a_ptr, allocator);
         Mat3.identity(inv_a);

         Mat3.invert(inv_a, mat_a);
         mat_a.multiply(inv_a);

         const ident_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const ident = new Mat3(buffer, ident_ptr, allocator);
         Mat3.identity(ident);

         expect(mat_a.equals_approximately(ident)).toBe(true);
      });

      it('(A^T)^T = A', () => {
         Mat3.from_rotation(mat_a, Math.PI / 4);
         const a_orig_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const a_orig = new Mat3(buffer, a_orig_ptr, allocator);
         a_orig.copy(mat_a);

         mat_a.transpose().transpose();

         expect(mat_a.equals_approximately(a_orig)).toBe(true);
      });
   });
});