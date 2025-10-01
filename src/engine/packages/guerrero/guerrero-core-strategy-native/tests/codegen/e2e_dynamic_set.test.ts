/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-native/tests/codegen/e2e_dynamic_set.test.ts
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

describe('codegen e2e - native strategy set', () => {
   const source_code = `\
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { u32, str, set, f32, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class NestedComponent {
   id!: t<u32>;
   name!: t<str>;
}

@Reflectable()
export class SetComponent {
   ids!: t<set<u32>>;
   tags!: t<set<str>>;
   nested_items!: t<set<NestedComponent>>;
   coordinates_seen!: t<set<[f32, f32]>>;
}\
`;

   let GeneratedSetComponent: any;
   let GeneratedNestedComponent: any;
   let component: any;
   let temp_src_dir: string;
   let temp_out_dir: string;

   beforeEach(async () => {
      temp_src_dir = path.join(import.meta.dir, '../../../src/__generated__');
      temp_out_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eldritch-test-codegen-native-set-'));
      temp_dirs_to_clean.push(temp_out_dir);

      await fs.mkdir(temp_src_dir, { recursive: true });
      const temp_src_file = path.join(temp_src_dir, 'components.ts');
      await fs.writeFile(temp_src_file, source_code, 'utf-8');

      const compiled_file_path = path.join(temp_out_dir, 'components.js');
      const project_root = (await find_git_root(process.cwd())) ?? process.cwd();

      await compile_single_file_for_test(temp_src_file, compiled_file_path, project_root, base_config, 'native');

      const generated_module = await import(compiled_file_path);
      GeneratedSetComponent = generated_module.SetComponent;
      GeneratedNestedComponent = generated_module.NestedComponent;
      component = new GeneratedSetComponent();
   });

   afterEach(async () => {
      // await fs.rm(temp_src_dir, { recursive: true, force: true });
   });

   it('should generate functional classes and handle all set types', () => {
      expect(component).toBeDefined();

      // set<u32>
      component.ids.add(100);
      component.ids.add(200);
      component.ids.add(100);
      expect(component.ids.size).toBe(2);
      expect(component.ids.has(100)).toBe(true);
      expect(component.ids.delete(100)).toBe(true);
      expect(component.ids.has(100)).toBe(false);
      expect([...component.ids]).toEqual([200]);

      // set<str>
      component.tags.add('tag one');
      component.tags.add('tag two');
      expect(component.tags.size).toBe(2);
      expect(component.tags.has('tag one')).toBe(true);
      expect([...component.tags].sort()).toEqual(['tag one', 'tag two'].sort());

      // set<NestedComponent>
      const source_item1 = new GeneratedNestedComponent();
      source_item1.id = 101;
      source_item1.name = 'alpha';
      component.nested_items.add(source_item1);
      expect(component.nested_items.size).toBe(1);
      expect(component.nested_items.has(source_item1)).toBe(true);

      // set<[f32, f32]>
      component.coordinates_seen.add([10, 20]);
      component.coordinates_seen.add([30.5, 40.5]);
      expect(component.coordinates_seen.size).toBe(2);
      expect(component.coordinates_seen.has([10, 20])).toBe(true);
      expect(component.coordinates_seen.has([99, 99])).toBe(false);
   });

   it('$copy_from() should perform a deep copy of all data', () => {
      const source_component = new GeneratedSetComponent();
      const nested_source = new GeneratedNestedComponent();
      nested_source.id = 123;
      nested_source.name = 'nested source';

      source_component.ids.add(1);
      source_component.tags.add('source tag');
      source_component.nested_items.add(nested_source);
      source_component.coordinates_seen.add([5, 6]);

      component.$copy_from(source_component);

      expect(component.ids.has(1)).toBe(true);
      expect(component.tags.has('source tag')).toBe(true);
      expect(component.nested_items.has(nested_source)).toBe(true);
      expect(component.coordinates_seen.has([5, 6])).toBe(true);

      source_component.ids.add(2);
      source_component.tags.add('modified');
      nested_source.name = 'modified nested';
      source_component.coordinates_seen.add([7, 8]);

      expect(component.ids.has(2)).toBe(false);
      expect(component.tags.has('modified')).toBe(false);
      expect([...component.nested_items][0].name).toBe('nested source');
      expect(component.coordinates_seen.has([7, 8])).toBe(false);
   });
});