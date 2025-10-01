/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/layout/resolver.ts
 */

import type { MetadataProperty, BinaryTypeInfo, UnionVariantMetadata, SchemaLayout, IViewConstructor } from '@eldritch-engine/type-utils/guerrero/index';
import type { TypeNode, DynamicArrayTypeNode, MapTypeNode, SetTypeNode } from '@eldritch-engine/type-utils/guerrero/parser';

import type { IBuildTimeRegistry } from '@eldritch-engine/type-utils/builder/registry';
import type { ITypeResolver, ResolvedTypeInfo } from '@eldritch-engine/type-utils/builder/resolver';
import type { ICodegenStrategy } from '@eldritch-engine/type-utils/guerrero/codegen';

import { TypeParser, stringify_type_node } from '@self/layout/parser/parser';
import { FIXED_PRIMITIVE_TYPE_DETAILS } from '@self/layout/constants';

import { POINTER_SIZE } from '@self/runtime/allocator/constants';

import { align_offset } from '@self/layout/calculator';

export class TypeResolver implements ITypeResolver {
   readonly registry: IBuildTimeRegistry;
   readonly strategy?: ICodegenStrategy;
   readonly cache = new Map<string, ResolvedTypeInfo>();

   constructor(
      registry: IBuildTimeRegistry,
      strategy?: ICodegenStrategy
   ) {
      this.registry = registry;
      this.strategy = strategy;
   }

   resolve(
      type_string: string,
      is_optional_from_prop: boolean = false,
      prop_metadata?: MetadataProperty
   ): ResolvedTypeInfo {
      const alias_target = this.registry.get_type_alias_target(type_string);

      if (alias_target) {
         return this.resolve(alias_target, is_optional_from_prop, prop_metadata);
      }

      const cache_key = `${type_string}|${is_optional_from_prop}|${prop_metadata?.enum_base_type ?? ''}`;

      if (this.cache.has(cache_key)) {
         return this.cache.get(cache_key)!;
      }

      if (
         'process' in global
         && process.env['VERBOSE_BT'] === 'true'
      ) {
         console.info(`received resolve request for type string: '${type_string}'`);
      }

      let node: TypeNode;

      try {
         node = new TypeParser(type_string.trim()).parse();

         if (process.env['VERBOSE_BT'] === 'true') {
            console.info(`   -> parsed ast node: ${JSON.stringify(node)}`);
         }
      } catch (e) {
         throw new Error(`failed to parse type string '${type_string}'. reason: ${e.message}`, { cause: e });
      }

      // union
      if (is_optional_from_prop) {
         switch (node.kind) {
            case 'null': {
               break;
            }

            case 'union': {
               if (!node.variants.some((v) => v.kind === 'null')) {
                  // UnionTypeNode
                  node.variants.push(
                     {
                        kind: 'null'
                     }
                  );
               }

               break;
            }

            default: {
               node = {
                  kind: 'union',
                  variants: [
                     node,
                     {
                        kind: 'null'
                     }
                  ],
               };

               break;
            }
         }
      }

      let binary_type_info: BinaryTypeInfo;

      try {
         binary_type_info = this.#get_binary_type_info_from_node(node, prop_metadata);
      } catch (e) {
         if (e.message.startsWith('unknown or unresolved type')) {
            throw new Error(`unknown or unresolved type '${type_string}'`, { cause: e });
         }

         throw e;
      }

      const canonical_string = stringify_type_node(node);

      let schema_layout: SchemaLayout | undefined;

      if (node.kind === 'identifier') {
         schema_layout = this.registry.get_schema_layout(node.name);
      } else if (
         this.strategy
         && this.strategy.propgens.some(p => p.can_handle_as_standalone?.(node))
      ) {
         const view_info = this.strategy.get_or_generate_view_and_schema_for_type(type_string);

         schema_layout = view_info.schema;
      } else {
         schema_layout = {
            class_name: canonical_string,
            total_size: binary_type_info.size,
            alignment: binary_type_info.alignment,
            has_dynamic_data: binary_type_info.has_dynamic_data ?? false,
            properties: []
         };
      }

      const result: ResolvedTypeInfo = {
         type_node: node,
         binary_type_info,
         canonical_string,
         schema_layout,
      };

      this.cache.set(cache_key, result);

      return result;
   }

   #get_binary_type_info_from_node(
      node: TypeNode,
      prop_metadata?: MetadataProperty
   ): BinaryTypeInfo {
      switch (node.kind) {
         case 'union': {
            const non_null_variants = node.variants
               .filter(s => s.kind !== 'null')
               .map(
                  (variant_node) => {
                     const variant_type_str = stringify_type_node(variant_node);

                     const resolved = this.resolve(
                        variant_type_str,
                        false,
                        {
                           ...prop_metadata,
                           type: variant_type_str
                        } as MetadataProperty
                     );

                     return {
                        node: variant_node,
                        binary_info: resolved.binary_type_info,
                        schema: resolved.schema_layout
                     };
                  }
               );

            if (non_null_variants.every(v => v.binary_info.is_ptr)) {
               const variants_meta: UnionVariantMetadata[] = non_null_variants.map(
                  (v, i) => ({
                     type_string: stringify_type_node(v.node),
                     tag: i + 1,
                     binary_info: v.binary_info,
                     schema: v.schema,
                  })
               );

               return {
                  size: POINTER_SIZE,
                  alignment: POINTER_SIZE,
                  is_dynamic: true,
                  has_dynamic_data: true,
                  is_ptr: true,
                  is_optional: true,
                  is_union: true,
                  variants: variants_meta,
               };
            }

            let max_size = 0;
            let max_alignment = 1;
            let has_dynamic_data = false;

            const final_variants_meta: UnionVariantMetadata[] = non_null_variants
               .map(
                  (v, i) => {
                     max_size = Math.max(max_size, v.binary_info.size);
                     max_alignment = Math.max(max_alignment, v.binary_info.alignment);

                     if (v.binary_info.has_dynamic_data) {
                        has_dynamic_data = true;
                     }

                     return {
                        type_string: stringify_type_node(v.node),
                        tag: i + 1,
                        binary_info: v.binary_info,
                        schema: v.schema,
                     };
                  }
               );

            const data_offset_after_tag = align_offset(1, max_alignment);
            const total_size = data_offset_after_tag + max_size;

            return {
               is_union: true,
               size: total_size,
               alignment: max_alignment,
               variants: final_variants_meta,
               has_dynamic_data: has_dynamic_data,
               is_optional: true,
            };
         }

         case 'primitive': {
            if (node.name === 'str') {
               return {
                  size: POINTER_SIZE,
                  alignment: POINTER_SIZE,
                  is_dynamic: true,
                  has_dynamic_data: true,
                  is_ptr: true
               };
            }

            if (FIXED_PRIMITIVE_TYPE_DETAILS.has(node.name)) {
               const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(node.name)!;

               return {
                  size: details.size,
                  alignment: details.alignment
               };
            }

            break;
         }

         case 'fixed_array': {
            let element_schema: SchemaLayout;

            const element_type_str = stringify_type_node(node.element_type);
            const resolved_element = this.resolve(element_type_str);
            const element_info = resolved_element.binary_type_info;
            const element_view_info = this.strategy?.get_or_generate_view_and_schema_for_type(element_type_str);

            if (element_view_info) {
               element_schema = element_view_info.schema;
            } else {
               let class_name_for_schema = resolved_element.canonical_string;

               if (
                  this.strategy
                  && FIXED_PRIMITIVE_TYPE_DETAILS.has(class_name_for_schema)
               ) {
                  class_name_for_schema = this.strategy.get_type_name_for_codegen(class_name_for_schema);
               }

               element_schema = resolved_element.schema_layout ?? {
                  class_name: class_name_for_schema,
                  total_size: element_info.size,
                  alignment: element_info.alignment,
                  has_dynamic_data: element_info.has_dynamic_data ?? false,
                  properties: []
               };
            }

            return {
               size: element_info.size * node.count,
               alignment: element_info.alignment,
               element_type: element_type_str,
               element_count: node.count,
               is_nested_struct: element_info.is_nested_struct,
               has_dynamic_data: element_info.has_dynamic_data,
               element_schema: element_schema,
            };
         }

         case 'tuple': {
            let current_offset = 0;
            let max_alignment = 1;
            let has_dynamic_data = false;

            const element_schemas: SchemaLayout[] = [];

            for (const element_type of node.element_types) {
               let element_schema: SchemaLayout;

               const element_type_str = stringify_type_node(element_type);
               const resolved_element = this.resolve(element_type_str);
               const element_info = resolved_element.binary_type_info;
               const element_view_info = this.strategy?.get_or_generate_view_and_schema_for_type(element_type_str);

               if (element_view_info) {
                  element_schema = element_view_info.schema;
               } else {
                  let class_name_for_schema = resolved_element.canonical_string;

                  if (
                     this.strategy
                     && FIXED_PRIMITIVE_TYPE_DETAILS.has(class_name_for_schema)
                  ) {
                     class_name_for_schema = this.strategy.get_type_name_for_codegen(class_name_for_schema);
                  }

                  element_schema = resolved_element.schema_layout ?? {
                     class_name: class_name_for_schema,
                     total_size: element_info.size,
                     alignment: element_info.alignment,
                     has_dynamic_data: element_info.has_dynamic_data ?? false,
                     properties: []
                  };
               }

               element_schemas.push(element_schema);

               max_alignment = Math.max(max_alignment, element_info.alignment);

               if (element_info.has_dynamic_data) {
                  has_dynamic_data = true;
               }

               current_offset = align_offset(current_offset, element_info.alignment);
               current_offset += element_info.size;
            }

            const total_size = align_offset(current_offset, max_alignment);

            return {
               is_tuple: true,
               size: total_size,
               alignment: max_alignment,
               has_dynamic_data: has_dynamic_data,
               element_schemas: element_schemas
            };
         }

         case 'dynamic_array':
         case 'map':
         case 'set':
         case 'sparseset': {
            let key_type: string | undefined;
            let element_type: string | undefined;
            let key_schema: SchemaLayout | undefined;
            let element_schema: SchemaLayout | undefined;

            switch (node.kind) {
               case 'sparseset': {
                  break;
               }

               case 'map': {
                  key_type = stringify_type_node((node as MapTypeNode).key_type);
                  element_type = stringify_type_node((node as MapTypeNode).value_type);

                  if (this.strategy) {
                     key_schema = this.strategy.get_or_generate_view_and_schema_for_type(key_type).schema;
                     element_schema = this.strategy.get_or_generate_view_and_schema_for_type(element_type).schema;
                  }

                  break;
               }

               default: {
                  element_type = stringify_type_node((node as DynamicArrayTypeNode | SetTypeNode).element_type);

                  if (this.strategy) {
                     element_schema = this.strategy.get_or_generate_view_and_schema_for_type(element_type).schema;
                  }

                  break;
               }
            }

            return {
               size: POINTER_SIZE,
               alignment: POINTER_SIZE,
               is_dynamic: true,
               has_dynamic_data: true,
               is_ptr: true,
               element_type,
               key_type,
               key_schema,
               element_schema,
            };
         }

         case 'identifier': {
            const alias_target = this.registry.get_type_alias_target(node.name);

            if (alias_target) {
               const new_node = new TypeParser(alias_target).parse();

               return this.#get_binary_type_info_from_node(new_node, prop_metadata);
            }

            const enum_meta = this.registry.get_class_metadata(node.name);

            if (enum_meta?.definition_type === 'enum') {
               const base_type = prop_metadata?.enum_base_type ?? 'u8';
               const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(base_type)!;
               const max_val = details.max_value!;

               for (const member of enum_meta.enum_members!) {
                  if (member.value > max_val) {
                     throw new Error(`enum member '${enum_meta.class_name}.${member.name}' value (${member.value}) exceeds the maximum value for its base type '${base_type}' (${max_val})`);
                  }
               }

               return {
                  size: details.size,
                  alignment: details.alignment,
                  is_enum: true
               };
            }

            const layout = this.registry.get_schema_layout(node.name);

            if (layout) {
               return {
                  size: layout.total_size,
                  alignment: layout.alignment,
                  is_nested_struct: true,
                  has_dynamic_data: layout.has_dynamic_data
               };
            }

            throw new Error(`type '${stringify_type_node(node)}' is not a valid guerrero type. properties in a reflectable class must be guerrero complaint`);
         }
      }

      throw new Error(`unknown or unresolved type during layout calculation: '${stringify_type_node(node)}'`);
   }
}