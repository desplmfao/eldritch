/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/codegen/e2e_fixed_primitives.test.ts
 */

// @eldritch-build-ignore

import { describe, it, expect, afterAll, afterEach } from 'bun:test';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

import { base_config } from '@eldritch-engine/builder';
import { compile_single_file_for_test } from '@eldritch-engine/builder/compile_tests';

import { find_git_root } from '@eldritch-engine/utils/misc'

const temp_dirs_to_clean: string[] = [];

afterAll(async () => {
   for (const dir of temp_dirs_to_clean) {
      try {
         // await fs.rm(dir, { recursive: true, force: true });
      } catch (e) {
         // ignore
      }
   }
});

describe('codegen e2e - fixed primitives', () => {
   afterEach(async () => {
      // await fs.rm(temp_src_dir, { recursive: true, force: true });
   });

   it('should generate a functional view class with all fixed primitive types', async () => {
      const source_code = `\
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { u8, i8, u16, i16, u32, i32, u64, i64, f32, f64, bool, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class AllPrimitivesComponent {
   prop_u8!: t<u8>;
   prop_i8!: t<i8>;
   prop_u16!: t<u16>;
   prop_i16!: t<i16>;
   prop_u32!: t<u32>;
   prop_i32!: t<i32>;
   prop_u64!: t<u64>;
   prop_i64!: t<i64>;
   prop_f32!: t<f32>;
   prop_f64!: t<f64>;
   prop_bool!: t<bool>;
}\
`;
      const temp_src_dir = path.join(import.meta.dir, '../../../src/__generated__');
      const temp_out_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eldritch-test-codegen-'));
      temp_dirs_to_clean.push(temp_out_dir);

      await fs.mkdir(temp_src_dir, { recursive: true });

      const temp_src_file = path.join(temp_src_dir, 'component.ts');
      await fs.writeFile(temp_src_file, source_code, 'utf-8');

      const compiled_file_path = path.join(temp_out_dir, 'component.js');
      const project_root = await find_git_root(process.cwd()) ?? process.cwd();

      await compile_single_file_for_test(temp_src_file, compiled_file_path, project_root, base_config, 'aos');

      const generated_module = await import(compiled_file_path);
      const GeneratedComponent = generated_module.AllPrimitivesComponent;
      expect(GeneratedComponent).toBeDefined();

      const allocator = new TlsfAllocator(new ArrayBuffer(1024));
      const ptr = allocator.allocate(GeneratedComponent.__schema.total_size, GeneratedComponent);
      const component = new GeneratedComponent(allocator.buffer, ptr, allocator);

      // u8
      component.prop_u8 = 255;
      expect(component.prop_u8).toBe(255);
      expect(() => (component.prop_u8 = 256)).toThrow(RangeError);
      expect(() => (component.prop_u8 = -1)).toThrow(RangeError);

      // i8
      component.prop_i8 = -128;
      expect(component.prop_i8).toBe(-128);
      expect(() => (component.prop_i8 = 128)).toThrow(RangeError);
      expect(() => (component.prop_i8 = -129)).toThrow(RangeError);

      // u16
      component.prop_u16 = 65535;
      expect(component.prop_u16).toBe(65535);
      expect(() => (component.prop_u16 = 65536)).toThrow(RangeError);

      // i16
      component.prop_i16 = -32768;
      expect(component.prop_i16).toBe(-32768);
      expect(() => (component.prop_i16 = 32768)).toThrow(RangeError);

      // u32
      component.prop_u32 = 4294967295;
      expect(component.prop_u32).toBe(4294967295);
      expect(() => (component.prop_u32 = 4294967296)).toThrow(RangeError);

      // i32
      component.prop_i32 = -2147483648;
      expect(component.prop_i32).toBe(-2147483648);
      expect(() => (component.prop_i32 = 2147483648)).toThrow(RangeError);

      // u64
      component.prop_u64 = 0xffffffffffffffffn;
      expect(component.prop_u64).toBe(0xffffffffffffffffn);
      expect(() => (component.prop_u64 = 0xffffffffffffffffn + 1n)).toThrow(RangeError);

      // i64
      component.prop_i64 = -0x8000000000000000n;
      expect(component.prop_i64).toBe(-0x8000000000000000n);
      expect(() => (component.prop_i64 = 0x8000000000000000n)).toThrow(RangeError);

      // f32
      component.prop_f32 = 123.456;
      expect(component.prop_f32).toBeCloseTo(123.456);
      expect(() => (component.prop_f32 = 'not a number')).toThrow(TypeError);

      // f64
      component.prop_f64 = 1.2345e-300;
      expect(component.prop_f64).toBe(1.2345e-300);

      // bool
      component.prop_bool = true;
      expect(component.prop_bool).toBe(true);
      component.prop_bool = false;
      expect(component.prop_bool).toBe(false);
      expect(() => (component.prop_bool = 1)).toThrow(TypeError);
   });
});