/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-native/tests/codegen/e2e_complex_struct.test.ts
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

describe('codegen e2e - native strategy complex struct', () => {
   const source_code = `\
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { u8, u16, u32, u64, f32, f64, i16, bool, str, fixed_arr, arr, map, set, sparseset, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class NestedStruct {
   id!: t<u64>;
   tag!: t<str>;
   matrix!: t<fixed_arr<f32, 4>>;
}

@Reflectable()
export class Component {
   a_u8!: t<u8>;
   a_f64!: t<f64>;
   a_bool!: t<bool>;
   deep_dynamic_array!: t<u32[][][]>;
   deep_fixed_array!: t<fixed_arr<fixed_arr<i16, 2>, 2>>;
   mixed_array_1!: t<fixed_arr<str[], 2>>;
   mixed_array_2!: t<arr<[u8, 4]>>;
   map_of_nested_arrays!: t<map<str, NestedStruct[]>>;
   set_of_fixed_arrays!: t<set<[f32, 3]>>;
   union_of_complex_types!: t<NestedStruct | u32[] | map<u16, str> | null>;
   entity_set!: t<sparseset>;
}\
`;

   let GeneratedMegaComponent: any;
   let GeneratedNestedStruct: any;
   let component: any;
   let temp_src_dir: string;
   let temp_out_dir: string;

   beforeEach(async () => {
      temp_src_dir = path.join(import.meta.dir, '../../../src/__generated__');
      temp_out_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eldritch-test-codegen-native-mega-'));
      temp_dirs_to_clean.push(temp_out_dir);

      await fs.mkdir(temp_src_dir, { recursive: true });
      const temp_src_file = path.join(temp_src_dir, 'components.ts');
      await fs.writeFile(temp_src_file, source_code, 'utf-8');

      const compiled_file_path = path.join(temp_out_dir, 'components.js');
      const project_root = (await find_git_root(process.cwd())) ?? process.cwd();

      await compile_single_file_for_test(temp_src_file, compiled_file_path, project_root, base_config, 'native');

      const generated_module = await import(compiled_file_path);
      GeneratedMegaComponent = generated_module.Component;
      GeneratedNestedStruct = generated_module.NestedStruct;
      component = new GeneratedMegaComponent();
   });

   afterEach(async () => {
      // await fs.rm(temp_src_dir, { recursive: true, force: true });
   });

   const create_source_nested = (id: bigint, tag: string, matrix: [number, number, number, number]) => {
      const view = new GeneratedNestedStruct();

      view.id = id;
      view.tag = tag;
      view.matrix = matrix;

      return view;
   };

   it('should correctly set and get all properties of the mega complex struct', () => {
      // primitives
      component.a_u8 = 128;
      component.a_f64 = Math.PI;
      component.a_bool = true;
      expect(component.a_u8).toBe(128);
      expect(component.a_f64).toBe(Math.PI);
      expect(component.a_bool).toBe(true);

      // deep_dynamic_array
      component.deep_dynamic_array.push([[1, 2], [3]]);
      component.deep_dynamic_array[0].push([4, 5, 6]);
      expect(component.deep_dynamic_array.length).toBe(1);
      expect(component.deep_dynamic_array[0].length).toBe(3);
      expect(component.deep_dynamic_array[0][2][2]).toBe(6);
      expect(component.deep_dynamic_array[0][1]).toEqual([3]);

      // deep_fixed_array
      component.deep_fixed_array[0] = [1, 2];
      component.deep_fixed_array[1] = [3, 4];
      component.deep_fixed_array[1][0] = 5;
      expect(component.deep_fixed_array[0][1]).toBe(2);
      expect(component.deep_fixed_array[1][0]).toBe(5);

      // mixed_array_1
      component.mixed_array_1[0].push('hello');
      component.mixed_array_1[1].push('world', '!');
      expect(component.mixed_array_1[0][0]).toBe('hello');
      expect(component.mixed_array_1[1]).toEqual(['world', '!']);

      // mixed_array_2
      component.mixed_array_2.push([1, 2, 3, 4]);
      expect(component.mixed_array_2[0]).toEqual([1, 2, 3, 4]);

      // map_of_nested_arrays
      component.map_of_nested_arrays.set('key1', [create_source_nested(1n, 'tag1', [1, 2, 3, 4])]);
      const retrieved_map_val = component.map_of_nested_arrays.get('key1');
      expect(retrieved_map_val[0].id).toBe(1n);
      expect(retrieved_map_val[0].tag).toBe('tag1');

      // set_of_fixed_arrays
      component.set_of_fixed_arrays.add([1.1, 2.2, 3.3]);
      expect(component.set_of_fixed_arrays.has([1.1, 2.2, 3.3])).toBe(true);
      expect(component.set_of_fixed_arrays.has([4, 5, 6])).toBe(false);

      // entity_set
      component.entity_set.add(1001);
      expect(component.entity_set.has(1001)).toBe(true);

      // union_of_complex_types
      component.union_of_complex_types = create_source_nested(99n, 'union_struct', [9, 8, 7, 6]);
      expect(component.union_of_complex_types.id).toBe(99n);
      component.union_of_complex_types = [11, 22];
      expect(component.union_of_complex_types).toEqual([11, 22]);
      component.union_of_complex_types = null;
      expect(component.union_of_complex_types).toBeNull();
      const map_in_union = new Map([[1, 'one']]);
      component.union_of_complex_types = map_in_union;
      expect(component.union_of_complex_types.get(1)).toBe('one');
   });

   it('$copy_from() should perform a deep copy of all data', () => {
      const source_component = new GeneratedMegaComponent();

      source_component.a_bool = true;
      source_component.deep_dynamic_array.push([[10]]);
      source_component.map_of_nested_arrays.set('src_key', [create_source_nested(100n, 'src_tag', [1, 1, 1, 1])]);
      source_component.union_of_complex_types = [99];

      component.$copy_from(source_component);

      expect(component.a_bool).toBe(true);
      expect(component.deep_dynamic_array[0][0][0]).toBe(10);
      expect(component.map_of_nested_arrays.get('src_key')[0].id).toBe(100n);
      expect(component.union_of_complex_types.length).toBe(1);

      // modify source and check that destination is unchanged
      source_component.a_bool = false;
      source_component.deep_dynamic_array[0][0].push(20);
      source_component.map_of_nested_arrays.get('src_key')[0].tag = 'modified';
      source_component.union_of_complex_types.push(88);

      expect(component.a_bool).toBe(true);
      expect(component.deep_dynamic_array[0][0].length).toBe(1);
      expect(component.map_of_nested_arrays.get('src_key')[0].tag).toBe('src_tag');
      expect(component.union_of_complex_types.length).toBe(1);
   });
});