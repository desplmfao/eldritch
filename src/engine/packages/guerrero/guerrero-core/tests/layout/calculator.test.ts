/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/tests/layout/calculator.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import type { ImportInfo } from '@eldritch-engine/type-utils/tddi/index';
import type { MetadataClassExtracted, SchemaLayout, MetadataProperty } from '@eldritch-engine/type-utils/guerrero/index';
import type { IBuildTimeRegistry } from '@eldritch-engine/type-utils/builder/registry';
import type { ITypeResolver } from '@eldritch-engine/type-utils/builder/resolver';

import { ALIGN_SIZE } from '@self/runtime/allocator/constants';
import { SchemaLayoutCalculator } from '@self/layout/calculator';
import { TypeResolver } from '@self/layout/resolver';

//
//

class MockRegistry implements IBuildTimeRegistry {
   project_root_path: string = '';
   source_roots: readonly string[] = [];
   import_maps = new Map<string, Map<string, ImportInfo>>();
   metadata = new Map<string, MetadataClassExtracted>();
   layouts = new Map<string, SchemaLayout>();
   aliases = new Map<string, string>();
   tddi_marker_cache = new Map<string, boolean>();
   enum_definitions = new Map<string, Map<string, number>>();
   resolver: ITypeResolver = new TypeResolver(this);
   generated_internal_views = new Map<string, { code: string; imports: Set<string> }>();

   analyze_project = async () => { };
   is_tddi_marker = async () => false;
   get_file_origin = () => undefined;
   get_type_origin = () => undefined;

   add_layout(name: string, layout: SchemaLayout) { this.layouts.set(name, layout); }
   get_class_metadata = (name: string) => this.metadata.get(name);
   get_schema_layout = (name: string) => this.layouts.get(name);
   register_type_alias = (alias: string, target: string) => this.aliases.set(alias, target);
   get_type_alias_target = (alias: string) => this.aliases.get(alias);

   clear() {
      this.layouts.clear();
      this.metadata.clear();
      this.aliases.clear();
   }
}

//
//

describe('SchemaLayoutCalculator', () => {
   let mock_registry: MockRegistry;
   let calculator: SchemaLayoutCalculator;

   const create_class_metadata = (
      class_name: string,
      properties_array: {
         property_key: string,
         type: string,
         is_optional?: boolean,
         enum_base_type?: 'u8' | 'u16' | 'u32',
         bits?: number
      }[],
   ): MetadataClassExtracted => {
      const properties: MetadataProperty[] = properties_array.map(
         (p, index) => ({
            property_key: p.property_key,
            type: p.type,
            is_optional: p.is_optional,
            enum_base_type: p.enum_base_type,
            bits: p.bits,
            order: index,
            start_line: 1,
            end_line: 1,
         })
      );

      return {
         file_path: '',
         class_name,
         properties,
         is_reflectable: true,
         definition_type: 'struct',
         start_line: 1,
         end_line: 1
      };
   };

   beforeEach(() => {
      mock_registry = new MockRegistry();
      calculator = new SchemaLayoutCalculator(mock_registry, mock_registry.resolver);
   });

   it('should calculate layout for an empty struct', () => {
      const meta = create_class_metadata('EmptyStruct', []);

      const layout = calculator.calculate_schema_layout('EmptyStruct', meta);
      expect(layout.total_size).toBe(0);
      expect(layout.alignment).toBe(ALIGN_SIZE);
   });

   it('should handle alignment and padding correctly', () => {
      const meta = create_class_metadata(
         'PaddingStruct',
         [
            { property_key: 'a', type: 'u8' },
            { property_key: 'b', type: 'u32' },
            { property_key: 'c', type: 'u16' },
         ]
      );

      const layout = calculator.calculate_schema_layout('PaddingStruct', meta);
      expect(layout.alignment).toBe(4);
      expect(layout.total_size).toBe(12);
      expect(layout.properties[0]!.offset).toBe(0); // a
      expect(layout.properties[1]!.offset).toBe(4); // b
      expect(layout.properties[2]!.offset).toBe(8); // c
   });

   it('should correctly pad for 8-byte alignment', () => {
      const meta = create_class_metadata(
         'AlignU64',
         [
            { property_key: 'tag', type: 'u8' },
            { property_key: 'value', type: 'u64' },
         ]
      );

      const layout = calculator.calculate_schema_layout('AlignU64', meta);
      expect(layout.alignment).toBe(8);
      expect(layout.total_size).toBe(16);
      expect(layout.properties[0]!.offset).toBe(0);
      expect(layout.properties[1]!.offset).toBe(8);
   });

   it('should calculate layout for a complex struct with mixed types', () => {
      const meta = create_class_metadata(
         'ComplexStruct',
         [
            { property_key: 'id', type: 'u32' },
            { property_key: 'flags', type: '[u8, 2]' },
            { property_key: 'velocity', type: 'f64' },
            { property_key: 'enabled', type: 'bool' },
         ]
      );

      const layout = calculator.calculate_schema_layout('ComplexStruct', meta);
      expect(layout.alignment).toBe(8);
      expect(layout.total_size).toBe(24);

      expect(layout.properties[0]!.offset).toBe(0);
      expect(layout.properties[1]!.offset).toBe(4);
      expect(layout.properties[2]!.offset).toBe(8);
      expect(layout.properties[3]!.offset).toBe(16); // bool is packed
   });

   describe('bit-packing', () => {
      it('should pack bools and small integers into a u32 container', () => {
         const meta = create_class_metadata(
            'BitfieldStruct',
            [
               { property_key: 'a', type: 'bool' }, // 1 bit
               { property_key: 'b', type: 'u8', bits: 3 }, // 3 bits
               { property_key: 'c', type: 'bool' }, // 1 bit
               { property_key: 'd', type: 'f32' }, // breaks the pack
               { property_key: 'e', type: 'bool' }, // starts a new pack
            ]
         );

         const layout = calculator.calculate_schema_layout('BitfieldStruct', meta);
         expect(layout.alignment).toBe(4);
         expect(layout.total_size).toBe(12); // 4 for first pack, 4 for f32, 4 for second pack

         // property 'a'
         expect(layout.properties[0]!.offset).toBe(0);
         expect(layout.properties[0]!.size).toBe(4);                   // size of container
         expect(layout.properties[0]!.binary_info.bit_offset).toBe(0);
         expect(layout.properties[0]!.binary_info.bit_width).toBe(1);

         // property 'b'
         expect(layout.properties[1]!.offset).toBe(0);
         expect(layout.properties[1]!.size).toBe(4);
         expect(layout.properties[1]!.binary_info.bit_offset).toBe(1);
         expect(layout.properties[1]!.binary_info.bit_width).toBe(3);

         // property 'c'
         expect(layout.properties[2]!.offset).toBe(0);
         expect(layout.properties[2]!.size).toBe(4);
         expect(layout.properties[2]!.binary_info.bit_offset).toBe(4); // 1 + 3
         expect(layout.properties[2]!.binary_info.bit_width).toBe(1);

         // property 'd' (unpacked)
         expect(layout.properties[3]!.offset).toBe(4);
         expect(layout.properties[3]!.size).toBe(4);
         expect(layout.properties[3]!.binary_info.bit_offset).toBeUndefined();

         // property 'e' (new pack)
         expect(layout.properties[4]!.offset).toBe(8);
         expect(layout.properties[4]!.size).toBe(4);
         expect(layout.properties[4]!.binary_info.bit_offset).toBe(0);
         expect(layout.properties[4]!.binary_info.bit_width).toBe(1);
      });

      it('should handle a bitfield that overflows a u32 container', () => {
         const meta = create_class_metadata(
            'OverflowBitfield',
            [
               { property_key: 'a', type: 'u16', bits: 16 },
               { property_key: 'b', type: 'u16', bits: 16 },
               { property_key: 'c', type: 'u16', bits: 1 }, // this should start a new container
            ]
         );

         const layout = calculator.calculate_schema_layout('OverflowBitfield', meta);
         expect(layout.total_size).toBe(8);                            // 4 for the first u32, 4 for the second

         expect(layout.properties[0]!.offset).toBe(0);
         expect(layout.properties[0]!.binary_info.bit_offset).toBe(0);
         expect(layout.properties[0]!.binary_info.bit_width).toBe(16);

         expect(layout.properties[1]!.offset).toBe(0);
         expect(layout.properties[1]!.binary_info.bit_offset).toBe(16);
         expect(layout.properties[1]!.binary_info.bit_width).toBe(16);

         expect(layout.properties[2]!.offset).toBe(4);                 // new container
         expect(layout.properties[2]!.binary_info.bit_offset).toBe(0);
         expect(layout.properties[2]!.binary_info.bit_width).toBe(1);
      });
   });

   describe('fixed-size arrays', () => {
      it('should calculate layout for `[f32, 3]`', () => {
         const meta = create_class_metadata(
            'Vec3Struct',
            [
               { property_key: 'pos', type: '[f32, 3]' }
            ]
         );

         const layout = calculator.calculate_schema_layout('Vec3Struct', meta);
         expect(layout.properties[0]!.size).toBe(12);
         expect(layout.properties[0]!.alignment).toBe(4);
         expect(layout.total_size).toBe(12);
      });

      it('should calculate layout for `fixed_arr<u8, 5>`', () => {
         const meta = create_class_metadata(
            'ByteArrayStruct',
            [
               { property_key: 'data', type: 'fixed_arr<u8, 5>' }
            ]
         );

         const layout = calculator.calculate_schema_layout('ByteArrayStruct', meta);
         expect(layout.properties[0]!.size).toBe(5);
         expect(layout.properties[0]!.alignment).toBe(1);
         expect(layout.alignment).toBe(1);
         expect(layout.total_size).toBe(5);
      });
   });

   describe('tuples', () => {
      it('should calculate layout for a simple tuple `[u8, u32]`', () => {
         const meta = create_class_metadata(
            'TupleStruct',
            [
               { property_key: 'data', type: '[u8, u32]' }
            ]
         );

         const layout = calculator.calculate_schema_layout('TupleStruct', meta);

         expect(layout.properties[0]!.size).toBe(8);      // 1 (u8) + 3 (padding) + 4 (u32)
         expect(layout.properties[0]!.alignment).toBe(4);
         expect(layout.total_size).toBe(8);
      });

      it('should handle complex tuples affecting parent layout', () => {
         const meta = create_class_metadata('ComplexTupleStruct', [
            { property_key: 'a', type: 'u32' },       // offset 0, size 4
            { property_key: 'b', type: '[u8, u64]' }, // needs align 8, starts at 8. size is 16 (1 + 7 pad + 8). ends at 24
            { property_key: 'c', type: 'u16' },       // needs align 2, starts at 24. size 2. ends at 26
         ]);

         const layout = calculator.calculate_schema_layout('ComplexTupleStruct', meta);
         expect(layout.alignment).toBe(8); // from u64 in tuple
         expect(layout.total_size).toBe(32); // 26 padded to 32 for alignment of 8
         expect(layout.properties[0]!.offset).toBe(0);
         expect(layout.properties[1]!.offset).toBe(8);
         expect(layout.properties[1]!.size).toBe(16);
         expect(layout.properties[2]!.offset).toBe(24);
      });

      it('should propagate `has_dynamic_data` from within a tuple', () => {
         const meta = create_class_metadata(
            'DynamicTupleStruct',
            [
               { property_key: 'data', type: '[u32, str]' }
            ]
         );

         const layout = calculator.calculate_schema_layout('DynamicTupleStruct', meta);
         expect(layout.has_dynamic_data).toBe(true);
         expect(layout.properties[0]!.size).toBe(8); // 4 (u32) + 4 (str ptr)
      });
   });

   describe('dynamic types', () => {
      it('should handle `str` type', () => {
         const meta = create_class_metadata(
            'StringStruct',
            [
               { property_key: 'name', type: 'str' }
            ]
         );

         const layout = calculator.calculate_schema_layout('StringStruct', meta);
         expect(layout.has_dynamic_data).toBe(true);
         expect(layout.properties[0]!.size).toBe(4);
         expect(layout.total_size).toBe(4);
      });

      it('should handle `arr<T>` and `T[]` types', () => {
         const meta1 = create_class_metadata(
            'ArrStruct1',
            [
               { property_key: 'items', type: 'arr<u32>' }
            ]
         );

         const layout1 = calculator.calculate_schema_layout('ArrStruct1', meta1);
         expect(layout1.has_dynamic_data).toBe(true);
         expect(layout1.properties[0]!.size).toBe(4);

         const meta2 = create_class_metadata(
            'ArrStruct2',
            [
               { property_key: 'items', type: 'f64[]' }
            ]
         );

         const layout2 = calculator.calculate_schema_layout('ArrStruct2', meta2);
         expect(layout2.has_dynamic_data).toBe(true);
         expect(layout2.properties[0]!.size).toBe(4);
      });

      it('should handle `map<K,V>`, `set<T>`, and `sparseset`', () => {
         const meta = create_class_metadata(
            'CollectionStruct',
            [
               { property_key: 'my_map', type: 'map<u32, str>' },
               { property_key: 'my_set', type: 'set<f32>' },
               { property_key: 'my_sparseset', type: 'sparseset' },
            ]
         );

         const layout = calculator.calculate_schema_layout('CollectionStruct', meta);
         expect(layout.has_dynamic_data).toBe(true);
         expect(layout.total_size).toBe(12);
         expect(layout.properties[0]!.size).toBe(4);
         expect(layout.properties[1]!.size).toBe(4);
         expect(layout.properties[2]!.size).toBe(4);
      });
   });

   describe('nested and optional types', () => {
      beforeEach(() => {
         const point_layout: SchemaLayout = {
            class_name: 'Point',
            total_size: 8,
            alignment: 4,
            properties: [],
            has_dynamic_data: false
         };

         mock_registry.add_layout('Point', point_layout);

         const dyn_layout: SchemaLayout = {
            class_name: 'DynamicPayload',
            total_size: 4,
            alignment: 4,
            properties: [],
            has_dynamic_data: true
         };

         mock_registry.add_layout('DynamicPayload', dyn_layout);
      });

      it('should handle nested structs', () => {
         const meta = create_class_metadata(
            'Line',
            [
               { property_key: 'start', type: 'Point' },
               { property_key: 'end', type: 'Point' },
            ]
         );

         const layout = calculator.calculate_schema_layout('Line', meta);
         expect(layout.properties[0]!.size).toBe(8);      // start
         expect(layout.properties[0]!.alignment).toBe(4); // start
         expect(layout.properties[0]!.offset).toBe(0);    // start
         expect(layout.properties[1]!.offset).toBe(8);    // end
         expect(layout.total_size).toBe(16);
      });

      it('should handle fixed-size arrays of nested structs', () => {
         const meta = create_class_metadata(
            'Polygon',
            [
               { property_key: 'vertices', type: '[Point, 3]' },
               { property_key: 'color', type: 'u32' }
            ]
         );

         const layout = calculator.calculate_schema_layout('Polygon', meta);
         expect(layout.alignment).toBe(4);
         expect(layout.total_size).toBe(28);
         expect(layout.properties[0]!.offset).toBe(0);                          // vertices
         expect(layout.properties[0]!.size).toBe(24);                           // vertices
         expect(layout.properties[0]!.binary_info.is_nested_struct).toBe(true); // vertices
         expect(layout.properties[1]!.offset).toBe(24);                         // color
      });

      it('should propagate `has_dynamic_data` from nested structs', () => {
         const meta = create_class_metadata(
            'Container',
            [
               { property_key: 'payload', type: 'DynamicPayload' }
            ]
         );

         const layout = calculator.calculate_schema_layout('Container', meta);

         expect(layout.has_dynamic_data).toBe(true);
      });

      it('should handle optional primitives via union layout', () => {
         const meta = create_class_metadata(
            'OptionalPrimitive',
            [
               { property_key: 'maybe_u32', type: 'u32', is_optional: true },
            ]
         );

         const layout = calculator.calculate_schema_layout('OptionalPrimitive', meta);
         expect(layout.properties[0]!.binary_info.is_union).toBe(true);
         expect(layout.properties[0]!.binary_info.is_optional).toBe(true);
         expect(layout.properties[0]!.alignment).toBe(4);
         expect(layout.properties[0]!.size).toBe(8); // 1 byte tag + 3 bytes padding + 4 bytes data
         expect(layout.total_size).toBe(8);
      });

      it('should handle optional dynamic types without adding a presence flag', () => {
         const meta = create_class_metadata(
            'OptionalDynamic',
            [
               { property_key: 'name', type: 'str', is_optional: true }
            ]
         );

         const layout = calculator.calculate_schema_layout('OptionalDynamic', meta);
         expect(layout.properties[0]!.size).toBe(4);
         expect(layout.properties[0]!.binary_info.is_ptr).toBe(true);
         expect(layout.properties[0]!.binary_info.is_optional).toBe(true);
         expect(layout.total_size).toBe(4);
      });

      it('should handle mix of fixed and dynamic properties and propagate has_dynamic_data', () => {
         const meta = create_class_metadata(
            'Player',
            [
               { property_key: 'id', type: 'u64' },
               { property_key: 'name', type: 'str' },
               { property_key: 'position', type: '[f32, 3]' },
               { property_key: 'inventory', type: 'u32[]' }
            ]
         );

         const layout = calculator.calculate_schema_layout('Player', meta);
         expect(layout.has_dynamic_data).toBe(true);
         expect(layout.alignment).toBe(8);
         expect(layout.total_size).toBe(32);

         expect(layout.properties[0]!.offset).toBe(0);
         expect(layout.properties[1]!.offset).toBe(8);
         expect(layout.properties[2]!.offset).toBe(12);
         expect(layout.properties[3]!.offset).toBe(24);
      });
   });

   describe('unions', () => {
      beforeEach(() => {
         const struct_a_layout: SchemaLayout = {
            class_name: 'StructA',
            total_size: 8,
            alignment: 4,
            properties: [],
            has_dynamic_data: false
         };

         mock_registry.add_layout('StructA', struct_a_layout);

         const struct_b_layout: SchemaLayout = {
            class_name: 'StructB',
            total_size: 16,
            alignment: 8,
            properties: [],
            has_dynamic_data: true
         };

         mock_registry.add_layout('StructB', struct_b_layout);
      });

      it('should calculate layout for a union of primitives', () => {
         const meta = create_class_metadata(
            'UnionPrimitives',
            [
               { property_key: 'value', type: 'u8 | u32' }
            ]
         );

         const layout = calculator.calculate_schema_layout('UnionPrimitives', meta);
         expect(layout.properties[0]!.binary_info.is_union).toBe(true);
         expect(layout.properties[0]!.alignment).toBe(4);              // max alignment of variants
         expect(layout.properties[0]!.size).toBe(8);                   // 1 (tag) + 3 (padding) + 4 (max size)
         expect(layout.total_size).toBe(8);
         expect(layout.has_dynamic_data).toBe(false);
         expect(layout.properties[0]!.variants?.length).toBe(2);
      });

      it('should calculate layout for a union of structs', () => {
         const meta = create_class_metadata(
            'UnionStructs',
            [
               {
                  property_key: 'data',
                  type: 'StructA | StructB'
               }
            ]
         );

         const layout = calculator.calculate_schema_layout('UnionStructs', meta);
         expect(layout.properties[0]!.binary_info.is_union).toBe(true);
         expect(layout.properties[0]!.alignment).toBe(8);               // max alignment of variants
         expect(layout.properties[0]!.size).toBe(24);                   // 1 (tag) + 7 (padding) + 16 (max size)
         expect(layout.properties[0]!.variants?.length).toBe(2);
         expect(layout.total_size).toBe(24);
         expect(layout.has_dynamic_data).toBe(true);                    // propagated from StructB
      });

      it('should handle optional unions (union with null)', () => {
         const meta = create_class_metadata(
            'OptionalUnion',
            [
               { property_key: 'data', type: 'StructA | undefined' }
            ]
         );

         const layout = calculator.calculate_schema_layout('OptionalUnion', meta);
         expect(layout.properties[0]!.binary_info.is_union).toBe(true);
         expect(layout.properties[0]!.binary_info.is_optional).toBe(true);
         expect(layout.properties[0]!.alignment).toBe(4);
         expect(layout.properties[0]!.size).toBe(12);                      // 1 (tag) + 3 (padding) + 8 (StructA size)
         expect(layout.properties[0]!.variants?.length).toBe(1);           // 'null' is not in the variants array
      });

      it('should handle union with dynamic types', () => {
         const meta = create_class_metadata(
            'UnionWithDynamic',
            [
               { property_key: 'value', type: 'str | u32' }
            ]
         );

         const layout = calculator.calculate_schema_layout('UnionWithDynamic', meta);
         expect(layout.properties[0]!.binary_info.is_union).toBe(true);
         expect(layout.properties[0]!.alignment).toBe(4);
         expect(layout.properties[0]!.size).toBe(8);                   // 1 (tag) + 3 (padding) + 4 (max size of str pointer or u32)
         expect(layout.has_dynamic_data).toBe(true);
         expect(layout.total_size).toBe(8);
      });
   });


   describe('enums', () => {
      beforeEach(() => {
         const state_enum_meta: MetadataClassExtracted = {
            class_name: 'PlayerState',
            definition_type: 'enum',
            is_reflectable: false,
            file_path: '',
            start_line: 1,
            end_line: 1,
            properties: [],
            enum_members: [
               {
                  name: 'Idle',
                  value: 0
               },
               {
                  name: 'Walking',
                  value: 1
               },
               {
                  name: 'Running',
                  value: 2
               },
            ],
         };

         mock_registry.metadata.set('PlayerState', state_enum_meta);

         const large_enum_meta: MetadataClassExtracted = {
            ...state_enum_meta,
            class_name: 'LargeEnum',
            enum_members: [
               {
                  name: 'A',
                  value: 0
               },
               {
                  name: 'B',
                  value: 300
               },
            ],
         };

         mock_registry.metadata.set('LargeEnum', large_enum_meta);
      });

      it('should calculate layout for an enum property with default base type (u8)', () => {
         const meta = create_class_metadata(
            'Player',
            [
               { property_key: 'state', type: 'PlayerState' }
            ]
         );

         const layout = calculator.calculate_schema_layout('Player', meta);

         expect(layout.properties[0]!.size).toBe(1);
         expect(layout.properties[0]!.alignment).toBe(1);
         expect(layout.properties[0]!.binary_info.is_enum).toBe(true);
         expect(layout.properties[0]!.enum_members).toBeDefined();
         expect(layout.properties[0]!.enum_members!.length).toBe(3);
         expect(layout.total_size).toBe(1);
      });

      it('should calculate layout for an enum with a specified base type (u16)', () => {
         const meta = create_class_metadata(
            'Item',
            [
               { property_key: 'id', type: 'LargeEnum', enum_base_type: 'u16' }
            ]
         );

         const layout = calculator.calculate_schema_layout('Item', meta);
         expect(layout.properties[0]!.size).toBe(2);
         expect(layout.properties[0]!.alignment).toBe(2);
         expect(layout.properties[0]!.binary_info.is_enum).toBe(true);
         expect(layout.total_size).toBe(2);
      });

      it('should throw an error if an enum member value exceeds the base type range', () => {
         const meta = create_class_metadata(
            'InvalidItem',
            [
               { property_key: 'id', type: 'LargeEnum', enum_base_type: 'u8' }
            ]
         );

         expect(() => calculator.calculate_schema_layout('InvalidItem', meta))
            .toThrow(/enum member 'LargeEnum.B' value \(300\) exceeds the maximum value for its base type 'u8' \(255\)/);
      });
   });
});