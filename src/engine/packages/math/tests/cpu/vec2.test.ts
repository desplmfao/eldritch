/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/math/tests/cpu/vec2.test.ts
 */

// @ts-nocheck

import { describe, it, expect, beforeEach } from 'bun:test';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

import { set_epsilon } from '@self/common';
import { Vec2 } from '@self/cpu/vec2';
import { Mat3 } from '@self/cpu/mat3';

describe('Vec2', () => {
   let allocator: TlsfAllocator;
   let buffer: ArrayBuffer;
   let vec_a: Vec2;
   let vec_b: Vec2;
   let out: Vec2;

   beforeEach(() => {
      buffer = new ArrayBuffer(1024 * 16);
      allocator = new TlsfAllocator(buffer);

      const vec_a_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
      vec_a = new Vec2(buffer, vec_a_ptr, allocator);
      vec_a.x = 1;
      vec_a.y = 2;

      const vec_b_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
      vec_b = new Vec2(buffer, vec_b_ptr, allocator);
      vec_b.x = 3;
      vec_b.y = 4;

      const out_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
      out = new Vec2(buffer, out_ptr, allocator);
      out.x = 0;
      out.y = 0;
   });

   describe('creation and properties', () => {
      it('should create a new vec2 with default values (0,0) when using the allocator', () => {
         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 0;
         v.y = 0;

         expect(v.x).toBe(0);
         expect(v.y).toBe(0);
      });

      it('should create a new vec2 with specified values', () => {
         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;

         expect(v[0]).toBe(1);
         expect(v[1]).toBe(2);
      });

      it('should allow getting and setting properties via x, y', () => {
         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 0;
         v.y = 0;

         v.x = 10;
         v.y = 20;

         expect(v[0]).toBe(10);
         expect(v[1]).toBe(20);
      });

      it('should allow getting and setting via index access', () => {
         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 0;
         v.y = 0;

         v[0] = 11;
         v[1] = 22;

         expect(v.x).toBe(11);
         expect(v.y).toBe(22);
      });

      it('should have a length property of 2', () => {
         expect(vec_a.length).toBe(2);
      });

      it('should return undefined for out-of-bounds index access', () => {
         expect(vec_a[2]).toBeUndefined();
         expect(vec_a[-1]).toBeUndefined();
      });
   });

   describe('static operations', () => {
      it('Vec2.add should add two vectors', () => {
         Vec2.add(out, vec_a, vec_b);

         expect(out.x).toBe(4);
         expect(out.y).toBe(6);
      });

      it('Vec2.subtract should subtract two vectors', () => {
         Vec2.subtract(out, vec_a, vec_b);

         expect(out.x).toBe(-2);
         expect(out.y).toBe(-2);
      });

      it('Vec2.multiply should multiply two vectors component-wise', () => {
         Vec2.multiply(out, vec_a, vec_b);

         expect(out.x).toBe(3);
         expect(out.y).toBe(8);
      });

      it('Vec2.divide should divide two vectors component-wise', () => {
         Vec2.divide(out, vec_b, vec_a);

         expect(out.x).toBeCloseTo(3);
         expect(out.y).toBeCloseTo(2);
      });

      it('Vec2.divide by zero should result in Infinity', () => {
         const zero_vec_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const zero_vec = new Vec2(buffer, zero_vec_ptr, allocator);
         zero_vec.x = 0;
         zero_vec.y = 0;

         Vec2.divide(out, vec_a, zero_vec);

         expect(out.x).toBe(Number.POSITIVE_INFINITY);
         expect(out.y).toBe(Number.POSITIVE_INFINITY);
      });

      it('Vec2.scale should scale a vector', () => {
         Vec2.scale(out, vec_a, 2);

         expect(out.x).toBe(2);
         expect(out.y).toBe(4);
      });

      it('Vec2.dot should calculate the dot product', () => {
         const result = Vec2.dot(vec_a, vec_b);

         expect(result).toBe(1 * 3 + 2 * 4); // 3 + 8 = 11
      });

      it('Vec2.distance should calculate the distance between two vectors', () => {
         const d = Vec2.distance(vec_a, vec_b);

         expect(d).toBeCloseTo(Math.sqrt(2 * 2 + 2 * 2)); // sqrt(8)
      });

      it('Vec2.distance_sq should calculate the squared distance', () => {
         const dsq = Vec2.distance_sq(vec_a, vec_b);

         expect(dsq).toBe(8);
      });

      it('Vec2.magnitude/length should calculate the vector length', () => {
         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 3;
         v.y = 4;

         expect(Vec2.magnitude(v)).toBe(5);
      });

      it('Vec2.magnitude_sq/length_sq should calculate the squared vector length', () => {
         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 3;
         v.y = 4;

         expect(Vec2.magnitude_sq(v)).toBe(25);
      });

      it('Vec2.normalize should produce a unit vector', () => {
         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 5;
         v.y = 5;
         Vec2.normalize(out, v);

         expect(out.magnitude()).toBeCloseTo(1.0);
      });

      it('Vec2.normalize on a zero vector should result in a zero vector', () => {
         const zero_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const zero = new Vec2(buffer, zero_ptr, allocator);
         zero.x = 0;
         zero.y = 0;

         Vec2.normalize(out, zero);

         expect(out.x).toBe(0);
         expect(out.y).toBe(0);
      });

      it('Vec2.negate should invert the vector\'s components', () => {
         Vec2.negate(out, vec_a);

         expect(out.x).toBe(-1);
         expect(out.y).toBe(-2);
      });

      it('Vec2.lerp should interpolate between two vectors', () => {
         Vec2.lerp(out, vec_a, vec_b, 0.5);
         expect(out.x).toBeCloseTo(2);
         expect(out.y).toBeCloseTo(3);
      });
   });

   describe('instance methods', () => {
      it('add should perform addition and modify the instance by default', () => {
         vec_a.add(vec_b);

         expect(vec_a.x).toBe(4);
         expect(vec_a.y).toBe(6);
      });

      it('add should perform addition and write to out parameter without modifying instance', () => {
         vec_a.add(vec_b, out);

         expect(vec_a.x).toBe(1);
         expect(out.x).toBe(4);
      });

      it('should correctly chain operations', () => {
         const v1_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v1 = new Vec2(buffer, v1_ptr, allocator);
         v1.x = 1;
         v1.y = 0;
         vec_a.copy(v1);

         const v2_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v2 = new Vec2(buffer, v2_ptr, allocator);
         v2.x = 0;
         v2.y = 2;
         vec_b.copy(v2);

         vec_a.add(vec_b).scale(2);

         expect(vec_a.x).toBeCloseTo(2);
         expect(vec_a.y).toBeCloseTo(4);
      });

      it('should handle parameter aliasing correctly (out === a)', () => {
         vec_a.add(vec_b, vec_a);

         expect(vec_a.x).toBe(4);
         expect(vec_a.y).toBe(6);
      });

      it('should handle parameter aliasing correctly (out === b)', () => {
         vec_a.add(vec_b, vec_b);

         expect(vec_b.x).toBe(4);
         expect(vec_b.y).toBe(6);
      });
   });

   describe('comparisons', () => {
      it('equals should return true for identical vectors', () => {
         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2;

         expect(vec_a.equals(v)).toBe(true);
      });

      it('equals should return false for different vectors', () => {
         expect(vec_a.equals(vec_b)).toBe(false);
      });

      it('equals_approximately should return true for nearly identical vectors', () => {
         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2.00000001;

         expect(vec_a.equals_approximately(v)).toBe(true);
      });

      it('equals_approximately should return false for different vectors', () => {
         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2.001;

         expect(vec_a.equals_approximately(v)).toBe(false);
      });

      it('equals_approximately should respect custom epsilon', () => {
         const v_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const v = new Vec2(buffer, v_ptr, allocator);
         v.x = 1;
         v.y = 2.01;
         const old_epsilon = set_epsilon(0.1);

         expect(vec_a.equals_approximately(v)).toBe(true);
         set_epsilon(old_epsilon);
      });
   });

   describe('transformations', () => {
      let mat: Mat3;

      beforeEach(() => {
         const mat_ptr = allocator.allocate(Mat3.__schema.total_size, Mat3);
         mat = new Mat3(buffer, mat_ptr, allocator);
         Mat3.identity(mat);
      });

      it('transform_mat3 with identity matrix should not change the vector', () => {
         Mat3.identity(mat);
         vec_a.transform_mat3(mat, out);

         expect(out.equals(vec_a)).toBe(true);
      });

      it('transform_mat3 should translate the vector', () => {
         const translate_vec_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const translate_vec = new Vec2(buffer, translate_vec_ptr, allocator);
         translate_vec.x = 10;
         translate_vec.y = 20;

         Mat3.from_translation(mat, translate_vec);
         vec_a.transform_mat3(mat, out);

         expect(out.x).toBeCloseTo(11);
         expect(out.y).toBeCloseTo(22);
      });

      it('transform_mat3 should scale the vector', () => {
         const scale_vec_ptr = allocator.allocate(Vec2.__schema.total_size, Vec2);
         const scale_vec = new Vec2(buffer, scale_vec_ptr, allocator);
         scale_vec.x = 2;
         scale_vec.y = 3;

         Mat3.from_scaling(mat, scale_vec);
         vec_a.transform_mat3(mat, out);

         expect(out.x).toBe(2);
         expect(out.y).toBe(6);
      });

      it('transform_mat3 should rotate the vector (90 degrees)', () => {
         Mat3.from_rotation(mat, Math.PI / 2);
         vec_a.transform_mat3(mat, out);

         expect(out.x).toBeCloseTo(-2);
         expect(out.y).toBeCloseTo(1);
      });
   });
});