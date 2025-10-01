/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-tddi/tests/tddi_marker_resolution.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import * as swc from '@swc/core';
import type { ImportInfo } from '@eldritch-engine/type-utils/tddi/index';

import { is_tddi_marker_type, parsed_file_cache } from '@self/transform';
import { SWC_PARSER_OPTIONS } from '@self/utils';

const MOCK_SOURCE_CODE = `
// a marker type with the __tddi property
export type MyMarker<T> = T & { __tddi: true };

// a direct alias using the marker type
export type DirectMarker = MyMarker<string>;

// a nested alias, which the original function will fail to resolve
export type NestedAlias = DirectMarker;

// a type that is NOT a marker
export type NotAMarker = string;
`;

describe('tddi marker type resolution', () => {
   let temp_dir_path: string;
   let mock_file_path: string;
   let import_map: Map<string, ImportInfo>;

   beforeEach(async () => {
      temp_dir_path = await fs.mkdtemp(path.join(os.tmpdir(), 'tddi-marker-test-'));
      mock_file_path = path.join(temp_dir_path, 'test-source.ts');
      await fs.writeFile(mock_file_path, MOCK_SOURCE_CODE);

      const ast = await swc.parse(MOCK_SOURCE_CODE, SWC_PARSER_OPTIONS);
      parsed_file_cache.set(mock_file_path, ast);

      import_map = new Map<string, ImportInfo>([
         ['MyMarker', { source_path: './test-source', resolved_source_path: mock_file_path, named_imports: [{ local_name: 'MyMarker', original_name: 'MyMarker' }] } as ImportInfo],
         ['DirectMarker', { source_path: './test-source', resolved_source_path: mock_file_path, named_imports: [{ local_name: 'DirectMarker', original_name: 'DirectMarker' }] } as ImportInfo],
         ['NestedAlias', { source_path: './test-source', resolved_source_path: mock_file_path, named_imports: [{ local_name: 'NestedAlias', original_name: 'NestedAlias' }] } as ImportInfo],
         ['NotAMarker', { source_path: './test-source', resolved_source_path: mock_file_path, named_imports: [{ local_name: 'NotAMarker', original_name: 'NotAMarker' }] } as ImportInfo],
      ]);
   });

   afterEach(async () => {
      await fs.rm(temp_dir_path, { recursive: true, force: true });
      parsed_file_cache.clear();
   });

   it('should return TRUE for a type that is a direct intersection marker', async () => {
      const result = await is_tddi_marker_type('MyMarker', mock_file_path, import_map, '__tddi');
      expect(result).toBe(true);
   });

   it('should return TRUE for a type alias that points directly to a marker', async () => {
      const result = await is_tddi_marker_type('DirectMarker', mock_file_path, import_map, '__tddi');
      expect(result).toBe(true);
   });

   it('should return TRUE for a nested type alias by recursively resolving the chain', async () => {
      const result = await is_tddi_marker_type('NestedAlias', mock_file_path, import_map, '__tddi');
      expect(result).toBe(true);
   });

   it('should return FALSE for a type that is not a marker', async () => {
      const result = await is_tddi_marker_type('NotAMarker', mock_file_path, import_map, '__tddi');
      expect(result).toBe(false);
   });

   it('should return FALSE for a non-existent type', async () => {
      const result = await is_tddi_marker_type('NonExistentType', mock_file_path, new Map(), '__tddi');
      expect(result).toBe(false);
   });
});