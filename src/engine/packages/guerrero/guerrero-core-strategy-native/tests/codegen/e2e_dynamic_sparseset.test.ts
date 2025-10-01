/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-native/tests/codegen/e2e_dynamic_sparseset.test.ts
 */

// @eldritch-build-ignore

import { describe, it, expect, afterAll, beforeEach, afterEach } from 'bun:test';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { base_config } from '@eldritch-engine/builder';
import { compile_single_file_for_test } from '@eldritch-engine/builder/compile_tests';
import { find_git_root } from '@eldritch-engine/utils/misc';
import { SparseSet } from '@eldritch-engine/utils/std/sparse_set';

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

describe('codegen e2e - native strategy sparseset', () => {
   const source_code = `\
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { u32, sparseset, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class SparseSetComponent {
   id!: t<u32>;
   entities!: t<sparseset>;
}\
`;

   let GeneratedSparseSetComponent: any;
   let component: any;
   let temp_src_dir: string;
   let temp_out_dir: string;

   beforeEach(async () => {
      temp_src_dir = path.join(import.meta.dir, '../../../src/__generated__');
      temp_out_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eldritch-test-codegen-native-sparseset-'));
      temp_dirs_to_clean.push(temp_out_dir);

      await fs.mkdir(temp_src_dir, { recursive: true });
      const temp_src_file = path.join(temp_src_dir, 'components.ts');
      await fs.writeFile(temp_src_file, source_code, 'utf-8');

      const compiled_file_path = path.join(temp_out_dir, 'components.js');
      const project_root = (await find_git_root(process.cwd())) || process.cwd();

      await compile_single_file_for_test(temp_src_file, compiled_file_path, project_root, base_config, 'native');

      const generated_module = await import(compiled_file_path);
      GeneratedSparseSetComponent = generated_module.SparseSetComponent;
      component = new GeneratedSparseSetComponent();
   });

   afterEach(async () => {
      // await fs.rm(temp_src_dir, { recursive: true, force: true });
   });

   it('should generate a functional class and handle basic sparseset operations', () => {
      expect(component).toBeDefined();
      component.id = 1;

      // expect(component.entities).toBeInstanceOf(SparseSet); // - different no matter what in tests
      expect(component.entities.size).toBe(0);

      component.entities.add(10);
      component.entities.add(20);
      component.entities.add(5);

      expect(component.entities.size).toBe(3);
      expect(component.entities.has(10)).toBe(true);
      expect(component.entities.has(99)).toBe(false);

      const elements = [...component.entities.values()].sort((a, b) => a - b);
      expect(elements).toEqual([5, 10, 20]);

      component.entities.delete(10);
      expect(component.entities.size).toBe(2);
      expect(component.entities.has(10)).toBe(false);

      component.entities.clear();
      expect(component.entities.size).toBe(0);
   });

   it('$copy_from() should perform a deep copy of all data', () => {
      const source_component = new GeneratedSparseSetComponent();
      source_component.entities.add(11);
      source_component.entities.add(22);

      component.$copy_from(source_component);
      expect(component.entities.size).toBe(2);
      expect(component.entities.has(11)).toBe(true);
      expect(component.entities.has(22)).toBe(true);

      source_component.entities.add(33);

      expect(component.entities.size).toBe(2);
      expect(component.entities.has(33)).toBe(false);
   });
});