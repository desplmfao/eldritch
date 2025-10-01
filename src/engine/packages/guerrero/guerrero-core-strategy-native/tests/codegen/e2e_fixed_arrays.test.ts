/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-native/tests/codegen/e2e_fixed_arrays.test.ts
 */

// @eldritch-build-ignore

import { describe, it, expect, afterAll, beforeEach, afterEach } from 'bun:test';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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

describe('codegen e2e - native strategy fixed arrays', () => {
   const source_code = `\
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { u32, str, f32, fixed_arr, arr, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class NestedComponent {
   id!: t<u32>;
   name!: t<str>;
}

@Reflectable()
export class ArraysComponent {
   vector!: t<[f32, f32, f32]>;
   tags!: t<fixed_arr<str, 2>>;
   nested_items!: t<[NestedComponent, NestedComponent]>;
   nested_array_of_arrays!: t<fixed_arr<u32[], 2>>;
}\
`;

   let GeneratedArraysComponent: any;
   let GeneratedNestedComponent: any;
   let component: any;
   let temp_src_dir: string;
   let temp_out_dir: string;

   beforeEach(async () => {
      temp_src_dir = path.join(import.meta.dir, '../../../src/__generated__');
      temp_out_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eldritch-test-codegen-native-arrays-'));
      temp_dirs_to_clean.push(temp_out_dir);

      await fs.mkdir(temp_src_dir, { recursive: true });
      const temp_src_file = path.join(temp_src_dir, 'components.ts');
      await fs.writeFile(temp_src_file, source_code, 'utf-8');

      const compiled_file_path = path.join(temp_out_dir, 'components.js');
      const project_root = (await find_git_root(process.cwd())) || process.cwd();

      await compile_single_file_for_test(temp_src_file, compiled_file_path, project_root, base_config, 'native');

      const generated_module = await import(compiled_file_path);
      GeneratedArraysComponent = generated_module.ArraysComponent;
      GeneratedNestedComponent = generated_module.NestedComponent;
      component = new GeneratedArraysComponent();
   });

   afterEach(async () => {
      // await fs.rm(temp_src_dir, { recursive: true, force: true });
   });

   it('should generate functional classes and handle all fixed array types as native arrays', () => {
      expect(component).toBeDefined();

      component.vector[0] = 1.1;
      component.vector[1] = -2.2;
      component.vector[2] = 3.3;

      expect(component.vector[0]).toBeCloseTo(1.1);
      expect(component.vector[1]).toBeCloseTo(-2.2);
      expect(component.vector[2]).toBeCloseTo(3.3);
      expect(component.vector.map((v: number) => Number(v.toFixed(1)))).toEqual([1.1, -2.2, 3.3]);

      component.tags[0] = 'tag one';
      component.tags[1] = 'tag two';
      expect(component.tags[0]).toBe('tag one');
      expect(component.tags[1]).toBe('tag two');
      expect(component.tags).toEqual(['tag one', 'tag two']);

      const source_item1 = new GeneratedNestedComponent();
      source_item1.id = 101;
      source_item1.name = 'alpha';

      component.nested_items[0] = source_item1;
      expect(component.nested_items[0].id).toBe(101);
      expect(component.nested_items[0].name).toBe('alpha');

      source_item1.id = 999;
      expect(component.nested_items[0].id).toBe(999);

      // nested recursive test
      component.nested_array_of_arrays[0].push(10, 20);
      component.nested_array_of_arrays[1].push(30);
      expect(component.nested_array_of_arrays[0].length).toBe(2);
      expect(component.nested_array_of_arrays[1].length).toBe(1);
      expect(component.nested_array_of_arrays[0][1]).toBe(20);
      expect(component.nested_array_of_arrays[1][0]).toBe(30);
   });
});