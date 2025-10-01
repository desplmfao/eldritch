/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/codegen/propgen/special/enum/index.ts
 */

import type { PropertyLayout, UnionVariantMetadata } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';

import { FIXED_PRIMITIVE_TYPE_DETAILS } from '@eldritch-engine/guerrero-core/layout/constants';

export class EnumPropgen implements IPropertyCodegen {

   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean {
      return property_layout.binary_info.is_enum ?? false;
   }

   get_required_imports(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): Set<string> {
      return new Set<string>();
   }

   generate_private_static_field(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      if (
         !property_layout.enum_members
         || property_layout.enum_members.length === 0
      ) {
         return;
      }

      const prop_key_str = String(property_layout.property_key);
      const valid_values = `[${property_layout.enum_members.map(m => m.value).join(', ')}]`;

      return `\
   //\/ #if SAFETY
   private static readonly $valid_${prop_key_str}_values = new Set(${valid_values});
   //\/ #endif
`;
   }

   generate_getter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const base_type = property_layout.enum_base_type ?? 'u8';
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(base_type)!;
      const prop_key_str = String(property_layout.property_key);
      const enum_type_name = property_layout.type;
      const little_endian_arg = details.needs_little_endian_arg ? ', LITTLE_ENDIAN' : '';

      return `\
   get ${prop_key_str}(): ${enum_type_name} {
      const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;

      return this.__view.${details.getter}(this.__byte_offset + prop_schema.offset${little_endian_arg}) as ${enum_type_name};
   }\
`;
   }

   generate_setter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const setter_access = property_layout.read_only ? 'private set' : 'set';
      const base_type = property_layout.enum_base_type ?? 'u8';
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(base_type)!;
      const prop_key_str = String(property_layout.property_key);
      const enum_type_name = property_layout.type;
      const little_endian_arg = details.needs_little_endian_arg ? ', LITTLE_ENDIAN' : '';
      const static_set_name = `$valid_${prop_key_str}_values`;

      const safety_check = `\
      if (!${class_name}.${static_set_name}.has(value)) {
         throw new RangeError(\`invalid value for enum '${enum_type_name}'. received '\${value}'\`);
      }\
`;

      return `\
   ${setter_access} ${prop_key_str}(value: ${enum_type_name}) {
      //\/ #if SAFETY
${safety_check}
      //\/ #endif

      const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;

      this.__view.${details.setter}(this.__byte_offset + prop_schema.offset, value${little_endian_arg});
   }\
`;
   }

   generate_union_getter_case(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined {
      const base_type = property_layout.enum_base_type ?? 'u8';
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(base_type)!;
      const little_endian_arg = details.needs_little_endian_arg ? ', LITTLE_ENDIAN' : '';

      return `\
            case ${variant.tag}: {
               return this.__view.${details.getter}(data_offset${little_endian_arg}) as ${variant.type_string};
            }\
`;
   }

   generate_union_setter_case(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined {
      const base_type = property_layout.enum_base_type ?? 'u8';
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(base_type)!;
      const little_endian_arg = details.needs_little_endian_arg ? ', LITTLE_ENDIAN' : '';

      return `\
      if (typeof value === 'number') {
         new_tag = ${variant.tag};

         if (current_tag !== new_tag) {
            free_and_clear_current();

            this.__view.setUint8(tag_offset, new_tag);
         }

         this.__view.${details.setter}(data_offset, value${little_endian_arg});
      }\
`;
   }

   generate_union_free_case(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout
   ): string | undefined {
      return `case ${variant.tag}: break; // no-op`;
   }
}