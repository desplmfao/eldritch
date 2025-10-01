/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/tests/codegen/guerrero_codegen_predefined.test.ts
 */

import { describe, it, expect } from 'bun:test';

import * as swc from '@swc/core';

import type { ImportInfo } from '@eldritch-engine/type-utils/tddi/index';
import type { SchemaLayout, MetadataClassExtracted, IViewConstructor, MetadataProperty } from '@eldritch-engine/type-utils/guerrero/index';
import type { IBuildTimeRegistry } from '@eldritch-engine/type-utils/builder/registry';
import type { ITypeResolver } from '@eldritch-engine/type-utils/builder/resolver';
import { FileOrigin } from '@eldritch-engine/type-utils/builder/origin';
import type { ICodegenStrategy } from '@eldritch-engine/type-utils/guerrero/codegen';

import { ReflectMetadataVisitor } from '@self/visitors/reflect_metadata_visitor';
import { SchemaLayoutCalculator } from '@self/layout/calculator';
import { generate_schema_layout_code } from '@self/utils/schema';
import { TypeResolver } from '@self/layout/resolver';

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

describe('guerrero codegen for predefined schemas with __schema_props', () => {
   // @ts-expect-error
   const mock_strategy: ICodegenStrategy = {
      get_type_name_for_codegen: (name: string) => name,
   };

   it('should generate a schema, augmenting __schema_props with jsdoc', async () => {
      const mock_source_code = `\
@Reflectable()
export class MockVec3 {
   static readonly __schema: SchemaLayout = GUERRERO_SCHEMA_PLACEHOLDER;

   static readonly __schema_props: MetadataProperty[] = [
      {
         property_key: 'x',
         order: 0,
         type: 'f32',
         description: 'x-component'
      },
      {
         property_key: 'y',
         order: 1,
         type: 'f32'
      },
      {
         property_key: 'z',
         order: 2,
         type: 'f32'
      },
   ];
}\
`;

      // simulated, should be the same as the actual build tools
      const ast = await swc.parse(mock_source_code, { syntax: 'typescript', decorators: true });
      const visitor = new ReflectMetadataVisitor(mock_source_code, new Map(), 'test.ts', () => { }, () => { }, false, FileOrigin.User);
      visitor.visitModule(ast);
      const metadata_map = visitor.get_collected_metadata();
      const mock_metadata = metadata_map.get('MockVec3');

      expect(mock_metadata).toBeDefined();
      expect(mock_metadata!.properties.length).toBe(3);
      expect(mock_metadata!.properties.find(p => p.property_key === 'x')?.description).toBe('x-component');

      const registry = new MockRegistry();
      registry.metadata.set('MockVec3', mock_metadata!);
      const calculator = new SchemaLayoutCalculator(registry, registry.resolver);
      const layout = calculator.calculate_schema_layout('MockVec3', mock_metadata!);

      expect(layout).toBeDefined();
      expect(layout.total_size).toBe(12);
      expect(layout.alignment).toBe(4);

      const generated_code = generate_schema_layout_code(mock_strategy, layout);

      const debug_block_regex = /\s*\/\/\/ #if DEBUG\n([\s\S]*?)\n\s*\/\/\/ #endif/;
      const matches = generated_code.match(new RegExp(debug_block_regex, 'g'));

      expect(matches).not.toBeUndefined();
      expect(matches!.length).toBe(4);

      expect(generated_code).toContain('class_ctor: MockVec3,');

      expect(generated_code).toMatch(/\/\/\/ #if DEBUG\n\s*property_key: 'x'/);
      expect(generated_code).toContain(`description: 'x-component'`);
      expect(generated_code).toContain(`type: 'f32'`);
      expect(generated_code).toContain(`/// #endif`);

      expect(generated_code).toMatch(/offset: 0,\n\s*size: 4,/);
      expect(generated_code).toMatch(/offset: 4,\n\s*size: 4,/);
      expect(generated_code).toMatch(/offset: 8,\n\s*size: 4,/);
   });

   it('should extract descriptions from jsdoc for reflected properties', async () => {
      const mock_source_code = `\
import type { u32, str, bool, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class PlayerInfo {
   /**
    * the player's unique identifier
    *
    * stored as a u32
    */
   id!: t<u32>;

   /**
    * the player's display name
    *
    * this can be changed by the player
    */
   @ReflectProperty({ description: 'explicit description overrides jsdoc' })
   name!: t<str>;
   
   /** a simple flag */
   @ReflectProperty()
   active!: t<bool>;
}\
`;

      const ast = await swc.parse(mock_source_code, { syntax: 'typescript', decorators: true });
      const visitor = new ReflectMetadataVisitor(mock_source_code, new Map(), 'test.ts', () => { }, () => { }, false, FileOrigin.User);
      visitor.visitModule(ast);

      const metadata_map = visitor.get_collected_metadata();
      const mock_metadata = metadata_map.get('PlayerInfo');
      expect(mock_metadata).toBeDefined();

      const registry = new MockRegistry();
      registry.metadata.set('PlayerInfo', mock_metadata!);
      const calculator = new SchemaLayoutCalculator(registry, registry.resolver);
      const layout = calculator.calculate_schema_layout('PlayerInfo', mock_metadata!);

      const id_prop = layout.properties.find(p => p.property_key === 'id')!;
      const name_prop = layout.properties.find(p => p.property_key === 'name')!;
      const active_prop = layout.properties.find(p => p.property_key === 'active')!;

      expect(id_prop.description).toBe(`the player's unique identifier\n\nstored as a u32`);
      expect(name_prop.description).toBe('explicit description overrides jsdoc');
      expect(active_prop.description).toBe('a simple flag');

      const generated_code = generate_schema_layout_code(mock_strategy, layout);
      expect(generated_code).toContain(`description: 'the player\\'s unique identifier\\n\\nstored as a u32'`);
      expect(generated_code).toContain(`description: 'explicit description overrides jsdoc'`);
      expect(generated_code).toContain(`description: 'a simple flag'`);
   });

   it('should correctly parse an enum and collect its metadata', async () => {
      const mock_source_code = `\
export const enum MyEnum {
   A,
   B = 5,
   C
}

@Reflectable()
export class EnumComponent {
   state!: MyEnum;
}\
`;

      const ast = await swc.parse(mock_source_code, { syntax: 'typescript', tsx: false, decorators: true });
      const visitor = new ReflectMetadataVisitor(mock_source_code, new Map(), 'test.ts', () => { }, () => { }, false, FileOrigin.User);
      visitor.visitModule(ast);

      const metadata_map = visitor.get_collected_metadata();
      expect(metadata_map.has('MyEnum')).toBe(true);

      const enum_meta = metadata_map.get('MyEnum')!;
      expect(enum_meta.definition_type).toBe('enum');
      expect(enum_meta.is_reflectable).toBe(false);
      expect(enum_meta.enum_members).toEqual([
         { name: 'A', value: 0 },
         { name: 'B', value: 5 },
         { name: 'C', value: 6 },
      ]);

      const component_meta = metadata_map.get('EnumComponent');
      expect(component_meta).toBeDefined();
      expect(component_meta!.properties.find(p => p.property_key === 'state')?.type).toBe('MyEnum');
   });

   it('should extract bit_width from @ReflectProperty decorator', async () => {
      const mock_source_code = `\
import type { u8, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class BitfieldComponent {
   @ReflectProperty({ bits: 4 })
   nibble!: t<u8>;
}\
`;

      const ast = await swc.parse(mock_source_code, { syntax: 'typescript', decorators: true });
      const visitor = new ReflectMetadataVisitor(mock_source_code, new Map(), 'test.ts', () => { }, () => { }, false, FileOrigin.User);
      visitor.visitModule(ast);

      const metadata_map = visitor.get_collected_metadata();
      const mock_metadata = metadata_map.get('BitfieldComponent');
      expect(mock_metadata).toBeDefined();

      const nibble_prop = mock_metadata!.properties.find(p => p.property_key === 'nibble')!;
      expect(nibble_prop).toBeDefined();
      expect(nibble_prop.bits).toBe(4);
   });

   it('should extract default_value from @ReflectProperty decorator', async () => {
      const mock_source_code = `\
import type { str, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class DefaultValueComponent {
   @ReflectProperty({ default_value: 'Hello, World!' })
   data!: t<str>;
}\
`;

      const ast = await swc.parse(mock_source_code, { syntax: 'typescript', decorators: true });
      const visitor = new ReflectMetadataVisitor(mock_source_code, new Map(), 'test.ts', () => { }, () => { }, false, FileOrigin.User);
      visitor.visitModule(ast);

      const metadata_map = visitor.get_collected_metadata();
      const mock_metadata = metadata_map.get('DefaultValueComponent');
      expect(mock_metadata).toBeDefined();

      const prop = mock_metadata!.properties.find(p => p.property_key === 'data')!;
      expect(prop.default_value).toEqual('Hello, World!');
   });

   it('should throw an error for a non-literal default_value', async () => {
      const mock_source_code = `\
import type { u64, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class InvalidDefaultComponent {
   @ReflectProperty({ default_value: new Date() })
   timestamp!: t<u64>;
}\
`;
      const ast = await swc.parse(mock_source_code, { syntax: 'typescript', decorators: true });
      const visitor = new ReflectMetadataVisitor(mock_source_code, new Map(), 'test.ts', () => { }, () => { }, false, FileOrigin.User);

      expect(() => visitor.visitModule(ast)).toThrow(/unsupported expression type 'NewExpression' in default value/);
   });

   it('should extract a default_value object for a nested guerrero struct property', async () => {
      const mock_source_code = `\
import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { f32, t } from '@eldritch-engine/type-utils/guerrero/markers';

@Reflectable()
export class Vec2 {
   x!: t<f32>;
   y!: t<f32>;
}

@Reflectable()
export class GameObject {
   @ReflectProperty({ default_value: { x: 100, y: 200 } })
   position!: t<Vec2>;
}\
`;

      const ast = await swc.parse(mock_source_code, { syntax: 'typescript', decorators: true });
      const visitor = new ReflectMetadataVisitor(mock_source_code, new Map(), 'test.ts', () => { }, () => { }, false, FileOrigin.User);
      visitor.visitModule(ast);

      const metadata_map = visitor.get_collected_metadata();
      const mock_metadata = metadata_map.get('GameObject');
      expect(mock_metadata).toBeDefined();

      const prop = mock_metadata!.properties.find(p => p.property_key === 'position')!;
      expect(prop.default_value).toEqual({ x: 100, y: 200 });
   });

   it('should extract default_value from property initializers without a decorator', async () => {
      const mock_source_code = `\
import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';
import type { f32, u32, str, t } from '@eldritch-engine/type-utils/guerrero/markers';

export const enum MyEnum { A, B = 5, C };
const DEFAULT_HEALTH = 100;

@Reflectable()
export class Vec2 {
   x!: t<f32>;
   y!: t<f32>;
}

@Reflectable()
export class InitializerComponent {
   health: t<u32> = DEFAULT_HEALTH;
   player_name: t<str> = 'default_player';
   start_position: t<Vec2> = { x: 10, y: 20 }; // WILL type error
   state: MyEnum = MyEnum.B;
}\
`;

      const ast = await swc.parse(mock_source_code, { syntax: 'typescript', decorators: true });
      const visitor = new ReflectMetadataVisitor(mock_source_code, new Map(), 'test.ts', () => { }, () => { }, false, FileOrigin.User);
      visitor.visitModule(ast);

      const metadata_map = visitor.get_collected_metadata();

      const enum_meta = metadata_map.get('MyEnum');
      expect(enum_meta).toBeDefined();

      const mock_metadata = metadata_map.get('InitializerComponent');
      expect(mock_metadata).toBeDefined();

      const health_prop = mock_metadata!.properties.find(p => p.property_key === 'health')!;
      const name_prop = mock_metadata!.properties.find(p => p.property_key === 'player_name')!;
      const pos_prop = mock_metadata!.properties.find(p => p.property_key === 'start_position')!;
      const state_prop = mock_metadata!.properties.find(p => p.property_key === 'state')!;

      expect(health_prop.default_value).toEqual(100);
      expect(name_prop.default_value).toBe('default_player');
      expect(pos_prop.default_value).toEqual({ x: 10, y: 20 });
      expect(state_prop.default_value).toBe(5);
   });
});