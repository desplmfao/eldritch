/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/codegen/propgen/composites/struct/index.ts
 */

import type { PropertyLayout, UnionVariantMetadata } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';

import { sanitize_type_for_name } from '@eldritch-engine/guerrero-core/utils/schema';

export class StructPropgen implements IPropertyCodegen {

   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean {
      return (property_layout.binary_info.is_nested_struct ?? false)
         && property_layout.binary_info.element_count == null;
   }

   get_required_imports(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): Set<string> {
      return new Set([
         property_layout.type
      ]);
   }

   generate_private_view_field(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view`;
      const struct_type_name = strategy.get_type_name_for_codegen(property_layout.type);

      return `\
   ${private_prop_name}?: ${struct_type_name};
`;
   }

   generate_getter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view`;
      const original_struct_type_name = property_layout.type;
      const struct_type_name = original_struct_type_name;
      const metadata = strategy.registry.get_class_metadata(original_struct_type_name);
      const is_extend_alias = metadata?.alias_mode === 'extend';
      const constructor_name = is_extend_alias ? original_struct_type_name : strategy.get_type_name_for_codegen(original_struct_type_name);
      const is_optional = property_layout.binary_info.is_optional;
      const return_type = is_optional ? `${struct_type_name} | undefined` : struct_type_name;

      const comment_block = property_layout.description
         ? `\
   /**
    * ${property_layout.description.replace(/\n/g, '\n    * ')}
    */\
`
         : '';

      if (is_optional) {
         return `\
${comment_block}
   get ${prop_key_str}(): ${return_type} {
      const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;
      const presence_flag = this.__view.getUint8(this.__byte_offset + prop_schema.offset);

      if (presence_flag === 0) {
         return;
      }

      if (this.${private_prop_name} == null) {
         const data_offset = (this.__byte_offset + prop_schema.offset + 1 + (prop_schema.alignment - 1)) & ~(prop_schema.alignment - 1);

         this.${private_prop_name} = new ${constructor_name}(
            this.__buffer,
            data_offset,
            this.__allocator,
            ${class_name},
            this.__byte_offset
         );
      }

      return this.${private_prop_name};
   }\
`;
      } else {
         return `\
${comment_block}
   get ${prop_key_str}(): ${return_type} {
      if (this.${private_prop_name} == null) {
         const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;
         const data_offset = this.__byte_offset + prop_schema.offset;

         this.${private_prop_name} = new ${constructor_name}(
            this.__buffer,
            data_offset,
            this.__allocator,
            ${class_name},
            this.__byte_offset
         );
      }

      return this.${private_prop_name};
   }\
`;
      }
   }

   generate_setter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const setter_access = property_layout.read_only ? 'private set' : 'set';
      const prop_key_str = String(property_layout.property_key);
      const original_struct_type_name = property_layout.type;
      const struct_type_name = original_struct_type_name;
      const is_optional = property_layout.binary_info.is_optional;

      const setter_param = is_optional ? `value?: ${struct_type_name}` : `value: ${struct_type_name}`;

      if (is_optional) {
         const free_statement = property_layout.binary_info.has_dynamic_data
            ? `\
         this.${prop_key_str}?.free?.();\
`
            : '';

         return `\
   ${setter_access} ${prop_key_str}(${setter_param}) {
      const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;

      if (value == null) {
${free_statement}

         this.__view.setUint8(this.__byte_offset + prop_schema.offset, 0);

         return;
      }

      this.__view.setUint8(this.__byte_offset + prop_schema.offset, 1);

      const dest_view = this.${prop_key_str};

      if (dest_view) {
         dest_view.$copy_from(value as ${struct_type_name});
      }
   }\
`;
      } else {
         return `\
   ${setter_access} ${prop_key_str}(${setter_param}) {
      const dest_view = this.${prop_key_str};

      dest_view.$copy_from(value);
   }\
`;
      }
   }

   generate_free_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      if (!property_layout.binary_info.has_dynamic_data) {
         return;
      }

      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view`;

      return `\
      this.${private_prop_name}?.free?.();\
`;
   }

   generate_hash_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);

      return `\
      hash = (hash * 31 + (this.${prop_key_str}?.$hash())) | 0;\
`;
   }

   generate_equals_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const is_optional = property_layout.binary_info.is_optional;

      if (is_optional) {
         return `\
      if ((this.${prop_key_str} == null) !== (other.${prop_key_str} == null)) {
         return false;
      }

      if (
         this.${prop_key_str}
         && !this.${prop_key_str}.$equals(other.${prop_key_str}!)
      ) {
         return false;
      }\
`;
      } else {
         return `\
      if (!this.${prop_key_str}.$equals(other.${prop_key_str})) {
         return false;
      }\
`;
      }
   }

   generate_union_getter_case(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view_${sanitize_type_for_name(variant.type_string)}`;
      const struct_type_name_aliased = strategy.get_type_name_for_codegen(variant.type_string);

      return `\
            case ${variant.tag}: {
               if (this.${private_prop_name} == null) {
                  this.${private_prop_name} = new ${struct_type_name_aliased}(
                     this.__buffer,
                     data_offset,
                     this.__allocator,
                     ${class_name},
                     this.__byte_offset
                  );
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
      const private_prop_name = `#${prop_key_str}_view_${sanitize_type_for_name(variant.type_string)}`;
      const struct_type_name_aliased = strategy.get_type_name_for_codegen(variant.type_string);

      return `\
      if (value instanceof ${struct_type_name_aliased}) {
         new_tag = ${variant.tag};

         if (current_tag !== new_tag) {
            free_and_clear_current();

            this.__view.setUint8(tag_offset, new_tag);
         }

         this.${prop_key_str}; // ensures view is initialized

         this.${private_prop_name}!.$copy_from(value);
      }\
`;
   }

   generate_union_free_case(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout
   ): string | undefined {
      if (!variant.binary_info.has_dynamic_data) {
         return `case ${variant.tag}: break;`;
      }

      const prop_key_str = String(property_layout.property_key);
      const private_prop_name = `#${prop_key_str}_view_${sanitize_type_for_name(variant.type_string)}`;

      return `\
            case ${variant.tag}: {
               this.${prop_key_str}; // ensure view is initialized

               this.${private_prop_name}?.free?.();

               break;
            }`;
   }
}