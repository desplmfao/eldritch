/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/tests/layout/analyzer.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import type { MetadataClassExtracted, MetadataProperty, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { IBuildTimeRegistry } from '@eldritch-engine/type-utils/builder/registry';
import type { ITypeResolver } from '@eldritch-engine/type-utils/builder/resolver';
import type { ImportInfo } from '@eldritch-engine/type-utils/tddi/index';

import { SchemaLayoutCalculator } from '@self/layout/calculator';
import { SchemaAnalyzer } from '@self/layout/analyzer';
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

const create_class_metadata = (
   class_name: string,
   properties_array: {
      property_key: string;
      type: string
   }[]
): MetadataClassExtracted => {
   const properties: MetadataProperty[] = properties_array.map(
      (p, index) => ({
         property_key: p.property_key,
         type: p.type,
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
      end_line: 1,
   };
};

//
//

describe('SchemaAnalyzer', () => {
   let mock_registry: MockRegistry;
   let calculator: SchemaLayoutCalculator;

   beforeEach(() => {
      mock_registry = new MockRegistry();
      calculator = new SchemaLayoutCalculator(mock_registry, mock_registry.resolver);
   });

   it('should correctly identify padding in a poorly ordered struct', () => {
      const meta = create_class_metadata(
         'PoorlyOrdered',
         [
            { property_key: 'a', type: 'u8' },  // size 1, align 1. offset 0
            { property_key: 'b', type: 'u64' }, // size 8, align 8. needs 7 padding. offset 8
            { property_key: 'c', type: 'u16' }, // size 2, align 2. offset 16
         ]
      );

      // total before final padding = 18. final align = 8. total size = 24
      // padding: 7 (before b) + 6 (after c) = 13
      const layout = calculator.calculate_schema_layout('PoorlyOrdered', meta);
      expect(layout.total_size).toBe(24);

      const analysis = SchemaAnalyzer.analyze(layout);
      expect(analysis.original_padding).toBe(13);
      expect(analysis.wasted_percentage).toBeCloseTo(13 / 24);
   });

   it('should suggest an optimal layout that reduces or maintains size', () => {
      const meta = create_class_metadata(
         'NeedsOptimizing',
         [
            { property_key: 'a', type: 'u8' }, // 1
            { property_key: 'b', type: 'u32' }, // 4
            { property_key: 'c', type: 'u16' }, // 2
            { property_key: 'd', type: 'u64' }, // 8
         ]
      );

      const layout = calculator.calculate_schema_layout('NeedsOptimizing', meta);

      // original layout: a(1), pad(3), b(4), c(2), pad(6), d(8) -> size 24, padding 9
      expect(layout.total_size).toBe(24);

      const analysis = SchemaAnalyzer.analyze(layout);

      // optimal layout: d(8), b(4), c(2), a(1), pad(1) -> size 16, padding 1
      expect(analysis.optimal_layout.suggested_property_order).toEqual(['d', 'b', 'c', 'a']);
      expect(analysis.optimal_layout.optimal_size).toBe(16);
      expect(analysis.optimal_layout.optimal_padding).toBe(1);
      expect(analysis.optimal_layout.optimal_size).toBeLessThan(analysis.original_size);
   });

   it('should identify an already optimal struct as optimal', () => {
      const meta = create_class_metadata(
         'AlreadyOptimal',
         [
            { property_key: 'a', type: 'u64' }, // 8
            { property_key: 'b', type: 'u32' }, // 4
            { property_key: 'c', type: 'u16' }, // 2
            { property_key: 'd', type: 'u8' },  // 1
         ]
      );

      // layout: a(8), b(4), c(2), d(1), pad(1) -> size 16
      const layout = calculator.calculate_schema_layout('AlreadyOptimal', meta);
      expect(layout.total_size).toBe(16);

      const analysis = SchemaAnalyzer.analyze(layout);
      expect(analysis.original_padding).toBe(1);
      expect(analysis.optimal_layout.optimal_size).toBe(16);
      expect(analysis.optimal_layout.optimal_padding).toBe(1);
      expect(analysis.optimal_layout.suggested_property_order).toEqual(['a', 'b', 'c', 'd']);
   });

   it('should handle nested structs correctly', () => {
      const nested_meta = create_class_metadata(
         'Nested',
         [
            { property_key: 'x', type: 'u8' },
            { property_key: 'y', type: 'u32' },
         ]
      );

      const nested_layout = calculator.calculate_schema_layout('Nested', nested_meta); // size 8, align 4
      mock_registry.layouts.set('Nested', nested_layout);

      const parent_meta = create_class_metadata(
         'Parent',
         [
            { property_key: 'a', type: 'u16' },    // size 2, align 2. offset 0
            { property_key: 'b', type: 'Nested' }, // size 8, align 4. needs 2 pad. offset 4
         ]
      );

      // total before final padding = 12. final align = 4. total size = 12
      // padding: 2 (before b) + 0 (final) = 2
      const layout = calculator.calculate_schema_layout('Parent', parent_meta);
      expect(layout.total_size).toBe(12);

      const analysis = SchemaAnalyzer.analyze(layout);
      expect(analysis.original_padding).toBe(2);
      expect(analysis.optimal_layout.suggested_property_order).toEqual(['b', 'a']);
      expect(analysis.optimal_layout.optimal_size).toBe(12);   // b(8), a(2), pad(2) -> 12
      expect(analysis.optimal_layout.optimal_padding).toBe(2); // no change in this case
   });

   it('should treat bitfields as a single u32 for analysis', () => {
      const meta_with_bits: MetadataClassExtracted = {
         file_path: '',
         class_name: 'BitPackTest',
         properties: [
            { property_key: 'a', type: 'u8', order: 0, start_line: 1, end_line: 1 },
            { property_key: 'b', type: 'bool', bits: 1, order: 1, start_line: 1, end_line: 1 },
            { property_key: 'c', type: 'u64', order: 2, start_line: 1, end_line: 1 },
         ],
         is_reflectable: true,
         definition_type: 'struct',
         start_line: 1,
         end_line: 1,
      };

      const layout = calculator.calculate_schema_layout('BitPackTest', meta_with_bits);
      // final: bitfield(4), a(1), pad(3), c(8) -> size 16. padding: 3
      expect(layout.total_size).toBe(16);

      const analysis = SchemaAnalyzer.analyze(layout);
      expect(analysis.original_padding).toBe(3);
      // optimal: c(8), b(4), a(1), pad(3) -> size 16
      expect(analysis.optimal_layout.suggested_property_order).toEqual(['c', 'b', 'a']);
      expect(analysis.optimal_layout.optimal_size).toBe(16);
      expect(analysis.optimal_layout.optimal_padding).toBe(3);
   });
});