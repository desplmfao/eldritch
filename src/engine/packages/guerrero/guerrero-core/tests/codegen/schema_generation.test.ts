/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/tests/codegen/schema_generation.test.ts
 */

import { describe, it, expect } from 'bun:test';

import type { SchemaLayout, PropertyLayout, IViewConstructor } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy } from '@eldritch-engine/type-utils/guerrero/codegen';

import { generate_schema_layout_code } from '@self/utils/schema';

describe('guerrero schema code generation', () => {
   // @ts-expect-error - enough for these tests
   const mock_strategy = {
      get_type_name_for_codegen: (name: string) => name,
      get_or_generate_view_and_schema_for_type: (type_string: string) => ({
         class_name: type_string,
         schema: {
            class_name: type_string,
            total_size: 0,
            alignment: 1,
            properties: [],
            has_dynamic_data: false,
         },
      }),
      generate_default_value_string: (value: any) => JSON.stringify(value),
   } as ICodegenStrategy;

   it('should wrap debug-only metadata in ifdef blocks', () => {
      class PlayerStats {
         static readonly __schema: SchemaLayout;

         readonly __view!: DataView;
         readonly __buffer!: ArrayBufferLike;
         readonly __byte_offset!: number;
      }

      const mock_prop_layout: PropertyLayout = {
         property_key: 'health',
         order: 0,
         type: '[u32, 2]',
         start_line: 5,
         end_line: 5,
         description: 'player health',
         read_only: false,
         offset: 0,
         size: 8,
         alignment: 4,
         binary_info: {
            size: 8,
            alignment: 4,
            element_type: 'u32',
            element_count: 2,
            is_nested_struct: false,
            is_dynamic: false,
            has_dynamic_data: false,
            is_optional: false,
            is_ptr: false,
         },
      };

      const mock_schema_layout: SchemaLayout = {
         class_ctor: PlayerStats as IViewConstructor,
         total_size: 8,
         alignment: 4,
         properties: [mock_prop_layout],
         has_dynamic_data: false,
      };

      const generated_code = generate_schema_layout_code(mock_strategy, mock_schema_layout);

      expect(generated_code).toMatch(/offset: 0,/);
      expect(generated_code).toMatch(/size: 8,/);
      expect(generated_code).toMatch(/alignment: 4,/);
      expect(generated_code).toMatch(/total_size: 8,/);
      expect(generated_code).toMatch(/element_count: 2,/);

      expect(generated_code).toContain(`property_key: 'health'`);
      expect(generated_code).toContain(`description: 'player health'`);
      expect(generated_code).toContain(`read_only: false`);
      expect(generated_code).toContain(`type: '[u32, 2]'`);
      expect(generated_code).toContain(`element_type: 'u32'`);
   });

   it('should generate enum_members and is_enum inside debug blocks', () => {
      class EnumComponent {
         static readonly __schema: SchemaLayout;

         readonly __view!: DataView;
         readonly __buffer!: ArrayBufferLike;
         readonly __byte_offset!: number;
      }

      const mock_prop_layout: PropertyLayout = {
         property_key: 'state',
         order: 0,
         type: 'MyEnum',
         start_line: 5,
         end_line: 5,
         offset: 0,
         size: 1,
         alignment: 1,
         binary_info: {
            size: 1,
            alignment: 1,
            is_enum: true,
         },
         enum_members: [
            {
               name: 'A',
               value: 0
            },
            {
               name: 'B',
               value: 1
            }
         ]
      };

      const mock_schema_layout: SchemaLayout = {
         class_ctor: EnumComponent as IViewConstructor,
         total_size: 1,
         alignment: 1,
         properties: [mock_prop_layout],
         has_dynamic_data: false,
      };

      const generated_code = generate_schema_layout_code(mock_strategy, mock_schema_layout);

      expect(generated_code).toContain(`enum_members: [{ name: 'A', value: 0 }, { name: 'B', value: 1 }],`);
      expect(generated_code).toContain('is_enum: true,');

      const bti_code = generated_code.substring(generated_code.indexOf('binary_info'));
      expect(bti_code).toContain('is_enum: true,');
   });

   it('should generate default_value in the schema code', () => {
      class DefaultValueComponent {
         static readonly __schema: SchemaLayout;
         readonly __view!: DataView;
         readonly __buffer!: ArrayBufferLike;
         readonly __byte_offset!: number;
      }

      const default_val = {
         a: 1,
         b: 'test',
         c: null,
         d: [true]
      };

      const mock_prop_layout: PropertyLayout = {
         property_key: 'data',
         order: 0,
         type: 'u32',
         start_line: 1,
         end_line: 1,
         offset: 0,
         size: 4,
         alignment: 4,
         binary_info: {
            size: 4,
            alignment: 4
         },
         default_value: default_val,
      };

      const mock_schema_layout: SchemaLayout = {
         class_ctor: DefaultValueComponent as IViewConstructor,
         total_size: 4,
         alignment: 4,
         properties: [mock_prop_layout],
         has_dynamic_data: false,
      };

      const generated_code = generate_schema_layout_code(mock_strategy, mock_schema_layout);
      expect(generated_code).toContain(`default_value: ${JSON.stringify(default_val)},`);
   });
});