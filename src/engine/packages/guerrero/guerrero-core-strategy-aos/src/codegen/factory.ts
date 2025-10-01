/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/codegen/factory.ts
 */

import type { SchemaLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';

import { CodegenStrategyBase } from '@eldritch-engine/guerrero-core/codegen/factory';
import { IMPORT_MAP as CORE_IMPORT_MAP } from '@eldritch-engine/guerrero-core/constants';

import { IMPORT_MAP as AOS_IMPORT_MAP } from '@self/codegen/constants';

import { FixedPrimitivePropgen } from '@self/codegen/propgen/primitives/index';

import { FixedArrayPropgen } from '@self/codegen/propgen/collections/array/fixed/index';
import { DynamicArrayPropgen } from '@self/codegen/propgen/collections/array/dynamic/index';

import { DynamicStringPropgen } from '@self/codegen/propgen/collections/string/index';
import { DynamicHashMapPropgen } from '@self/codegen/propgen/collections/hashmap/index';
import { DynamicSetPropgen } from '@self/codegen/propgen/collections/set/index';
import { DynamicSparseSetPropgen } from '@self/codegen/propgen/collections/sparseset/index';

import { StructPropgen } from '@self/codegen/propgen/composites/struct/index';
import { TuplePropgen } from '@self/codegen/propgen/composites/tuple/index';
import { UnionPropgen } from '@self/codegen/propgen/composites/union/index';

import { EnumPropgen } from '@self/codegen/propgen/special/enum/index';

export class CodegenStrategyAOS extends CodegenStrategyBase {
   propgens: IPropertyCodegen[] = [
      new UnionPropgen(),
      new EnumPropgen(),
      new TuplePropgen(),
      new FixedPrimitivePropgen(),
      new FixedArrayPropgen(),
      new DynamicStringPropgen(),
      new DynamicArrayPropgen(),
      new DynamicHashMapPropgen(),
      new DynamicSetPropgen(),
      new DynamicSparseSetPropgen(),
      new StructPropgen(),
   ];

   get_import_map(): ReadonlyMap<string, string> {
      if (!this.combined_import_map) {
         this.combined_import_map = new Map([
            ...CORE_IMPORT_MAP,
            ...AOS_IMPORT_MAP
         ]);
      }

      return this.combined_import_map;
   }

   generate_constructor_code(
      layout: SchemaLayout,
      class_name: string
   ): string {
      const has_defaults = layout.properties.some(p => p.default_value != null);
      const initialization_call = has_defaults ? `\
      if (is_new_instance) {
         this.#initialize_defaults();
      }\
` : '';

      return `
   readonly __view!: DataView;
   readonly __buffer!: ArrayBufferLike;
   readonly __byte_offset!: Pointer;
   readonly __allocator?: TlsfAllocator;

   readonly __owner_constructor?: IViewConstructor<IView>;
   readonly __owner_allocation_ptr?: Pointer;

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator?: TlsfAllocator,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer,
      //
      is_new_instance: boolean = false
   ) {
      /// #if SAFETY
      if ((byte_offset % ${class_name}.__schema.alignment) !== 0) {
         throw new Error(\`${class_name} byte_offset \${byte_offset} is not aligned to \${${class_name}.__schema.alignment}\`);
      }
      /// #endif

      this.__buffer = buffer;
      this.__byte_offset = byte_offset;
      this.__allocator = allocator;
      this.__view = new DataView(buffer);

      this.__owner_constructor = owner_constructor;
      this.__owner_allocation_ptr = owner_allocation_ptr;

${initialization_call}
   }
`;
   }


   generate_initialize_defaults_method_code(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined {
      const initialization_statements = layout.properties
         .filter(prop => prop.default_value != null)
         .map(
            (prop) => {
               const prop_key_str = String(prop.property_key);
               const default_value_str = this.generate_default_value_string(prop.default_value, prop);

               return `\
      this.${prop_key_str} = ${default_value_str};\
`;
            }
         );

      if (initialization_statements.length === 0) {
         return;
      }

      const initialization_code = `
      // initialize properties with default values from schema
${initialization_statements.join('\n')}\
`;

      return `\
   #initialize_defaults(): void {
${initialization_code}
   }\
`;
   }

   generate_free_method_code(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined {
      const free_statements = [];

      for (const prop_layout of layout.properties.values()) {
         const handler = this.propgens.find(gen => gen.can_handle(this, prop_layout));

         if (handler?.generate_free_statement) {
            const free_stmt = handler.generate_free_statement(this, prop_layout, class_name);

            if (free_stmt?.trim()) {
               free_statements.push(free_stmt);
            }
         }
      }

      if (free_statements.length === 0) {
         return;
      }

      return `\
{
${free_statements.join('\n')}
   }\
`;
   }

   generate_copy_from_method_code(
      layout: SchemaLayout
   ): string {
      const copy_statements = Array.from(layout.properties.values())
         .map(
            (p) => `\
      this.${String(p.property_key)} = source.${String(p.property_key)};\
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
      let hash_statements_code = '';
      let needs_method = false;

      for (const prop_layout of layout.properties.values()) {
         const handler = this.propgens.find(gen => gen.can_handle(this, prop_layout));

         if (handler?.generate_hash_statement) {
            const hash_stmt = handler.generate_hash_statement(this, prop_layout, class_name);

            if (hash_stmt?.trim()) {
               hash_statements_code += hash_stmt + '\n';
               needs_method = true;
            }
         }
      }

      if (!needs_method) {
         return;
      }

      return `\
{
      let hash = 17;

${hash_statements_code.trimEnd()}

      return hash;
   }\
`;
   }

   generate_equals_method_code(
      layout: SchemaLayout,
      class_name: string
   ): string | undefined {
      let equals_statements_code = '';
      let needs_method = false;

      for (const prop_layout of layout.properties.values()) {
         const handler = this.propgens.find(gen => gen.can_handle(this, prop_layout));

         if (handler?.generate_equals_statement) {
            const equals_stmt = handler.generate_equals_statement(this, prop_layout, class_name);

            if (equals_stmt?.trim()) {
               equals_statements_code += equals_stmt + '\n';
               needs_method = true;
            }
         }
      }

      if (!needs_method) {
         return;
      }

      return `\
{
      if (this === other) {
         return true;
      }

      if (
         this.__byte_offset === other.__byte_offset
         && this.__buffer === other.__buffer
      ) {
         return true;
      }

${equals_statements_code.trimEnd()}

      return true;
   }\
`;
   }
}