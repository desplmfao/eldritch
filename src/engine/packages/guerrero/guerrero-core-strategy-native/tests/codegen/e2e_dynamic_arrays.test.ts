/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-native/tests/codegen/e2e_dynamic_arrays.test.ts
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

describe('codegen e2e - native strategy dynamic arrays', () => {
   const source_code = `\
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { u32, str, arr, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class NestedComponent {
   id!: t<u32>;
   name!: t<str>;
}

@Reflectable()
export class DynamicArraysComponent {
   layers!: t<u32[]>;
   tags!: t<arr<str>>;
   nested_items!: t<NestedComponent[]>;
   matrix!: t<u32[][]>;
}\
`;

   let GeneratedArraysComponent: any;
   let GeneratedNestedComponent: any;
   let component: any;
   let temp_src_dir: string;
   let temp_out_dir: string;

   beforeEach(async () => {
      temp_src_dir = path.join(import.meta.dir, '../../../src/__generated__');
      temp_out_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eldritch-test-codegen-native-dyn-arrays-'));
      temp_dirs_to_clean.push(temp_out_dir);

      await fs.mkdir(temp_src_dir, { recursive: true });
      const temp_src_file = path.join(temp_src_dir, 'components.ts');
      await fs.writeFile(temp_src_file, source_code, 'utf-8');

      const compiled_file_path = path.join(temp_out_dir, 'components.js');
      const project_root = (await find_git_root(process.cwd())) || process.cwd();

      await compile_single_file_for_test(temp_src_file, compiled_file_path, project_root, base_config, 'native');

      const generated_module = await import(compiled_file_path);
      GeneratedArraysComponent = generated_module.DynamicArraysComponent;
      GeneratedNestedComponent = generated_module.NestedComponent;
      component = new GeneratedArraysComponent();
   });

   afterEach(async () => {
      // await fs.rm(temp_src_dir, { recursive: true, force: true });
   });

   it('should generate functional classes and handle all dynamic array types', () => {
      expect(component).toBeDefined();

      // u32[]
      component.layers.push(10, 20);
      expect(component.layers.length).toBe(2);
      expect(component.layers[1]).toBe(20);
      component.layers.push(30);
      expect(component.layers).toEqual([10, 20, 30]);
      expect(component.layers.pop()).toBe(30);
      expect(component.layers.length).toBe(2);

      // arr<str>
      component.tags.push('tag one', 'tag two');
      expect(component.tags.length).toBe(2);
      expect(component.tags[0]).toBe('tag one');
      component.tags[1] = 'updated tag';
      expect(component.tags[1]).toBe('updated tag');
      expect(component.tags.pop()).toBe('updated tag');
      expect(component.tags.length).toBe(1);

      // NestedComponent[]
      const source_item1 = new GeneratedNestedComponent();
      source_item1.id = 101;
      source_item1.name = 'alpha';
      component.nested_items.push(source_item1);

      const source_item2 = new GeneratedNestedComponent();
      source_item2.id = 102;
      source_item2.name = 'beta';
      component.nested_items.push(source_item2);

      expect(component.nested_items.length).toBe(2);
      expect(component.nested_items[0].id).toBe(101);
      expect(component.nested_items[1].name).toBe('beta');

      source_item1.id = 999;
      expect(component.nested_items[0].id).toBe(999);

      component.nested_items.pop();
      expect(component.nested_items.length).toBe(1);

      // u32[][]
      component.matrix.push([1, 2]);
      component.matrix.push([3, 4, 5]);
      expect(component.matrix.length).toBe(2);
      expect(component.matrix[0].length).toBe(2);
      expect(component.matrix[1][2]).toBe(5);
      component.matrix[0].push(99);
      expect(component.matrix[0][2]).toBe(99);
      expect(component.matrix[0]).toEqual([1, 2, 99]);
   });

   it('$copy_from() should perform a deep copy of all data', () => {
      const source_component = new GeneratedArraysComponent();
      const nested_source = new GeneratedNestedComponent();
      nested_source.id = 123;
      nested_source.name = 'nested source';

      source_component.layers.push(1, 2, 3);
      source_component.tags.push('source tag');
      source_component.nested_items.push(nested_source);
      source_component.matrix.push([10, 20]);

      component.$copy_from(source_component);

      expect(component.layers).toEqual([1, 2, 3]);
      expect(component.tags).toEqual(['source tag']);
      expect(component.nested_items[0].id).toBe(123);
      expect(component.nested_items[0].name).toBe('nested source');
      expect(component.matrix[0]).toEqual([10, 20]);

      source_component.layers.push(4);
      source_component.tags[0] = 'modified tag';
      nested_source.name = 'modified nested';
      source_component.nested_items[0].name = 'also modified';
      source_component.matrix[0].push(30);

      expect(component.layers).toEqual([1, 2, 3]);
      expect(component.tags).toEqual(['source tag']);
      expect(component.nested_items[0].name).toBe('nested source');
      expect(component.matrix[0]).toEqual([10, 20]);
   });
});