/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/tests/cpu/vec4.test.ts
 */

// @ts-nocheck

import { describe, it, expect, beforeEach, spyOn } from 'bun:test';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

import { set_epsilon } from '@self/common';
import { Vec4 } from '@self/cpu/vec4';
import { Vec3 } from '@self/cpu/vec3';
import { Mat4 } from '@self/cpu/mat4';

describe('Vec4', () => {
   let allocator: TlsfAllocator;
   let buffer: ArrayBuffer;
   let vec_a: Vec4;
   let vec_b: Vec4;
   let out: Vec4;

   beforeEach(() => {
      buffer = new ArrayBuffer(1024 * 16);
      allocator = new TlsfAllocator(buffer);

      const vec_a_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
      vec_a = new Vec4(buffer, vec_a_ptr, allocator);
      vec_a.x = 1;
      vec_a.y = 2;
      vec_a.z = 3;
      vec_a.w = 4;

      const vec_b_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
      vec_b = new Vec4(buffer, vec_b_ptr, allocator);
      vec_b.x = 5;
      vec_b.y = 6;
      vec_b.z = 7;
      vec_b.w = 8;

      const out_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
      out = new Vec4(buffer, out_ptr, allocator);
      out.x = 0;
      out.y = 0;
      out.z = 0;
      out.w = 0;
   });

   describe('creation and properties', () => {
      it('should create a new vec4 with default values (0, 0, 0, 0) when using the allocator', () => {
         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 0;
         v.y = 0;
         v.z = 0;
         v.w = 0;

         expect(v.x).toBe(0);
         expect(v.y).toBe(0);
         expect(v.z).toBe(0);
         expect(v.w).toBe(0);
      });

      it('should create a new vec4 with specified values', () => {
         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;
         v.z = 3;
         v.w = 4;

         expect(v[0]).toBe(1);
         expect(v[1]).toBe(2);
         expect(v[2]).toBe(3);
         expect(v[3]).toBe(4);
      });

      it('should allow getting and setting properties via x, y, z, w', () => {
         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 0;
         v.y = 0;
         v.z = 0;
         v.w = 0;

         v.x = 10;
         v.y = 20;
         v.z = 30;
         v.w = 40;

         expect(v[0]).toBe(10);
         expect(v[1]).toBe(20);
         expect(v[2]).toBe(30);
         expect(v[3]).toBe(40);
      });

      it('should allow getting and setting via index access', () => {
         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 0;
         v.y = 0;
         v.z = 0;
         v.w = 0;

         v[0] = 11;
         v[1] = 22;
         v[2] = 33;
         v[3] = 44;

         expect(v.x).toBe(11);
         expect(v.y).toBe(22);
         expect(v.z).toBe(33);
         expect(v.w).toBe(44);
      });

      it('should return undefined for out-of-bounds index access', () => {
         expect(vec_a[4]).toBeUndefined();
         expect(vec_a[-1]).toBeUndefined();
      });
   });

   describe('static operations', () => {
      it('Vec4.add should add two vectors', () => {
         Vec4.add(out, vec_a, vec_b);

         expect(out.x).toBe(6);
         expect(out.y).toBe(8);
         expect(out.z).toBe(10);
         expect(out.w).toBe(12);
      });

      it('Vec4.subtract should subtract two vectors', () => {
         Vec4.subtract(out, vec_a, vec_b);

         expect(out.x).toBe(-4);
         expect(out.y).toBe(-4);
         expect(out.z).toBe(-4);
         expect(out.w).toBe(-4);
      });

      it('Vec4.multiply should multiply two vectors component-wise', () => {
         Vec4.multiply(out, vec_a, vec_b);

         expect(out.x).toBe(5);
         expect(out.y).toBe(12);
         expect(out.z).toBe(21);
         expect(out.w).toBe(32);
      });

      it('Vec4.divide should divide two vectors component-wise', () => {
         Vec4.divide(out, vec_b, vec_a);

         expect(out.x).toBeCloseTo(5);
         expect(out.y).toBeCloseTo(3);
         expect(out.z).toBeCloseTo(7 / 3);
         expect(out.w).toBeCloseTo(2);
      });

      it('Vec4.divide by zero should result in Infinity', () => {
         const zero_vec_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const zero_vec = new Vec4(buffer, zero_vec_ptr, allocator);
         zero_vec.x = 0;
         zero_vec.y = 0;
         zero_vec.z = 0;
         zero_vec.w = 0;

         Vec4.divide(out, vec_a, zero_vec);

         expect(out.x).toBe(Number.POSITIVE_INFINITY);
         expect(out.y).toBe(Number.POSITIVE_INFINITY);
         expect(out.z).toBe(Number.POSITIVE_INFINITY);
         expect(out.w).toBe(Number.POSITIVE_INFINITY);
      });

      it('Vec4.scale should scale a vector', () => {
         Vec4.scale(out, vec_a, 2);

         expect(out.x).toBe(2);
         expect(out.y).toBe(4);
         expect(out.z).toBe(6);
         expect(out.w).toBe(8);
      });

      it('Vec4.dot should calculate the dot product', () => {
         const result = Vec4.dot(vec_a, vec_b);

         expect(result).toBe(1 * 5 + 2 * 6 + 3 * 7 + 4 * 8); // 5 + 12 + 21 + 32 = 70
      });

      it('Vec4.distance should calculate the distance between two vectors', () => {
         const d = Vec4.distance(vec_a, vec_b);

         expect(d).toBe(Math.sqrt(4 * 4 + 4 * 4 + 4 * 4 + 4 * 4)); // sqrt(64) = 8
      });

      it('Vec4.distance_sq should calculate the squared distance', () => {
         const dsq = Vec4.distance_sq(vec_a, vec_b);

         expect(dsq).toBe(64);
      });

      it('Vec4.magnitude/length should calculate the vector length', () => {
         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 3;
         v.y = 4;
         v.z = 0;
         v.w = 0;

         expect(Vec4.magnitude(v)).toBe(5);
      });

      it('Vec4.magnitude_sq/length_sq should calculate the squared vector length', () => {
         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 3;
         v.y = 4;
         v.z = 0;
         v.w = 0;

         expect(Vec4.magnitude_sq(v)).toBe(25);
      });

      it('Vec4.normalize should produce a unit vector', () => {
         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 5;
         v.y = 5;
         v.z = 5;
         v.w = 5;

         Vec4.normalize(out, v);

         expect(out.magnitude()).toBeCloseTo(1.0);
      });

      it('Vec4.normalize on a zero vector should result in a zero vector', () => {
         const zero_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const zero = new Vec4(buffer, zero_ptr, allocator);
         zero.x = 0;
         zero.y = 0;
         zero.z = 0;
         zero.w = 0;

         Vec4.normalize(out, zero);

         expect(out.x).toBe(0);
         expect(out.y).toBe(0);
         expect(out.z).toBe(0);
         expect(out.w).toBe(0);
      });

      it('Vec4.negate should invert the vector\'s components', () => {
         Vec4.negate(out, vec_a);

         expect(out.x).toBe(-1);
         expect(out.y).toBe(-2);
         expect(out.z).toBe(-3);
         expect(out.w).toBe(-4);
      });

      it('Vec4.lerp should interpolate between two vectors', () => {
         Vec4.lerp(out, vec_a, vec_b, 0.5);

         expect(out.x).toBe(3);
         expect(out.y).toBe(4);
         expect(out.z).toBe(5);
         expect(out.w).toBe(6);
      });

      it('Vec4.lerp with t=0 should return the first vector', () => {
         Vec4.lerp(out, vec_a, vec_b, 0);

         expect(out.equals(vec_a)).toBe(true);
      });

      it('Vec4.lerp with t=1 should return the second vector', () => {
         Vec4.lerp(out, vec_a, vec_b, 1);

         expect(out.equals(vec_b)).toBe(true);
      });
   });

   describe('instance methods', () => {
      it('add should perform addition and modify the instance by default', () => {
         vec_a.add(vec_b);

         expect(vec_a.x).toBe(6);
         expect(vec_a.y).toBe(8);
         expect(vec_a.z).toBe(10);
         expect(vec_a.w).toBe(12);
      });

      it('add should perform addition and write to out parameter without modifying instance', () => {
         vec_a.add(vec_b, out);

         expect(vec_a.x).toBe(1);
         expect(out.x).toBe(6);
      });

      it('scale should perform scaling and modify the instance by default', () => {
         vec_a.scale(3);

         expect(vec_a.x).toBe(3);
         expect(vec_a.y).toBe(6);
         expect(vec_a.z).toBe(9);
         expect(vec_a.w).toBe(12);
      });

      it('normalize should modify the instance by default', () => {
         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 10;
         v.y = 0;
         v.z = 0;
         v.w = 0;

         v.normalize();

         expect(v.x).toBe(1);
         expect(v.y).toBe(0);
         expect(v.z).toBe(0);
         expect(v.w).toBe(0);
      });

      it('copy should copy values from another vector to the instance', () => {
         vec_a.copy(vec_b);

         expect(vec_a.x).toBe(5);
         expect(vec_a.y).toBe(6);
         expect(vec_a.z).toBe(7);
         expect(vec_a.w).toBe(8);
      });

      it('dot should return the correct dot product', () => {
         const result = vec_a.dot(vec_b);

         expect(result).toBe(70);
      });
   });

   describe('comparisons', () => {
      it('equals should return true for identical vectors', () => {
         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;
         v.z = 3;
         v.w = 4;

         expect(vec_a.equals(v)).toBe(true);
      });

      it('equals should return false for different vectors', () => {
         expect(vec_a.equals(vec_b)).toBe(false);
      });

      it('equals_approximately should return true for nearly identical vectors', () => {
         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;
         v.z = 3;
         v.w = 4.00000001;

         expect(vec_a.equals_approximately(v)).toBe(true);
      });

      it('equals_approximately should return false for different vectors', () => {
         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;
         v.z = 3;
         v.w = 4.001;

         expect(vec_a.equals_approximately(v)).toBe(false);
      });

      it('equals_approximately should respect custom epsilon', () => {
         const v_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const v = new Vec4(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;
         v.z = 3;
         v.w = 4.01;
         const old_epsilon = set_epsilon(0.1);

         expect(vec_a.equals_approximately(v)).toBe(true);

         set_epsilon(old_epsilon);
      });
   });

   describe('transformations', () => {
      let mat: Mat4;

      beforeEach(() => {
         const mat_ptr = allocator.allocate(Mat4.__schema.total_size, Mat4);
         mat = new Mat4(buffer, mat_ptr, allocator);
         Mat4.identity(mat);
      });

      it('transform_mat4 with identity matrix should not change the vector', () => {
         Mat4.identity(mat);
         Vec4.transform_mat4(out, vec_a, mat);

         expect(out.equals(vec_a)).toBe(true);
      });

      it('transform_mat4 should translate the vector', () => {
         const point_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const point = new Vec4(buffer, point_ptr, allocator);
         point.x = 1;
         point.y = 2;
         point.z = 3;
         point.w = 1;

         const translate_vec_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const translate_vec = new Vec3(buffer, translate_vec_ptr, allocator);
         translate_vec.x = 10;
         translate_vec.y = 20;
         translate_vec.z = 30;

         Mat4.from_translation(mat, translate_vec);
         Vec4.transform_mat4(out, point, mat);

         expect(out.x).toBeCloseTo(11);
         expect(out.y).toBeCloseTo(22);
         expect(out.z).toBeCloseTo(33);
         expect(out.w).toBeCloseTo(1);
      });

      it('transform_mat4 should scale the vector', () => {
         const scale_vec_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const scale_vec = new Vec3(buffer, scale_vec_ptr, allocator);
         scale_vec.x = 2;
         scale_vec.y = 3;
         scale_vec.z = 4;

         Mat4.from_scaling(mat, scale_vec);
         Vec4.transform_mat4(out, vec_a, mat);

         expect(out.x).toBe(2);
         expect(out.y).toBe(6);
         expect(out.z).toBe(12);
         expect(out.w).toBe(4);
      });

      it('transform_mat4 should rotate the vector (90 degrees around Y)', () => {
         const axis_ptr = allocator.allocate(Vec3.__schema.total_size, Vec3);
         const axis = new Vec3(buffer, axis_ptr, allocator);
         axis.x = 0;
         axis.y = 1;
         axis.z = 0;
         Mat4.from_rotation(mat, Math.PI / 2, axis);

         const vec_to_rotate_ptr = allocator.allocate(Vec4.__schema.total_size, Vec4);
         const vec_to_rotate = new Vec4(buffer, vec_to_rotate_ptr, allocator);
         vec_to_rotate.x = 1;
         vec_to_rotate.y = 2;
         vec_to_rotate.z = 3;
         vec_to_rotate.w = 1;
         vec_to_rotate.transform_mat4(mat, out);

         expect(out.x).toBeCloseTo(3);
         expect(out.y).toBeCloseTo(2);
         expect(out.z).toBeCloseTo(-1);
         expect(out.w).toBeCloseTo(1);
      });
   });
});