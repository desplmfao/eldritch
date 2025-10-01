/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-native/tests/codegen/e2e_tuple.test.ts
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

describe('codegen e2e - native strategy tuples', () => {
   const source_code = `\
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { u32, str, bool, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class TupleComponent {
   // a tuple with a dynamic element
   data!: t<[u32, str, bool]>;
}\
`;

   let GeneratedTupleComponent: any;
   let component: any;
   let temp_src_dir: string;
   let temp_out_dir: string;

   beforeEach(async () => {
      temp_src_dir = path.join(import.meta.dir, '../../../src/__generated__');
      temp_out_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eldritch-test-codegen-native-tuple-'));
      temp_dirs_to_clean.push(temp_out_dir);

      await fs.mkdir(temp_src_dir, { recursive: true });
      const temp_src_file = path.join(temp_src_dir, 'components.ts');
      await fs.writeFile(temp_src_file, source_code, 'utf-8');

      const compiled_file_path = path.join(temp_out_dir, 'components.js');
      const project_root = (await find_git_root(process.cwd())) ?? process.cwd();

      await compile_single_file_for_test(temp_src_file, compiled_file_path, project_root, base_config, 'native');

      const generated_module = await import(compiled_file_path);
      GeneratedTupleComponent = generated_module.TupleComponent;
      component = new GeneratedTupleComponent();
   });

   afterEach(async () => {
      // await fs.rm(temp_src_dir, { recursive: true, force: true });
   });

   it('should generate a functional class and initialize with default values', () => {
      expect(component).toBeDefined();
      expect(component.data).toEqual([0, '', false]);
   });

   it('should handle tuple operations', () => {
      // set values
      component.data[0] = 123;
      component.data[1] = 'hello tuple';
      component.data[2] = true;

      // get values and assert
      expect(component.data[0]).toBe(123);
      expect(component.data[1]).toBe('hello tuple');
      expect(component.data[2]).toBe(true);
   });

   it('should be iterable', () => {
      component.data = [42, 'iterable', false];
      const collected = [...component.data];
      expect(collected).toEqual([42, 'iterable', false]);
   });

   it('$copy_from() should perform a deep copy of all data', () => {
      const source_component = new GeneratedTupleComponent();
      source_component.data = [999, 'source string', true];

      component.$copy_from(source_component);

      expect(component.data).toEqual([999, 'source string', true]);

      // modify source and check that destination is unchanged
      source_component.data[1] = 'modified source';
      expect(component.data).toEqual([999, 'source string', true]);
   });
});