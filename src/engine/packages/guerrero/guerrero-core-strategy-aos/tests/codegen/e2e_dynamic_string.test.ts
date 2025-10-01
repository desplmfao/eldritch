/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/tests/codegen/e2e_dynamic_string.test.ts
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
         // await fs.rm(dir, { recursive: true, force: true });
      } catch (e) {
         // ignore
      }
   }
});

describe('codegen e2e - dynamic strings', () => {
   const source_code = `\
import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { str, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class StringComponent {
   name!: t<str>;
   description?: t<str>;
}\
`;

   let GeneratedStringComponent: any;
   let allocator: TlsfAllocator;
   let component: any;
   let temp_src_dir: string;
   let temp_out_dir: string;

   beforeEach(async () => {
      temp_src_dir = path.join(import.meta.dir, '../../../src/__generated__');
      temp_out_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eldritch-test-codegen-strings-'));
      temp_dirs_to_clean.push(temp_out_dir);

      await fs.mkdir(temp_src_dir, { recursive: true });
      const temp_src_file = path.join(temp_src_dir, 'string_component.ts');
      await fs.writeFile(temp_src_file, source_code, 'utf-8');

      const compiled_file_path = path.join(temp_out_dir, 'string_component.js');
      const project_root = (await find_git_root(process.cwd())) || process.cwd();

      await compile_single_file_for_test(temp_src_file, compiled_file_path, project_root, base_config, 'aos');

      const generated_module = await import(compiled_file_path);
      GeneratedStringComponent = generated_module.StringComponent;

      allocator = new TlsfAllocator(new ArrayBuffer(1024 * 16));
      const ptr = allocator.allocate(GeneratedStringComponent.__schema.total_size, GeneratedStringComponent);
      component = new GeneratedStringComponent(allocator.buffer, ptr, allocator);
   });

   afterEach(async () => {
      // await fs.rm(temp_src_dir, { recursive: true, force: true });
   });

   it('should initialize with default values', () => {
      expect(component.name).toBe('');
      expect(component.description).toBeUndefined();
   });

   it('should set and get a required string', () => {
      component.name = 'hello world';
      expect(component.name).toBe('hello world');
   });

   it('should set, get, and clear an optional string', () => {
      component.description = 'optional description';
      expect(component.description).toBe('optional description');

      component.description = null;
      expect(component.description).toBeUndefined();

      component.description = 'set again';
      expect(component.description).toBe('set again');

      component.description = undefined;
      expect(component.description).toBeUndefined();
   });

   it('should handle reallocation correctly', () => {
      component.name = 'short';
      expect(component.name).toBe('short');

      component.name = 'a much longer string that will cause a reallocation';
      expect(component.name).toBe('a much longer string that will cause a reallocation');

      component.name = 'tiny';
      expect(component.name).toBe('tiny');
   });

   it('$copy_from() should perform a deep copy', () => {
      const temp_buffer = new ArrayBuffer(GeneratedStringComponent.__schema.total_size);
      const source_component = new GeneratedStringComponent(temp_buffer, 0, allocator);
      source_component.name = 'source name';
      source_component.description = 'source description';

      component.$copy_from(source_component);

      expect(component.name).toBe('source name');
      expect(component.description).toBe('source description');

      source_component.name = 'modified name';
      source_component.description = 'modified description';

      expect(component.name).toBe('source name');
      expect(component.description).toBe('source description');
   });

   it('free() should deallocate all dynamic sub-properties', () => {
      component.name = 'a string to be freed';
      component.description = 'another string to be freed';

      const free_spy = spyOn(allocator, 'free');
      component.free();

      expect(free_spy.mock.calls.length).toBe(2);

      free_spy.mockRestore();

      expect(component.name).toBe('');
      expect(component.description).toBeUndefined();
   });
});