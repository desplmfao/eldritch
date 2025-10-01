/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-native/tests/codegen/e2e_dynamic_map.test.ts
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

describe('codegen e2e - native strategy dynamic maps', () => {
   const source_code = `\
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { u32, u16, f64, str, map, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class NestedComponent {
   id!: t<u32>;
   name!: t<str>;
}

@Reflectable()
export class MapComponent {
   string_map!: t<map<str, str>>;
   primitive_map!: t<map<u32, f64>>;
   string_to_struct_map!: t<map<str, NestedComponent>>;
   primitive_to_string_map!: t<map<u16, str>>;
   inventory_by_category!: t<map<str, u32[]>>;
}\
`;

   let GeneratedMapComponent: any;
   let GeneratedNestedComponent: any;
   let component: any;
   let temp_src_dir: string;
   let temp_out_dir: string;

   beforeEach(async () => {
      temp_src_dir = path.join(import.meta.dir, '../../../src/__generated__');
      temp_out_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eldritch-test-codegen-native-map-'));
      temp_dirs_to_clean.push(temp_out_dir);

      await fs.mkdir(temp_src_dir, { recursive: true });
      const temp_src_file = path.join(temp_src_dir, 'components.ts');
      await fs.writeFile(temp_src_file, source_code, 'utf-8');

      const compiled_file_path = path.join(temp_out_dir, 'components.js');
      const project_root = (await find_git_root(process.cwd())) ?? process.cwd();

      await compile_single_file_for_test(temp_src_file, compiled_file_path, project_root, base_config, 'native');

      const generated_module = await import(compiled_file_path);
      GeneratedMapComponent = generated_module.MapComponent;
      GeneratedNestedComponent = generated_module.NestedComponent;
      component = new GeneratedMapComponent();
   });

   afterEach(async () => {
      // await fs.rm(temp_src_dir, { recursive: true, force: true });
   });

   const create_source_nested = (id: number, name: string) => {
      const view = new GeneratedNestedComponent();
      view.id = id;
      view.name = name;
      return view;
   };

   it('should generate functional classes and handle all map types', () => {
      expect(component).toBeDefined();

      // map<str, str>
      component.string_map.set('key1', 'value1');
      component.string_map.set('key2', 'value2');
      expect(component.string_map.size).toBe(2);
      expect(component.string_map.get('key1')).toBe('value1');
      expect(component.string_map.has('key2')).toBe(true);
      component.string_map.delete('key1');
      expect(component.string_map.has('key1')).toBe(false);

      // map<u32, f64>
      component.primitive_map.set(100, 1.23);
      component.primitive_map.set(200, 4.56);
      expect(component.primitive_map.size).toBe(2);
      expect(component.primitive_map.get(200)).toBeCloseTo(4.56);

      // map<str, NestedComponent>
      const nested_view = create_source_nested(101, 'alpha');
      component.string_to_struct_map.set('nested1', nested_view);
      expect(component.string_to_struct_map.size).toBe(1);
      const retrieved_nested = component.string_to_struct_map.get('nested1');
      expect(retrieved_nested.id).toBe(101);
      expect(retrieved_nested.name).toBe('alpha');

      // map<u16, str>
      component.primitive_to_string_map.set(50, 'fifty');
      expect(component.primitive_to_string_map.get(50)).toBe('fifty');

      // map<str, u32[]>
      component.inventory_by_category.set('potions', [10, 20]);
      expect(component.inventory_by_category.get('potions').length).toBe(2);
      expect(component.inventory_by_category.get('potions')[1]).toBe(20);
      component.inventory_by_category.get('potions').push(30);
      expect(component.inventory_by_category.get('potions')).toEqual([10, 20, 30]);
   });

   it('$copy_from() should perform a deep copy of all data', () => {
      const source_component = new GeneratedMapComponent();
      const nested = create_source_nested(999, 'src name');

      source_component.string_map.set('src_key', 'src_val');
      source_component.primitive_map.set(99, 9.9);
      source_component.string_to_struct_map.set('src_nested', nested);
      source_component.inventory_by_category.set('weapons', [1, 2, 3]);

      component.$copy_from(source_component);

      expect(component.string_map.get('src_key')).toBe('src_val');
      expect(component.primitive_map.get(99)).toBe(9.9);
      const copied_nested = component.string_to_struct_map.get('src_nested');
      expect(copied_nested.id).toBe(999);
      expect(copied_nested.name).toBe('src name');
      expect(component.inventory_by_category.get('weapons')).toEqual([1, 2, 3]);

      source_component.string_map.set('src_key', 'modified');
      source_component.primitive_map.set(99, 8.8);
      nested.name = 'modified name';
      source_component.inventory_by_category.get('weapons').push(4);

      expect(component.string_map.get('src_key')).toBe('src_val');
      expect(component.primitive_map.get(99)).toBe(9.9);
      expect(component.string_to_struct_map.get('src_nested').name).toBe('src name');
      expect(component.inventory_by_category.get('weapons')).toEqual([1, 2, 3]);
   });
});