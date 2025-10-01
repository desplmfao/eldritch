/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/tests/cpu/vec3.test.ts
 */

// @ts-nocheck

import { describe, it, expect, beforeEach, spyOn } from 'bun:test';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

import { set_epsilon } from '@self/common';
import { Vec3 } from '@self/cpu/vec3';
import { Mat3 } from '@self/cpu/mat3';
import { Quat } from '@self/cpu/quat';

describe('Vec3', () => {
   let allocator: TlsfAllocator;
   let buffer: ArrayBuffer;
   let vec_a: Vec3;
   let vec_b: Vec3;
   let out: Vec3;

   beforeEach(() => {
      buffer = new ArrayBuffer(1024 * 16);
      allocator = new TlsfAllocator(buffer);

      const vec_a_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
      vec_a = new Vec3(buffer, vec_a_ptr, allocator);
      vec_a.x = 1;
      vec_a.y = 2;
      vec_a.z = 3;

      const vec_b_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
      vec_b = new Vec3(buffer, vec_b_ptr, allocator);
      vec_b.x = 4;
      vec_b.y = 5;
      vec_b.z = 6;

      const out_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
      out = new Vec3(buffer, out_ptr, allocator);
      out.x = 0;
      out.y = 0;
      out.z = 0;
   });

   describe('creation and properties', () => {
      it('should create a new vec3 with default values (0,0,0)', () => {
         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 0;
         v.y = 0;
         v.z = 0;

         expect(v.x).toBe(0);
         expect(v.y).toBe(0);
         expect(v.z).toBe(0);
      });

      it('should create a new vec3 with specified values', () => {
         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;
         v.z = 3;

         expect(v[0]).toBe(1);
         expect(v[1]).toBe(2);
         expect(v[2]).toBe(3);
      });

      it('should allow getting and setting properties via x, y, z', () => {
         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 0;
         v.y = 0;
         v.z = 0;

         v.x = 10;
         v.y = 20;
         v.z = 30;

         expect(v[0]).toBe(10);
         expect(v[1]).toBe(20);
         expect(v[2]).toBe(30);
      });

      it('should allow getting and setting via index access', () => {
         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 0;
         v.y = 0;
         v.z = 0;

         v[0] = 11;
         v[1] = 22;
         v[2] = 33;

         expect(v.x).toBe(11);
         expect(v.y).toBe(22);
         expect(v.z).toBe(33);
      });

      it('should have a length property of 3', () => {
         expect(vec_a.length).toBe(3);
      });

      it('should return undefined for out-of-bounds index access', () => {
         expect(vec_a[3]).toBeUndefined();
         expect(vec_a[-1]).toBeUndefined();
      });
   });

   describe('static operations', () => {
      it('Vec3.add should add two vectors', () => {
         Vec3.add(out, vec_a, vec_b);

         expect(out.x).toBe(5);
         expect(out.y).toBe(7);
         expect(out.z).toBe(9);
      });

      it('Vec3.subtract should subtract two vectors', () => {
         Vec3.subtract(out, vec_a, vec_b);

         expect(out.x).toBe(-3);
         expect(out.y).toBe(-3);
         expect(out.z).toBe(-3);
      });

      it('Vec3.multiply should multiply two vectors component-wise', () => {
         Vec3.multiply(out, vec_a, vec_b);

         expect(out.x).toBe(4);
         expect(out.y).toBe(10);
         expect(out.z).toBe(18);
      });

      it('Vec3.divide should divide two vectors component-wise', () => {
         Vec3.divide(out, vec_b, vec_a);

         expect(out.x).toBeCloseTo(4);
         expect(out.y).toBeCloseTo(2.5);
         expect(out.z).toBeCloseTo(2);
      });

      it('Vec3.divide by zero should result in Infinity', () => {
         const zero_vec_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const zero_vec = new Vec3(buffer, zero_vec_ptr, allocator);
         zero_vec.x = 0;
         zero_vec.y = 0;
         zero_vec.z = 0;

         Vec3.divide(out, vec_a, zero_vec);

         expect(out.x).toBe(Number.POSITIVE_INFINITY);
         expect(out.y).toBe(Number.POSITIVE_INFINITY);
         expect(out.z).toBe(Number.POSITIVE_INFINITY);
      });

      it('Vec3.scale should scale a vector', () => {
         Vec3.scale(out, vec_a, 2);

         expect(out.x).toBe(2);
         expect(out.y).toBe(4);
         expect(out.z).toBe(6);
      });

      it('Vec3.dot should calculate the dot product', () => {
         const result = Vec3.dot(vec_a, vec_b);

         expect(result).toBe(1 * 4 + 2 * 5 + 3 * 6); // 4 + 10 + 18 = 32
      });

      it('Vec3.cross should calculate the cross product', () => {
         const i_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const i = new Vec3(buffer, i_ptr, allocator);
         i.x = 1;
         i.y = 0;
         i.z = 0;

         const j_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const j = new Vec3(buffer, j_ptr, allocator);
         j.x = 0;
         j.y = 1;
         j.z = 0;

         const k_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const k = new Vec3(buffer, k_ptr, allocator);
         k.x = 0;
         k.y = 0;
         k.z = 1;

         Vec3.cross(out, i, j);

         expect(out.equals_approximately(k)).toBe(true);
      });

      it('Vec3.distance should calculate the distance between two vectors', () => {
         const d = Vec3.distance(vec_a, vec_b);

         expect(d).toBeCloseTo(Math.sqrt(3 * 3 + 3 * 3 + 3 * 3)); // sqrt(27)
      });

      it('Vec3.distance_sq should calculate the squared distance', () => {
         const dsq = Vec3.distance_sq(vec_a, vec_b);

         expect(dsq).toBe(27);
      });

      it('Vec3.magnitude/length should calculate the vector length', () => {
         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 3;
         v.y = 4;
         v.z = 0;
         expect(Vec3.magnitude(v)).toBe(5);
      });

      it('Vec3.magnitude_sq/length_sq should calculate the squared vector length', () => {
         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 3;
         v.y = 4;
         v.z = 0;

         expect(Vec3.magnitude_sq(v)).toBe(25);
      });

      it('Vec3.normalize should produce a unit vector', () => {
         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 5;
         v.y = 5;
         v.z = 5;

         Vec3.normalize(out, v);

         expect(out.magnitude()).toBeCloseTo(1.0);
      });

      it('Vec3.normalize on a zero vector should result in a zero vector', () => {
         const zero_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const zero = new Vec3(buffer, zero_ptr, allocator);
         zero.x = 0;
         zero.y = 0;
         zero.z = 0;

         Vec3.normalize(out, zero);

         expect(out.x).toBe(0);
         expect(out.y).toBe(0);
         expect(out.z).toBe(0);
      });

      it('Vec3.negate should invert the vector\'s components', () => {
         Vec3.negate(out, vec_a);

         expect(out.x).toBe(-1);
         expect(out.y).toBe(-2);
         expect(out.z).toBe(-3);
      });

      it('Vec3.lerp should interpolate between two vectors', () => {
         Vec3.lerp(out, vec_a, vec_b, 0.5);

         expect(out.x).toBeCloseTo(2.5);
         expect(out.y).toBeCloseTo(3.5);
         expect(out.z).toBeCloseTo(4.5);
      });
   });

   describe('instance methods', () => {
      it('add should perform addition and modify the instance by default', () => {
         vec_a.add(vec_b);

         expect(vec_a.x).toBe(5);
         expect(vec_a.y).toBe(7);
         expect(vec_a.z).toBe(9);
      });

      it('add should perform addition and write to out parameter without modifying instance', () => {
         vec_a.add(vec_b, out);

         expect(vec_a.x).toBe(1);
         expect(out.x).toBe(5);
      });

      it('should correctly chain operations', () => {
         const v1_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v1 = new Vec3(buffer, v1_ptr, allocator);
         v1.x = 1;
         v1.y = 0;
         v1.z = 0;
         vec_a.copy(v1);

         const v2_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v2 = new Vec3(buffer, v2_ptr, allocator);
         v2.x = 0;
         v2.y = 2;
         v2.z = 0;
         vec_b.copy(v2);
         vec_a.add(vec_b).scale(2);

         expect(vec_a.x).toBeCloseTo(2);
         expect(vec_a.y).toBeCloseTo(4);
         expect(vec_a.z).toBeCloseTo(0);
      });

      it('should handle parameter aliasing correctly (out === a)', () => {
         vec_a.add(vec_b, vec_a);

         expect(vec_a.x).toBe(5);
         expect(vec_a.y).toBe(7);
         expect(vec_a.z).toBe(9);
      });

      it('should handle parameter aliasing correctly (out === b)', () => {
         vec_a.add(vec_b, vec_b);

         expect(vec_b.x).toBe(5);
         expect(vec_b.y).toBe(7);
         expect(vec_b.z).toBe(9);
      });
   });

   describe('comparisons', () => {
      it('equals should return true for identical vectors', () => {
         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;
         v.z = 3;

         expect(vec_a.equals(v)).toBe(true);
      });

      it('equals should return false for different vectors', () => {
         expect(vec_a.equals(vec_b)).toBe(false);
      });

      it('equals_approximately should return true for nearly identical vectors', () => {
         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;
         v.z = 3.00000001;

         expect(vec_a.equals_approximately(v)).toBe(true);
      });

      it('equals_approximately should return false for different vectors', () => {
         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;
         v.z = 3.001;

         expect(vec_a.equals_approximately(v)).toBe(false);
      });

      it('equals_approximately should respect custom epsilon', () => {
         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;
         v.z = 3.01;
         const old_epsilon = set_epsilon(0.1);

         expect(vec_a.equals_approximately(v)).toBe(true);
         set_epsilon(old_epsilon);
      });
   });

   describe('transformations', () => {
      let mat: Mat3;
      let quat: Quat;

      beforeEach(() => {
         const mat_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         mat = new Mat3(buffer, mat_ptr, allocator);
         Mat3.identity(mat);

         const quat_ptr = allocator.allocate(Quat.__schema.total_size, Quat);
         quat = new Quat(buffer, quat_ptr, allocator);
         quat.x = 0;
         quat.y = 0;
         quat.z = 0;
         quat.w = 1;
      });

      it('transform_mat3 with identity matrix should not change the vector', () => {
         Mat3.identity(mat);
         vec_a.transform_mat3(mat, out);

         expect(out.equals(vec_a)).toBe(true);
      });

      it('transform_mat3 should rotate the vector (90 degrees around Z)', () => {
         Mat3.from_rotation(mat, Math.PI / 2);
         vec_a.transform_mat3(mat, out);

         expect(out.x).toBeCloseTo(-2);
         expect(out.y).toBeCloseTo(1);
         expect(out.z).toBeCloseTo(3);
      });

      it('transform_quat with identity quaternion should not change the vector', () => {
         Quat.identity(quat);
         vec_a.transform_quat(quat, out);

         expect(out.equals(vec_a)).toBe(true);
      });

      it('transform_quat should rotate around X axis', () => {
         const axis_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const axis = new Vec3(buffer, axis_ptr, allocator);
         axis.x = 1;
         axis.y = 0;
         axis.z = 0;
         Quat.set_axis_angle(quat, axis, Math.PI / 2);

         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 0;
         v.y = 1;
         v.z = 0;
         v.transform_quat(quat, out);

         expect(out.x).toBeCloseTo(0);
         expect(out.y).toBeCloseTo(0);
         expect(out.z).toBeCloseTo(1);
      });

      it('transform_quat should rotate around Y axis', () => {
         const axis_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const axis = new Vec3(buffer, axis_ptr, allocator);
         axis.x = 0;
         axis.y = 1;
         axis.z = 0;
         Quat.set_axis_angle(quat, axis, Math.PI / 2);

         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 0;
         v.z = 0;
         v.transform_quat(quat, out);

         expect(out.x).toBeCloseTo(0);
         expect(out.y).toBeCloseTo(0);
         expect(out.z).toBeCloseTo(-1);
      });

      it('transform_quat should rotate around Z axis', () => {
         const axis_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const axis = new Vec3(buffer, axis_ptr, allocator);
         axis.x = 0;
         axis.y = 0;
         axis.z = 1;
         Quat.set_axis_angle(quat, axis, Math.PI / 2);

         const v_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const v = new Vec3(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 0;
         v.z = 0;
         v.transform_quat(quat, out);

         expect(out.x).toBeCloseTo(0);
         expect(out.y).toBeCloseTo(1);
         expect(out.z).toBeCloseTo(0);
      });
   });

   describe('mathematical properties', () => {
      it('cross product of a vector with itself should be the zero vector', () => {
         Vec3.cross(out, vec_a, vec_a);

         expect(out.x).toBe(0);
         expect(out.y).toBe(0);
         expect(out.z).toBe(0);
      });

      it('cross product should be anti-commutative: cross(a, b) = -cross(b, a)', () => {
         const out2_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const out2 = new Vec3(buffer, out2_ptr, allocator);
         out2.x = 0;
         out2.y = 0;
         out2.z = 0;

         Vec3.cross(out, vec_a, vec_b);
         Vec3.cross(out2, vec_b, vec_a);
         Vec3.negate(out2, out2);

         expect(out.equals_approximately(out2)).toBe(true);
      });

      it('cross product result should be orthogonal to its operands', () => {
         Vec3.cross(out, vec_a, vec_b);

         expect(Vec3.dot(out, vec_a)).toBeCloseTo(0);
         expect(Vec3.dot(out, vec_b)).toBeCloseTo(0);
      });

      it('dot product should be commutative: dot(a, b) = dot(b, a)', () => {
         expect(Vec3.dot(vec_a, vec_b)).toBeCloseTo(Vec3.dot(vec_b, vec_a));
      });
   });
});