/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-native/tests/codegen/e2e_default_values.test.ts
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

describe('codegen e2e - native strategy default values', () => {
   const source_code = `\
import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { u32, str, fixed_arr, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class NestedStruct {
   @ReflectProperty({ default_value: 99 })
   id!: t<u32>;
}

@Reflectable()
export class ComponentWithDefaults {
   @ReflectProperty({ default_value: 42 })
   primitive!: t<u32>;

   @ReflectProperty({ default_value: { id: 123 } })
   nested_struct!: t<NestedStruct>;

   @ReflectProperty({ default_value: [{ id: 10 }, { id: 20 }] })
   nested_array!: t<fixed_arr<NestedStruct, 2>>;

   @ReflectProperty({ default_value: ['hello', 'world'] })
   string_array!: t<str[]>;
}\
`;

   let GeneratedComponent: any;
   let component: any;
   let temp_src_dir: string;
   let temp_out_dir: string;

   beforeEach(async () => {
      temp_src_dir = path.join(import.meta.dir, '../../../src/__generated__');
      temp_out_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eldritch-test-codegen-native-defaults-'));
      temp_dirs_to_clean.push(temp_out_dir);

      await fs.mkdir(temp_src_dir, { recursive: true });
      const temp_src_file = path.join(temp_src_dir, 'components.ts');
      await fs.writeFile(temp_src_file, source_code, 'utf-8');

      const compiled_file_path = path.join(temp_out_dir, 'components.js');
      const project_root = (await find_git_root(process.cwd())) ?? process.cwd();

      await compile_single_file_for_test(temp_src_file, compiled_file_path, project_root, base_config, 'native');

      const generated_module = await import(compiled_file_path);
      GeneratedComponent = generated_module.ComponentWithDefaults;
      component = new GeneratedComponent();
   });

   afterEach(async () => {
      // await fs.rm(temp_src_dir, { recursive: true, force: true });
   });

   it('should correctly initialize a primitive property with its default value', () => {
      expect(component.primitive).toBe(42);
   });

   it('should correctly initialize a nested struct with its default value', () => {
      expect(component.nested_struct).toBeDefined();
      expect(component.nested_struct.id).toBe(123);
   });

   it('should correctly initialize a fixed array of nested structs', () => {
      expect(component.nested_array).toBeDefined();
      expect(component.nested_array.length).toBe(2);
      expect(component.nested_array[0].id).toBe(10);
      expect(component.nested_array[1].id).toBe(20);
   });

   it('should correctly initialize a dynamic array of strings', () => {
      expect(component.string_array).toBeDefined();
      expect(component.string_array.length).toBe(2);
      expect(component.string_array[0]).toBe('hello');
      expect(component.string_array[1]).toBe('world');
   });

   it('should allow overwriting default values after construction', () => {
      component.primitive = 999;
      expect(component.primitive).toBe(999);

      component.nested_struct.id = 777;
      expect(component.nested_struct.id).toBe(777);

      component.nested_array[0].id = 11;
      expect(component.nested_array[0].id).toBe(11);

      component.string_array.push('!');
      expect(component.string_array).toEqual(['hello', 'world', '!']);
   });
});