/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-native/src/codegen/factory.ts
 */

import { TypeParser, stringify_type_node } from '@eldritch-engine/guerrero-core/layout/parser/parser';
import { FIXED_PRIMITIVE_TYPE_DETAILS } from '@eldritch-engine/guerrero-core/layout/constants';

import type { PropertyLayout, SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { TypeNode } from '@eldritch-engine/type-utils/guerrero/parser';

import { CodegenStrategyBase } from '@eldritch-engine/guerrero-core/codegen/factory';
import { IMPORT_MAP as CORE_IMPORT_MAP } from '@eldritch-engine/guerrero-core/constants';

import { IMPORT_MAP as NATIVE_IMPORT_MAP } from '@self/codegen/constants';

import { FixedPrimitivePropgen } from '@self/codegen/propgen/primitives/index';

import { DynamicStringPropgen } from '@self/codegen/propgen/collections/string/index';
import { DynamicArrayPropgen } from '@self/codegen/propgen/collections/array/dynamic/index';
import { DynamicMapPropgen } from '@self/codegen/propgen/collections/map/index';
import { DynamicSetPropgen } from '@self/codegen/propgen/collections/set/index';
import { DynamicSparseSetPropgen } from '@self/codegen/propgen/collections/sparseset/index';

import { StructPropgen } from '@self/codegen/propgen/composites/struct/index';
import { TuplePropgen } from '@self/codegen/propgen/composites/tuple/index';
import { UnionPropgen } from '@self/codegen/propgen/composites/union/index';

import { EnumPropgen } from '@self/codegen/propgen/special/enum/index';

export class CodegenStrategyNative extends CodegenStrategyBase {
   override readonly generates_iview: boolean = false;

   propgens: IPropertyCodegen[] = [
      new UnionPropgen(),
      new EnumPropgen(),
      new TuplePropgen(),
      new FixedPrimitivePropgen(),
      new DynamicStringPropgen(),
      new DynamicArrayPropgen(),
      new DynamicMapPropgen(),
      new DynamicSetPropgen(),
      new DynamicSparseSetPropgen(),
      new StructPropgen(),
   ];

   get_import_map(): ReadonlyMap<string, string> {
      if (!this.combined_import_map) {
         this.combined_import_map = new Map([
            ...CORE_IMPORT_MAP,
            ...NATIVE_IMPORT_MAP
         ]);
      }

      return this.combined_import_map;
   }

   generate_constructor_code(
      layout: SchemaLayout,
      class_name: string
   ): string {
      return `\
   constructor() {
      this.#initialize_defaults();
   }`;
   }

   #get_default_initializer(
      prop: PropertyLayout
   ): string {
      if (prop.default_value != null) {
         return this.generate_default_value_string(prop.default_value, prop);
      }

      if (prop.binary_info.is_optional) {
         return 'undefined';
      }

      const type_node = new TypeParser(prop.type).parse();

      const generate_for_node = (node: TypeNode): string => {
         switch (node.kind) {
            case 'primitive': {
               if (node.name === 'str') {
                  return "''";
               }

               const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(node.name)!;

               switch (details.ts_type) {
                  case 'bigint': return '0n';
                  case 'boolean': return 'false';

                  default: return '0';
               }
            }
            case 'identifier': {
               const meta = this.registry.get_class_metadata(node.name);

               if (meta?.definition_type === 'enum') {
                  const first_member = meta.enum_members?.[0];

                  return first_member ? `${node.name}.${first_member.name}` : `0 as ${node.name}`;
               }

               return `new ${node.name}()`;
            }

            case 'dynamic_array': {
               return '[]';
            }

            case 'fixed_array': {
               const element_type_str = stringify_type_node(node.element_type);
               const element_meta = this.registry.get_class_metadata(element_type_str);
               const is_object_like =
                  element_meta?.definition_type === 'struct' ||
                  !FIXED_PRIMITIVE_TYPE_DETAILS.has(element_type_str);

               if (is_object_like) {
                  return `Array.from({ length: ${node.count} }, () => ${generate_for_node(node.element_type)})`;
               } else {
                  return `new Array(${node.count}).fill(${generate_for_node(node.element_type)})`;
               }
            }

            case 'tuple': {
               const defaults = node.element_types.map(el => generate_for_node(el)).join(', ');

               return `[${defaults}]`;
            }

            case 'map': return 'new Map()';
            case 'set': return 'new DeepSet()';
            case 'sparseset': return 'new SparseSet()';
            case 'union': return 'null';
            case 'null': return 'null';
            default: return 'undefined';
         }
      };

      return generate_for_node(type_node);
   }

   override generate_initialize_defaults_method_code(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined {
      const initialization_statements = layout.properties.map(
         (prop) => {
            const prop_key_str = String(prop.property_key);
            const default_value_str = this.#get_default_initializer(prop);

            return `\
      this.#${prop_key_str} = ${default_value_str};\
`;
         }
      );

      if (initialization_statements.length === 0) {
         return;
      }

      const initialization_code = `\
      // initialize properties with default values
${initialization_statements.join('\n')}\
`;

      return `   #initialize_defaults(): void {
${initialization_code}
   }`;
   }


   generate_free_method_code(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined {
      return;
   }

   generate_copy_from_method_code(
      layout: SchemaLayout
   ): string {
      this.file_local_imports?.add('deep_clone');

      const copy_statements = Array.from(layout.properties.values())
         .map(
            (p) => `\
      this.${String(p.property_key)} = deep_clone(source.${String(p.property_key)});\
`)
         .join('\n');

      return `\
{
${copy_statements}
   }`;
   }

   generate_hash_method_code(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined {
      return;
   }

   generate_equals_method_code(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined {
      return;
   }
}