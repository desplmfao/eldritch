/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/tests/cpu/quat.test.ts
 */

// @ts-nocheck

import { describe, it, expect, beforeEach } from 'bun:test';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

import { set_epsilon } from '@self/common';
import { Vec3 } from '@self/cpu/vec3';
import { Mat3 } from '@self/cpu/mat3';
import { Quat } from '@self/cpu/quat';

describe('Quat', () => {
   let allocator: TlsfAllocator;
   let buffer: ArrayBuffer;
   let quat_a: Quat;
   let quat_b: Quat;
   let out: Quat;
   let vec_tmp: Vec3;

   beforeEach(() => {
      buffer = new ArrayBuffer(1024 * 16);
      allocator = new TlsfAllocator(buffer);

      const quat_a_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
      quat_a = new Quat(buffer, quat_a_ptr, allocator);
      quat_a.x = 1;
      quat_a.y = 2;
      quat_a.z = 3;
      quat_a.w = 4;

      const quat_b_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
      quat_b = new Quat(buffer, quat_b_ptr, allocator);
      quat_b.x = 5;
      quat_b.y = 6;
      quat_b.z = 7;
      quat_b.w = 8;

      const out_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
      out = new Quat(buffer, out_ptr, allocator);
      out.x = 0;
      out.y = 0;
      out.z = 0;
      out.w = 1;

      const vec_tmp_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
      vec_tmp = new Vec3(buffer, vec_tmp_ptr, allocator);
      vec_tmp.x = 0;
      vec_tmp.y = 0;
      vec_tmp.z = 0;
   });

   describe('creation and properties', () => {
      it('should create a new quat with default values (0, 0, 0, 1) when using the allocator', () => {
         const q_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const q = new Quat(buffer, q_ptr, allocator);
         q.x = 0;
         q.y = 0;
         q.z = 0;
         q.w = 1;

         expect(q.x).toBe(0);
         expect(q.y).toBe(0);
         expect(q.z).toBe(0);
         expect(q.w).toBe(1);
      });

      it('should create a new quat with specified values', () => {
         const q_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const q = new Quat(buffer, q_ptr, allocator);
         q.x = 1;
         q.y = 2;
         q.z = 3;
         q.w = 4;

         expect(q[0]).toBe(1);
         expect(q[1]).toBe(2);
         expect(q[2]).toBe(3);
         expect(q[3]).toBe(4);
      });

      it('should allow getting and setting properties via x, y, z, w', () => {
         const q_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const q = new Quat(buffer, q_ptr, allocator);
         q.x = 0;
         q.y = 0;
         q.z = 0;
         q.w = 1;

         q.x = 10;
         q.y = 20;
         q.z = 30;
         q.w = 40;

         expect(q[0]).toBe(10);
         expect(q[1]).toBe(20);
         expect(q[2]).toBe(30);
         expect(q[3]).toBe(40);
      });

      it('should allow getting and setting via index access', () => {
         const q_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const q = new Quat(buffer, q_ptr, allocator);
         q.x = 0;
         q.y = 0;
         q.z = 0;
         q.w = 1;

         q[0] = 11;
         q[1] = 22;
         q[2] = 33;
         q[3] = 44;

         expect(q.x).toBe(11);
         expect(q.y).toBe(22);
         expect(q.z).toBe(33);
         expect(q.w).toBe(44);
      });

      it('should have a length property of 4', () => {
         expect(quat_a.length).toBe(4);
      });

      it('should return undefined for out-of-bounds index access', () => {
         expect(quat_a[4]).toBeUndefined();
         expect(quat_a[-1]).toBeUndefined();
      });
   });

   describe('static operations', () => {
      it('Quat.identity should set a quat to the identity quaternion', () => {
         Quat.identity(out);

         expect(out.x).toBe(0);
         expect(out.y).toBe(0);
         expect(out.z).toBe(0);
         expect(out.w).toBe(1);
      });

      it('Quat.set_axis_angle should create a quaternion from an axis and angle', () => {
         const axis_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const axis = new Vec3(buffer, axis_ptr, allocator);
         axis.x = 0;
         axis.y = 1;
         axis.z = 0;

         const rad = Math.PI / 2;
         Quat.set_axis_angle(out, axis, rad);

         expect(out.w).toBeCloseTo(Math.cos(rad / 2));
         expect(out.y).toBeCloseTo(Math.sin(rad / 2));
      });

      it('Quat.multiply should multiply two quaternions', () => {
         Quat.multiply(out, quat_a, quat_b);

         expect(out.x).toBe(24);
         expect(out.y).toBe(48);
         expect(out.z).toBe(48);
         expect(out.w).toBe(-6);
      });


      it('Quat.slerp should spherically interpolate between two quaternions', () => {
         const q1_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const q1 = new Quat(buffer, q1_ptr, allocator);
         q1.x = 0;
         q1.y = 0;
         q1.z = 0;
         q1.w = 1;

         const q2_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const q2 = new Quat(buffer, q2_ptr, allocator);
         q2.x = 0;
         q2.y = 1;
         q2.z = 0;
         q2.w = 0; // 180 degree rotation around y

         Quat.slerp(out, q1, q2, 0.5);

         expect(out.x).toBeCloseTo(0);
         expect(out.y).toBeCloseTo(Math.SQRT1_2);
         expect(out.z).toBeCloseTo(0);
         expect(out.w).toBeCloseTo(Math.SQRT1_2);
      });

      it('Quat.invert should calculate the inverse', () => {
         Quat.invert(out, quat_a);

         const multiplied_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const multiplied = new Quat(buffer, multiplied_ptr, allocator);
         multiplied.x = 0;
         multiplied.y = 0;
         multiplied.z = 0;
         multiplied.w = 1;
         Quat.multiply(multiplied, quat_a, out);

         expect(multiplied.x).toBeCloseTo(0);
         expect(multiplied.y).toBeCloseTo(0);
         expect(multiplied.z).toBeCloseTo(0);
         expect(multiplied.w).toBeCloseTo(1);
      });

      it('Quat.conjugate should calculate the conjugate', () => {
         Quat.conjugate(out, quat_a);

         expect(out.x).toBe(-1);
         expect(out.y).toBe(-2);
         expect(out.z).toBe(-3);
         expect(out.w).toBe(4);
      });

      it('Quat.from_mat3 should create a quaternion from a rotation matrix', () => {
         const mat_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         const mat = new Mat3(buffer, mat_ptr, allocator);
         Mat3.identity(mat);
         Mat3.from_rotation(mat, Math.PI / 2); // 90 deg around z

         Quat.from_mat3(out, mat);
         const rotated_vec_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const rotated_vec = new Vec3(buffer, rotated_vec_ptr, allocator);
         rotated_vec.x = 1;
         rotated_vec.y = 0;
         rotated_vec.z = 0;
         rotated_vec.transform_quat(out);

         expect(rotated_vec.x).toBeCloseTo(0);
         expect(rotated_vec.y).toBeCloseTo(1);
         expect(rotated_vec.z).toBeCloseTo(0);
      });

      it('Quat.from_euler and to_euler should be inverse operations', () => {
         const euler_in_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const euler_in = new Vec3(buffer, euler_in_ptr, allocator);
         euler_in.x = Math.PI / 4;
         euler_in.y = Math.PI / 3;
         euler_in.z = Math.PI / 2;

         const euler_out_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const euler_out = new Vec3(buffer, euler_out_ptr, allocator);
         euler_out.x = 0;
         euler_out.y = 0;
         euler_out.z = 0;

         Quat.from_euler(out, euler_in.x, euler_in.y, euler_in.z);
         Quat.to_euler(euler_out, out);

         expect(euler_out.x).toBeCloseTo(euler_in.x);
         expect(euler_out.y).toBeCloseTo(euler_in.y);
         expect(euler_out.z).toBeCloseTo(euler_in.z);
      });
   });

   describe('instance methods', () => {
      it('multiply should perform multiplication and modify the instance by default', () => {
         const original_a_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const original_a = new Quat(buffer, original_a_ptr, allocator);
         original_a.copy(quat_a);

         quat_a.multiply(quat_b);

         const expected_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const expected = new Quat(buffer, expected_ptr, allocator);
         expected.x = 0;
         expected.y = 0;
         expected.z = 0;
         expected.w = 1;
         Quat.multiply(expected, original_a, quat_b);

         expect(quat_a.equals(expected)).toBe(true);
      });

      it('multiply should write to out parameter without modifying instance', () => {
         const original_a_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const original_a = new Quat(buffer, original_a_ptr, allocator);
         original_a.copy(quat_a);

         quat_a.multiply(quat_b, out);

         expect(quat_a.equals(original_a)).toBe(true);
      });
   });

   describe('comparisons', () => {
      it('equals should return true for identical quaternions', () => {
         const q_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const q = new Quat(buffer, q_ptr, allocator);
         q.x = 1;
         q.y = 2;
         q.z = 3;
         q.w = 4;

         expect(quat_a.equals(q)).toBe(true);
      });

      it('equals should return false for different quaternions', () => {
         expect(quat_a.equals(quat_b)).toBe(false);
      });

      it('equals_approximately should return true for nearly identical quaternions', () => {
         const q_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const q = new Quat(buffer, q_ptr, allocator);
         q.x = 1;
         q.y = 2;
         q.z = 3;
         q.w = 4.00000001;

         expect(quat_a.equals_approximately(q)).toBe(true);
      });

      it('equals_approximately should return false for different quaternions', () => {
         const q_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const q = new Quat(buffer, q_ptr, allocator);
         q.x = 1;
         q.y = 2;
         q.z = 3;
         q.w = 4.001;

         expect(quat_a.equals_approximately(q)).toBe(false);
      });

      it('equals_approximately should respect custom epsilon', () => {
         const q_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const q = new Quat(buffer, q_ptr, allocator);
         q.x = 1;
         q.y = 2;
         q.z = 3;
         q.w = 4.01;
         const old_epsilon = set_epsilon(0.1);

         expect(quat_a.equals_approximately(q)).toBe(true);
         set_epsilon(old_epsilon);
      });
   });

   describe('mathematical properties', () => {
      it('multiplication with identity should not change the quaternion', () => {
         const identity_quat_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         const identity_quat = new Quat(buffer, identity_quat_ptr, allocator);
         identity_quat.x = 0;
         identity_quat.y = 0;
         identity_quat.z = 0;
         identity_quat.w = 1;
         Quat.multiply(out, quat_a, identity_quat);
         expect(out.equals_approximately(quat_a)).toBe(true);

         Quat.multiply(out, identity_quat, quat_a);
         expect(out.equals_approximately(quat_a)).toBe(true);
      });

      it('length of a normalized quaternion should be 1', () => {
         Quat.normalize(out, quat_a);
         expect(out.magnitude()).toBeCloseTo(1);
      });
   });
});