/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/codegen/e2e_fixed_arrays.test.ts
 */

// @eldritch-build-ignore

import { describe, it, expect, afterAll, beforeEach, spyOn, afterEach } from 'bun:test';

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
         //  await fs.rm(dir, { recursive: true, force: true });
      } catch (e) {
         // ignore
      }
   }
});

describe('codegen e2e - fixed arrays', () => {
   const source_code = `\
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { u32, str, f32, fixed_arr, t } from '@eldritch-engine/type-utils/guerrero/markers';

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
   let allocator: TlsfAllocator;
   let temp_allocator: TlsfAllocator;
   let component: any;
   let temp_src_dir: string;
   let temp_out_dir: string;

   beforeEach(async () => {
      temp_src_dir = path.join(import.meta.dir, '../../../src/__generated__');
      temp_out_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eldritch-test-codegen-arrays-'));
      temp_dirs_to_clean.push(temp_out_dir);

      await fs.mkdir(temp_src_dir, { recursive: true });
      const temp_src_file = path.join(temp_src_dir, 'components.ts');
      await fs.writeFile(temp_src_file, source_code, 'utf-8');

      const compiled_file_path = path.join(temp_out_dir, 'components.js');
      const project_root = (await find_git_root(process.cwd())) || process.cwd();

      await compile_single_file_for_test(temp_src_file, compiled_file_path, project_root, base_config, 'aos');

      const generated_module = await import(compiled_file_path);
      GeneratedArraysComponent = generated_module.ArraysComponent;
      GeneratedNestedComponent = generated_module.NestedComponent;

      allocator = new TlsfAllocator(new ArrayBuffer(1024 * 16));
      temp_allocator = new TlsfAllocator(new ArrayBuffer(1024));
      const ptr = allocator.allocate(GeneratedArraysComponent.__schema.total_size, GeneratedArraysComponent);
      component = new GeneratedArraysComponent(allocator.buffer, ptr, allocator);
   });

   afterEach(async () => {
      // await fs.rm(temp_src_dir, { recursive: true, force: true });
   });

   it('should generate functional view classes and handle all fixed array types', () => {
      expect(component).toBeDefined();

      component.vector[0] = 1.1;
      component.vector[1] = -2.2;
      component.vector[2] = 3.3;

      expect(component.vector[0]).toBeCloseTo(1.1);
      expect(component.vector[1]).toBeCloseTo(-2.2);
      expect(component.vector[2]).toBeCloseTo(3.3);
      expect([...component.vector].map(v => Number(v.toFixed(1)))).toEqual([1.1, -2.2, 3.3]);

      component.tags[0] = 'tag one';
      component.tags[1] = 'tag two';
      expect(component.tags[0]).toBe('tag one');
      expect(component.tags[1]).toBe('tag two');
      expect([...component.tags]).toEqual(['tag one', 'tag two']);

      const temp_buffer = new ArrayBuffer(GeneratedNestedComponent.__schema.total_size);
      const source_item1 = new GeneratedNestedComponent(temp_buffer, 0, temp_allocator);
      source_item1.id = 101;
      source_item1.name = 'alpha';

      component.nested_items[0] = source_item1;
      expect(component.nested_items[0].id).toBe(101);
      expect(component.nested_items[0].name).toBe('alpha');

      source_item1.id = 999;
      source_item1.name = 'changed';
      expect(component.nested_items[0].id).toBe(101);
      expect(component.nested_items[0].name).toBe('alpha');

      const source_item2 = new GeneratedNestedComponent(temp_buffer, 0, temp_allocator);
      source_item2.id = 102;
      source_item2.name = 'beta';
      component.nested_items[1] = source_item2;

      expect(component.nested_items[1].id).toBe(102);

      // nested recursive test
      component.nested_array_of_arrays[0].push(10, 20);
      component.nested_array_of_arrays[1].push(30);
      expect(component.nested_array_of_arrays[0].length).toBe(2);
      expect(component.nested_array_of_arrays[1].length).toBe(1);
      expect(component.nested_array_of_arrays[0][1]).toBe(20);
      expect(component.nested_array_of_arrays[1][0]).toBe(30);
   });

   it('free() should deallocate all dynamic sub-properties', () => {
      component.tags[0] = 'a long string to ensure allocation';
      component.tags[1] = 'another long string';

      const temp_buffer = new ArrayBuffer(GeneratedNestedComponent.__schema.total_size);
      const source_item1 = new GeneratedNestedComponent(temp_buffer, 0, temp_allocator);
      source_item1.id = 1;
      source_item1.name = 'nested alpha';
      component.nested_items[0] = source_item1;

      const source_item2 = new GeneratedNestedComponent(temp_buffer, 0, temp_allocator);
      source_item2.id = 2;
      source_item2.name = 'nested beta';
      component.nested_items[1] = source_item2;

      component.nested_array_of_arrays[0].push(1, 2, 3);
      component.nested_array_of_arrays[1].push(4);

      const free_spy = spyOn(allocator, 'free');
      component.free();

      // tags[0], tags[1]
      // nested_items[0].name, nested_items[1].name
      // nested_array_of_arrays[0] (control + elements), nested_array_of_arrays[1] (control + elements)
      expect(free_spy.mock.calls.length).toBe(8);

      free_spy.mockRestore();
   });
});