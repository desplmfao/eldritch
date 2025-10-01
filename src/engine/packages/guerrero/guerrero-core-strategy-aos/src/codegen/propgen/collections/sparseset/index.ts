/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/codegen/propgen/collections/sparseset/index.ts
 */

import type { PropertyLayout, SchemaLayout, UnionVariantMetadata } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { TypeNode } from '@eldritch-engine/type-utils/guerrero/parser';

import { TypeParser } from '@eldritch-engine/guerrero-core/layout/parser/parser';

import { generate_schema_layout_code, sanitize_type_for_name } from '@eldritch-engine/guerrero-core/utils/schema';
import { POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

//
//

export class DynamicSparseSetPropgen implements IPropertyCodegen {

   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean {
      return (property_layout.binary_info.is_dynamic ?? false)
         && new TypeParser(property_layout.type).parse().kind === 'sparseset';
   }

   get_required_imports(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): Set<string> {
      return new Set([
         'DynamicSparseSet',
         'TlsfAllocator',
         'IViewConstructor',
         'IGuerreroArray',
         'GLOBAL_NULL_POINTER'
      ]);
   }

   generate_private_view_field(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view`;

      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(property_layout.type);

      return `\
   ${private_prop_name}?: ${view_type_info.class_name};
`;
   }

   can_handle_as_standalone(
      type_node: TypeNode
   ): boolean {
      return type_node.kind === 'sparseset';
   }

   generate_standalone_view_class(
      strategy: ICodegenStrategy,
      type_node: TypeNode,
      class_name: string
   ): {
      code: string;
      imports: Set<string>;
      schema: SchemaLayout;
      internal_dependencies: Set<string>;
   } {
      const imports = new Set([
         'DynamicSparseSet',
         'SchemaLayout',
         'POINTER_SIZE',
         'IViewConstructor',
         'Pointer',
         'TlsfAllocator',
         'IGuerreroArray'
      ]);

      const internal_dependencies = new Set<string>();

      const schema_layout: SchemaLayout = {
         class_name: class_name,
         total_size: POINTER_SIZE,
         alignment: POINTER_SIZE,
         has_dynamic_data: true,
         properties: []
      };

      const u32_array_view_info = strategy.get_or_generate_view_and_schema_for_type('u32[]');
      const u32_array_view_name = u32_array_view_info.class_name;
      internal_dependencies.add(u32_array_view_name);

      const schema_code = generate_schema_layout_code(strategy, schema_layout);

      const code = `\
export class ${class_name} extends DynamicSparseSet {

   static readonly __schema: SchemaLayout = ${schema_code};

   constructor(
      buffer: ArrayBufferLike,
      byte_offset: Pointer,
      allocator: TlsfAllocator,
      //
      owner_constructor?: IViewConstructor<IView>,
      owner_allocation_ptr?: Pointer
   ) {
      super(
         buffer,
         byte_offset,
         allocator,
         //
         ${u32_array_view_name},
         //
         owner_constructor,
         owner_allocation_ptr
      );
   }
}\
`;

      return {
         code,
         imports,
         schema: schema_layout,
         internal_dependencies
      };
   }

   generate_getter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view`;
      const is_optional = property_layout.binary_info.is_optional;

      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(property_layout.type);
      const view_type = view_type_info.class_name;

      const constructor_call = `\
new ${view_type}(
            this.__buffer,
            this.__byte_offset + prop_schema.offset,
            this.__allocator!,
            ${class_name},
            this.__byte_offset
         )\
`;
      const return_type = is_optional ? `${view_type} | undefined` : view_type;

      const comment_block = property_layout.description
         ? `\
   /**
    * ${property_layout.description.replace(/\n/g, '\n    * ')}
    */\
`
         : '';

      const optional_check = is_optional
         ? `\n\n\
      if (this.${private_prop_name}.$control_block_ptr === GLOBAL_NULL_POINTER) {
         return;
      }\n\n\
`
         : '';

      return `\
${comment_block}
   get ${prop_key_str}(): ${return_type} {
      if (this.${private_prop_name} == null) {
         const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;

         this.${private_prop_name} = ${constructor_call};
      }
${optional_check}
      return this.${private_prop_name};
   }\
`;
   }

   generate_setter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const setter_access = property_layout.read_only ? 'private set' : 'set';
      const prop_key_str = String(property_layout.property_key);
      const is_optional = property_layout.binary_info.is_optional;
      const view_type = 'DynamicSparseSet';

      const setter_param = is_optional
         ? `value?: Iterable<number> | ${view_type}`
         : `value: Iterable<number> | ${view_type}`;

      const optional_logic = is_optional
         ? `\n\n\
      if (
         dest == null
         && value == null
      ) {
         return;
      }

      if (value == null) {
         dest!.free();
         
         return;
      }\n\n\
`
         : '';

      return `\
   ${setter_access} ${prop_key_str}(${setter_param}) {
      const dest = this.${prop_key_str};
${optional_logic}
      dest!.$copy_from(value);
   }\
`;
   }

   generate_free_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view`;

      return `\
      this.${private_prop_name}?.free?.();\
`;
   }

   generate_pointer_accessors(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view`;
      const ptr_prop_key = `${prop_key_str}_ptr`;

      return `\
   /** @internal */
   get ${ptr_prop_key}(): Pointer {
      this.${prop_key_str}; // ensures the view is initialized

      return this.${private_prop_name}!.$control_block_ptr;
   }

   /** @internal */
   set ${ptr_prop_key}(ptr: Pointer) {
      this.${prop_key_str}; // ensures the view is initialized
      this.${private_prop_name}!.$control_block_ptr = ptr;
   }\
`;
   }

   generate_hash_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      // TODO: IHashable?
      return;
   }

   generate_equals_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      // TODO: implement deep equal under a build flag 
      return;
   }

   generate_union_getter_case(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view_${sanitize_type_for_name(variant.type_string)}`;

      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(variant.type_string);
      const constructor_call = `new ${view_type_info.class_name}(this.__buffer, data_offset, this.__allocator!, ${class_name}, this.__byte_offset)`;


      return `\
            case ${variant.tag}: {
               if (this.${private_prop_name} == null) {
                  this.${private_prop_name} = ${constructor_call};
               }

               return this.${private_prop_name};
            }\
`;
   }

   generate_union_setter_case(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);

      return `\
      if (value instanceof DynamicSparseSet) {
         new_tag = ${variant.tag};

         if (current_tag !== new_tag) {
            free_and_clear_current();

            this.__view.setUint8(tag_offset, new_tag);
         }

         (this.${prop_key_str} as DynamicSparseSet).$copy_from(value);
      }`;
   }

   generate_union_free_case(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);

      return `\
            case ${variant.tag}: {
               this.${prop_key_str}?.free?.();
               
               break;
            }\
`;
   }
}