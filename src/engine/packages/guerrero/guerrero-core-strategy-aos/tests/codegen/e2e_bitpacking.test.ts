/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/codegen/e2e_bitpacking.test.ts
 */

// @eldritch-build-ignore

import { describe, it, expect, afterAll, beforeEach, afterEach } from 'bun:test';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';

import { base_config } from '@eldritch-engine/builder';
import { compile_single_file_for_test } from '@eldritch-engine/builder/compile_tests';

import { find_git_root } from '@eldritch-engine/utils/misc';

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

describe('codegen e2e - bit-packing', () => {
   const source_code = `\
import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { bool, u8, u32, f32, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class BitfieldComponent {
   // first container (u32)
   flag_a!: t<bool>;                         // bit 0
   @ReflectProperty({ bits: 3 })
   state!: t<u8>;                            // bits 1-3
   flag_b!: t<bool>;                         // bit 4
   @ReflectProperty({ bits: 15 })
   value_a!: t<u32>;                         // bits 5-19
   @ReflectProperty({ bits: 12 })
   value_b!: t<u32>;                         // bits 20-31 (fills container)

   // non-packable field, breaks the sequence
   unrelated_data!: f32;

   // second container (u32)
   flag_c!: t<bool>;                         // bit 0
}
`;

   let GeneratedComponent: any;
   let allocator: TlsfAllocator;
   let component: any;
   let temp_src_dir: string;
   let temp_out_dir: string;

   beforeEach(async () => {
      temp_src_dir = path.join(import.meta.dir, '../../../src/__generated__');
      temp_out_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eldritch-test-codegen-bitpack-'));
      temp_dirs_to_clean.push(temp_out_dir);

      await fs.mkdir(temp_src_dir, { recursive: true });
      const temp_src_file = path.join(temp_src_dir, 'components.ts');
      await fs.writeFile(temp_src_file, source_code, 'utf-8');

      const compiled_file_path = path.join(temp_out_dir, 'components.js');
      const project_root = (await find_git_root(process.cwd())) || process.cwd();

      await compile_single_file_for_test(temp_src_file, compiled_file_path, project_root, base_config, 'aos');

      const generated_module = await import(compiled_file_path);
      GeneratedComponent = generated_module.BitfieldComponent;

      allocator = new TlsfAllocator(new ArrayBuffer(1024));
      const ptr = allocator.allocate(GeneratedComponent.__schema.total_size, GeneratedComponent);
      component = new GeneratedComponent(allocator.buffer, ptr, allocator);
   });

   afterEach(async () => {
      // await fs.rm(temp_src_dir, { recursive: true, force: true });
   });

   it('should correctly set and get values from the first bitfield container', () => {
      // initial state check (should be all zeros)
      expect(component.flag_a).toBe(false);
      expect(component.state).toBe(0);
      expect(component.flag_b).toBe(false);
      expect(component.value_a).toBe(0);
      expect(component.value_b).toBe(0);

      // set values one by one
      component.flag_a = true;
      expect(component.flag_a).toBe(true);

      component.state = 5; // 0b101
      expect(component.state).toBe(5);

      component.flag_b = true;
      expect(component.flag_b).toBe(true);

      component.value_a = 30000;
      expect(component.value_a).toBe(30000);

      component.value_b = 4095; // max value for 12 bits
      expect(component.value_b).toBe(4095);

      // check that other values were not corrupted
      expect(component.flag_a).toBe(true);
      expect(component.state).toBe(5);
      expect(component.flag_b).toBe(true);
   });

   it('should correctly handle fields that break the packing and start a new container', () => {
      component.unrelated_data = 123.456;
      expect(component.unrelated_data).toBeCloseTo(123.456);

      expect(component.flag_c).toBe(false);
      component.flag_c = true;
      expect(component.flag_c).toBe(true);
   });

   it('should not allow setting out-of-range values in safety builds', () => {
      expect(() => {
         component.state = 8; // 3 bits can only hold 0-7
      }).toThrow(/value for 'state' \(8\) is out of range for a 3-bit field \(0-7\)/);

      expect(() => {
         component.value_b = 4096; // 12 bits can only hold 0-4095
      }).toThrow(/value for 'value_b' \(4096\) is out of range for a 12-bit field \(0-4095\)/);
   });

   it('should correctly handle setting all fields at once', () => {
      component.flag_a = true;
      component.state = 3;
      component.flag_b = false;
      component.value_a = 12345;
      component.value_b = 987;
      component.unrelated_data = -1.0;
      component.flag_c = true;

      expect(component.flag_a).toBe(true);
      expect(component.state).toBe(3);
      expect(component.flag_b).toBe(false);
      expect(component.value_a).toBe(12345);
      expect(component.value_b).toBe(987);
      expect(component.unrelated_data).toBe(-1.0);
      expect(component.flag_c).toBe(true);
   });
});