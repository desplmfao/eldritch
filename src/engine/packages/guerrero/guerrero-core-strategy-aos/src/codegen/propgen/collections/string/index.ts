/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/codegen/propgen/collections/string/index.ts
 */

import type { PropertyLayout, SchemaLayout, UnionVariantMetadata } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { TypeNode } from '@eldritch-engine/type-utils/guerrero/parser';

import { generate_schema_layout_code, sanitize_type_for_name } from '@eldritch-engine/guerrero-core/utils/schema';
import { POINTER_SIZE } from '@eldritch-engine/guerrero-core/runtime/allocator/constants';

//
//

export class DynamicStringPropgen implements IPropertyCodegen {

   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean {
      return property_layout.type === 'str';
   }

   get_required_imports(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): Set<string> {
      return new Set([
         'DynamicString',
         'hash_djb2'
      ]);
   }

   generate_private_view_field(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view`;

      return `
   ${private_prop_name}?: DynamicString;
`;
   }

   can_handle_as_standalone(
      type_node: TypeNode
   ): boolean {
      return type_node.kind === 'primitive'
         && type_node.name === 'str';
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
         'DynamicString',
         'SchemaLayout',
         'POINTER_SIZE'
      ]);

      const schema: SchemaLayout = {
         class_name: class_name,
         total_size: POINTER_SIZE,
         alignment: POINTER_SIZE,
         has_dynamic_data: true,
         properties: [] // strings are opaque pointers from schema perspective
      };

      const code = `\
export class ${class_name} extends DynamicString {
   static readonly __schema: SchemaLayout = ${generate_schema_layout_code(strategy, schema)};
}
`;

      return {
         code,
         imports,
         schema,
         internal_dependencies: new Set()
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
      const return_type = is_optional ? 'string | undefined' : 'string';

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

         this.${private_prop_name} = new DynamicString(
            this.__buffer,
            this.__byte_offset + prop_schema.offset,
            this.__allocator!,
            ${class_name},
            this.__byte_offset
         );
      }
${optional_check}
      return this.${private_prop_name}.value;
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
      const private_prop_name = `#${prop_key_str}_view`;
      const is_optional = property_layout.binary_info.is_optional;

      const setter_param = is_optional ? 'value?: string' : 'value: string';

      const optional_logic = is_optional
         ? `\n\n\
      if (value == null) {
         this.${private_prop_name}.free();
      } else {
         this.${private_prop_name}.value = value;
      }\
`
         : `\n\n\
      this.${private_prop_name}.value = value;\
`;

      return `\
   ${setter_access} ${prop_key_str}(${setter_param}) {
      if (this.${private_prop_name} == null) {
         const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;

         this.${private_prop_name} = new DynamicString(
            this.__buffer,
            this.__byte_offset + prop_schema.offset,
            this.__allocator!,
            ${class_name},
            this.__byte_offset
         );
      }
${optional_logic}
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
      const prop_key_str = String(property_layout.property_key);

      return `\
      hash = (hash * 31 + hash_djb2(this.${prop_key_str} ?? '')) | 0;\
`;
   }

   generate_equals_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);

      return `\
      if (this.${prop_key_str} !== other.${prop_key_str}) {
         return false;
      }\
`;
   }

   generate_union_getter_case(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view_${sanitize_type_for_name(variant.type_string)}`;

      return `\
            case ${variant.tag}: {
               if (this.${private_prop_name} == null) {
                  this.${private_prop_name} = new DynamicString(
                     this.__buffer,
                     data_offset,
                     this.__allocator!,
                     ${class_name},
                     this.__byte_offset
                  );
               }

               return this.${private_prop_name}.value;
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
      const private_prop_name = `#${prop_key_str}_view_${sanitize_type_for_name(variant.type_string)}`;

      return `\
      if (typeof value === 'string') {
         new_tag = ${variant.tag};

         if (current_tag !== new_tag) {
            free_and_clear_current();

            this.__view.setUint8(tag_offset, new_tag);
         }

         this.${prop_key_str}; // ensures view is initialized
         this.${private_prop_name}!.value = value;
      }\
`;
   }

   generate_union_free_case(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view_${sanitize_type_for_name(variant.type_string)}`;

      return `\
            case ${variant.tag}: {
               this.${prop_key_str}; // ensure view is initialized
               this.${private_prop_name}?.free?.();

               break;
            }\
`;
   }
}