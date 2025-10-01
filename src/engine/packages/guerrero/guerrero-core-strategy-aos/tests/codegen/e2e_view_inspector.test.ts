/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/codegen/e2e_view_inspector.test.ts
 */

// @eldritch-build-ignore

import { describe, it, expect, afterAll, beforeEach, afterEach } from 'bun:test';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import type { ICodegenStrategy } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { IBuildTimeRegistry } from '@eldritch-engine/type-utils/builder/registry';

import { base_config } from '@eldritch-engine/builder';
import { compile_single_file_for_test } from '@eldritch-engine/builder/compile_tests';

import { find_git_root } from '@eldritch-engine/utils/misc';

import { TlsfAllocator } from '@eldritch-engine/guerrero-core/runtime/allocator/allocator';
import { AllocationRegistry } from '@eldritch-engine/guerrero-core/runtime/allocator/registry';

import { ViewInspectorAos } from '@self/inspector/index';

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

describe('codegen e2e - view inspector', () => {
   const source_code = `\
import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { u32, bool, str, fixed_arr, arr, map, sparseset, t } from '@eldritch-engine/type-utils/guerrero/markers';

export enum TestEnum {
   A = 1,
   B = 5,
}

@Reflectable()
export class NestedData {
   id!: t<u32> = 99;
   tag!: t<str> = 'default_tag';
}

@Reflectable()
export class InspectorTestComponent {
   id!: t<u32>;
   
   @ReflectProperty({ bits: 1 })
   is_active!: t<bool>;

   @ReflectProperty({ bits: 7 })
   value!: t<u32>;

   nested_struct!: t<NestedData>;
   vector!: t<fixed_arr<str, 2>>;
   dynamic_tags!: t<arr<str>>;
   data_map!: t<map<str, NestedData>>;
   entity_set!: t<sparseset>;
   optional_value?: t<u32>;
   status!: t<TestEnum>;
}
`;


   let GeneratedComponent: any;
   let GeneratedNestedComponent: any;
   let allocator: TlsfAllocator;
   let temp_allocator: TlsfAllocator;
   let component: any;
   let temp_src_dir: string;
   let temp_out_dir: string;

   let build_result: {
      strategy?: ICodegenStrategy,
      registry: IBuildTimeRegistry
   };

   beforeEach(async () => {
      temp_src_dir = path.join(import.meta.dir, '../../../src/__generated__');
      temp_out_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eldritch-test-codegen-inspector-'));
      temp_dirs_to_clean.push(temp_out_dir);

      await fs.mkdir(temp_src_dir, { recursive: true });
      const temp_src_file = path.join(temp_src_dir, 'components.ts');
      await fs.writeFile(temp_src_file, source_code, 'utf-8');

      const compiled_file_path = path.join(temp_out_dir, 'components.js');
      const project_root = (await find_git_root(process.cwd())) || process.cwd();

      build_result = await compile_single_file_for_test(temp_src_file, compiled_file_path, project_root, base_config, 'aos');

      const generated_module = await import(compiled_file_path);
      GeneratedComponent = generated_module.InspectorTestComponent;
      GeneratedNestedComponent = generated_module.NestedData;

      allocator = new TlsfAllocator(new ArrayBuffer(1024 * 16));
      temp_allocator = new TlsfAllocator(new ArrayBuffer(1024));
      const ptr = allocator.allocate(GeneratedComponent.__schema.total_size, GeneratedComponent);
      component = new GeneratedComponent(allocator.buffer, ptr, allocator);
   });

   afterEach(async () => {
      // await fs.rm(temp_src_dir, { recursive: true, force: true });
   });

   const create_source_nested = (id: number, tag: string) => {
      const temp_buffer = new ArrayBuffer(GeneratedNestedComponent.__schema.total_size);
      const view = new GeneratedNestedComponent(temp_buffer, 0, temp_allocator);
      view.id = id;
      view.tag = tag;
      return view;
   };

   it('should inspect a complex component and return a correct data tree', () => {
      component.id = 123;
      component.is_active = true;
      component.value = 64;
      component.nested_struct = create_source_nested(999, 'nested');
      component.vector[0] = 'fixed_a';
      component.vector[1] = 'fixed_b';
      component.dynamic_tags.push('dyn_a', 'dyn_b');
      component.data_map.set('item1', create_source_nested(101, 'map_item1'));
      component.entity_set.add(42);
      component.entity_set.add(1337);
      component.optional_value = null;
      component.status = 5; // TestEnum.B

      const inspector = new ViewInspectorAos(build_result.registry);
      const inspected = inspector.inspect(allocator.buffer, component.__byte_offset, GeneratedComponent.__schema, allocator);

      expect(inspected.name).toBe('InspectorTestComponent');
      expect(inspected.type).toBe('InspectorTestComponent');
      expect(inspected.children).toBeDefined();
      expect(inspected.children!.length).toBe(10);

      const id_node = inspected.children!.find(c => c.name === 'id');
      expect(id_node?.value).toBe(123);

      const is_active_node = inspected.children!.find(c => c.name === 'is_active');
      expect(is_active_node?.value).toBe(true);

      const value_node = inspected.children!.find(c => c.name === 'value');
      expect(value_node?.value).toBe(64);

      const nested_node = inspected.children!.find(c => c.name === 'nested_struct');
      expect(nested_node?.type).toBe('NestedData');
      expect(nested_node?.children?.length).toBe(2);
      expect(nested_node?.children?.find(c => c.name === 'id')?.value).toBe(999);
      expect(nested_node?.children?.find(c => c.name === 'tag')?.children?.[0]?.value).toBe('nested');

      const vector_node = inspected.children!.find(c => c.name === 'vector');
      expect(vector_node?.children?.length).toBe(2);
      expect(vector_node?.children?.[0]?.name).toBe('[0]');
      expect(vector_node?.children?.[0]?.children?.[0]?.value).toBe('fixed_a');

      const tags_node = inspected.children!.find(c => c.name === 'dynamic_tags');
      expect(tags_node?.children?.find(c => c.name === 'length')?.value).toBe(2);
      expect(tags_node?.total_children_count).toBe(2);

      const map_node = inspected.children!.find(c => c.name === 'data_map');
      expect(map_node?.value).toMatch(/pointer @0x[0-9a-f]+/);
      expect(map_node?.children?.find(c => c.name === 'size')?.value).toBe(1);

      const sparseset_node = inspected.children!.find(c => c.name === 'entity_set');
      expect(sparseset_node?.children?.find(c => c.name === 'size')?.value).toBe(2);
      const sparseset_elements = sparseset_node?.children?.find(c => c.name === 'elements');
      expect(sparseset_elements).toBeDefined();
      expect(sparseset_elements?.children?.find(c => c.name === '[0]')?.value).toBe(42);
      expect(sparseset_elements?.children?.find(c => c.name === '[1]')?.value).toBe(1337);

      const optional_node = inspected.children!.find(c => c.name === 'optional_value');
      expect(optional_node?.value).toBeUndefined();

      const status_node = inspected.children!.find(c => c.name === 'status');
      expect(status_node?.value).toBe('B (5)');
   });

   it('should inspect all root allocations and their children', () => {
      const registry = new AllocationRegistry();
      const local_allocator = new TlsfAllocator(new ArrayBuffer(1024 * 16), 0, undefined, registry);

      const root_ptr = local_allocator.allocate(GeneratedComponent.__schema.total_size, GeneratedComponent);
      const root_comp = new GeneratedComponent(local_allocator.buffer, root_ptr, local_allocator);
      root_comp.id = 1;
      root_comp.is_active = true;

      const child_ptr = local_allocator.allocate(GeneratedNestedComponent.__schema.total_size, GeneratedNestedComponent, root_ptr);
      const child_comp = new GeneratedNestedComponent(local_allocator.buffer, child_ptr, local_allocator);
      child_comp.id = 101;
      child_comp.tag = 'child';

      const other_root_ptr = local_allocator.allocate(GeneratedNestedComponent.__schema.total_size, GeneratedNestedComponent);
      const other_root_comp = new GeneratedNestedComponent(local_allocator.buffer, other_root_ptr, local_allocator);
      other_root_comp.id = 202;
      other_root_comp.tag = 'other';

      const inspector = new ViewInspectorAos(build_result.registry);
      const all_allocations = inspector.inspect_all_allocations(local_allocator);

      expect(all_allocations.length).toBe(2);

      const parent_node = all_allocations.find(node => node.name === 'InspectorTestComponent');
      expect(parent_node).toBeDefined();
      expect(parent_node?.children?.length).toBe(10);
      expect(parent_node?.children?.find(c => c.name === 'id')?.value).toBe(1);

      const other_node = all_allocations.find(node => node.name === 'NestedData');
      expect(other_node).toBeDefined();
      expect(other_node?.children?.find(c => c.name === 'id')?.value).toBe(202);
      expect(other_node?.children?.find(c => c.name === 'tag')?.children?.[0]?.value).toBe('other');
   });
});