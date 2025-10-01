/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/codegen/e2e_zombie_class_alias.test.ts
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

describe('codegen e2e - class aliasing', () => {
   const source_code = `\
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { f32, t } from '@eldritch-engine/type-utils/guerrero/markers';

// mode: substitute (default)
// this is the zombie class. it is an alias for the internal fixed_arr<f32, 2> view
//
// it should be completely erased from the final output and every reference to it
// should be replaced with the internal real version
@Reflectable({ alias_for: 'fixed_arr<f32, 2>' })
export class SubstituteVec2 {
}

// mode: extend
@Reflectable({ alias_for: 'fixed_arr<f32, 3>', alias_mode: 'extend' })
export class ExtendVec3 {
   get length(): 3 {
      return 3;
   }
   
   get x(): t<f32> {
      return this.get(0);
   }

   set x(v: t<f32>) {
      this.set(0, v);
   }

   get y(): t<f32> {
      return this.get(1);
   }

   set y(v: t<f32>) {
      this.set(1, v);
   }

   get z(): t<f32> {
      return this.get(2);
   }

   set z(v: t<f32>) {
      this.set(2, v);
   }
}

export interface ExtendVec3 {
   [n: number]: t<f32>;

   get(n: number): t<f32>;
   set(i: number, n: t<f32>): void;
}

@Reflectable()
export class Transform {
   position!: SubstituteVec2;
   rotation!: ExtendVec3;
}
`;

   let GeneratedTransform: any;
   let GeneratedSubstituteVec2: any;
   let GeneratedExtendVec3: any;
   let allocator: TlsfAllocator;
   let component: any;
   let temp_src_dir: string;
   let temp_out_dir: string;
   let compiled_file_path: string;

   beforeEach(async () => {
      temp_src_dir = path.join(import.meta.dir, '../../../src/__generated__');
      temp_out_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eldritch-test-codegen-alias-'));
      temp_dirs_to_clean.push(temp_out_dir);

      await fs.mkdir(temp_src_dir, { recursive: true });
      const temp_src_file = path.join(temp_src_dir, 'components.ts');
      await fs.writeFile(temp_src_file, source_code, 'utf-8');

      compiled_file_path = path.join(temp_out_dir, 'components.js');
      const project_root = (await find_git_root(process.cwd())) || process.cwd();

      await compile_single_file_for_test(temp_src_file, compiled_file_path, project_root, base_config, 'aos');

      const generated_module = await import(compiled_file_path);
      GeneratedTransform = generated_module.Transform;
      GeneratedSubstituteVec2 = generated_module.SubstituteVec2;
      GeneratedExtendVec3 = generated_module.ExtendVec3;

      allocator = new TlsfAllocator(new ArrayBuffer(1024));
      const ptr = allocator.allocate(GeneratedTransform.__schema.total_size, GeneratedTransform);
      component = new GeneratedTransform(allocator.buffer, ptr, allocator);
   });

   afterEach(async () => {
      // await fs.rm(temp_src_dir, { recursive: true, force: true });
   });

   it('should correctly handle alias_mode: "substitute"', async () => {
      component.position[0] = 1.1;
      component.position[1] = -2.2;

      expect(component.position[0]).toBeCloseTo(1.1);
      expect(component.position[1]).toBeCloseTo(-2.2);

      expect(component.position instanceof GeneratedSubstituteVec2).toBe(true)
   });

   it('should correctly handle alias_mode: "extend"', async () => {
      component.rotation[0] = 10;
      component.rotation[1] = 20;
      component.rotation[2] = -30;

      expect(component.rotation.x).toBe(10);
      expect(component.rotation.y).toBe(20);
      expect(component.rotation.z).toBe(-30);
      expect(component.rotation.length).toBe(3);

      expect(component.rotation instanceof GeneratedExtendVec3).toBe(true);

      const generated_code = await fs.readFile(compiled_file_path, 'utf-8');
      expect(generated_code).toContain('get y()');
   });
});