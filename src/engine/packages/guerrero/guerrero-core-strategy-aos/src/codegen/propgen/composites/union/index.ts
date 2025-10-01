/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/codegen/propgen/composites/union/index.ts
 */

import type { PropertyLayout, UnionVariantMetadata } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';

import { FIXED_PRIMITIVE_TYPE_DETAILS } from '@eldritch-engine/guerrero-core/layout/constants';

import { sanitize_type_for_name } from '@eldritch-engine/guerrero-core/utils/schema';

export class UnionPropgen implements IPropertyCodegen {

   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean {
      if (!property_layout.binary_info.is_union) {
         return false;
      }

      if (
         property_layout.binary_info.is_optional
         && property_layout.binary_info.variants?.length === 1
      ) {
         const variant = property_layout.binary_info.variants[0]!;

         if (
            FIXED_PRIMITIVE_TYPE_DETAILS.has(variant.type_string)
            || variant.binary_info.is_nested_struct
            || variant.binary_info.is_ptr
         ) {
            return false;
         }
      }

      return true;
   }

   #find_propgen_for_variant(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata
   ): IPropertyCodegen | undefined {
      const mock_prop_layout: PropertyLayout = {
         property_key: '',
         order: 0,
         type: variant.type_string,
         binary_info: variant.binary_info,
         offset: 0,
         size: 0,
         alignment: 0,
      };

      return strategy.propgens.find((p) => p.can_handle(strategy, mock_prop_layout));
   }

   get_required_imports(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): Set<string> {
      const imports = new Set<string>();

      if (!property_layout.binary_info.variants) {
         return imports;
      }

      for (const variant of property_layout.binary_info.variants) {
         const propgen = this.#find_propgen_for_variant(strategy, variant);

         if (propgen) {
            const mock_variant_layout: PropertyLayout = {
               ...property_layout,
               property_key: `${String(property_layout.property_key)}_${sanitize_type_for_name(variant.type_string)}`,
               type: variant.type_string,
               binary_info: variant.binary_info,
            };

            for (const imp of propgen.get_required_imports(strategy, mock_variant_layout)) {
               imports.add(imp);
            }
         } else if (!FIXED_PRIMITIVE_TYPE_DETAILS.has(variant.type_string)) {
            imports.add(variant.type_string);
         }
      }

      return imports;
   }

   generate_private_view_field(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string {
      let fields = '';

      if (!property_layout.binary_info.variants) {
         return fields;
      }

      const main_prop_key_str = String(property_layout.property_key);

      for (const variant of property_layout.binary_info.variants) {
         const propgen = this.#find_propgen_for_variant(strategy, variant);

         if (propgen?.generate_private_view_field) {
            const private_prop_name = `#${main_prop_key_str}_view_${sanitize_type_for_name(variant.type_string)}`;

            const view_type_info = strategy.get_or_generate_view_and_schema_for_type(variant.type_string);
            const view_type = variant.binary_info.is_nested_struct ? variant.type_string : view_type_info.class_name;

            fields += `\
   ${private_prop_name}?: ${view_type};
`;
         }
      }

      return fields;
   }

   generate_getter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const prop_key_str = String(property_layout.property_key);
      const variants = property_layout.binary_info.variants ?? [];
      const is_optional = property_layout.binary_info.is_optional;

      const return_types = variants.map(
         (v) => {
            if (FIXED_PRIMITIVE_TYPE_DETAILS.has(v.type_string)) {
               return FIXED_PRIMITIVE_TYPE_DETAILS.get(v.type_string)!.ts_type;
            }

            if (v.binary_info.is_nested_struct) {
               return v.type_string;
            }

            const view_info = strategy.get_or_generate_view_and_schema_for_type(v.type_string);

            return view_info.class_name;
         }
      );

      if (is_optional) {
         return_types.push('undefined');
      }

      const return_type = return_types.join(' | ');

      const switch_cases = variants.map(variant => {
         const propgen = this.#find_propgen_for_variant(strategy, variant);

         if (propgen?.generate_union_getter_case) {
            return propgen.generate_union_getter_case(strategy, variant, property_layout, class_name);
         }

         return `// error: no propgen found for union variant '${variant.type_string}'`;
      }).join('\n\n');

      return `\
   get ${prop_key_str}(): ${return_type} {
      const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;
      const tag = this.__view.getUint8(this.__byte_offset + prop_schema.offset);
      const data_offset = (this.__byte_offset + prop_schema.offset + 1 + (prop_schema.alignment - 1)) & ~(prop_schema.alignment - 1);

      switch (tag) {
${switch_cases}
         default: {
            return;
         }
      }
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
      const variants = property_layout.binary_info.variants ?? [];
      const is_optional = property_layout.binary_info.is_optional;

      const setter_types = variants.map(
         (v) => {
            if (FIXED_PRIMITIVE_TYPE_DETAILS.has(v.type_string)) {
               return FIXED_PRIMITIVE_TYPE_DETAILS.get(v.type_string)!.ts_type;
            }

            if (v.binary_info.is_nested_struct) {
               return v.type_string;
            }

            const view_type_info = strategy.get_or_generate_view_and_schema_for_type(v.type_string);

            return view_type_info.class_name;
         }
      );

      if (is_optional) {
         setter_types.push('undefined');
      }

      const setter_param_type = setter_types.join(' | ');

      const if_else_chain = variants
         .map(
            (variant) => {
               const propgen = this.#find_propgen_for_variant(strategy, variant);

               if (propgen?.generate_union_setter_case) {
                  return propgen.generate_union_setter_case(strategy, variant, property_layout, class_name)?.trim();
               }

               return `// error: no propgen for variant '${variant.type_string}'`;
            }
         ).join(' else ');

      const free_logic_cases = variants
         .filter(v => v.binary_info.has_dynamic_data)
         .map(
            (variant) => {
               const propgen = this.#find_propgen_for_variant(strategy, variant);

               return propgen?.generate_union_free_case?.(strategy, variant, property_layout) ?? `// error: no free case generator for ${variant.type_string}`;
            }
         )
         .join('\n\n')
         .trimEnd();

      const invalidate_views_code = variants
         .filter(
            (v) => {
               const propgen = this.#find_propgen_for_variant(strategy, v);

               return propgen?.generate_private_view_field != null;
            }
         )
         .map(v => `\
            this.#${prop_key_str}_view_${sanitize_type_for_name(v.type_string)} = undefined;\
`)
         .join('\n\n')
         .trimEnd();

      return `\
   ${setter_access} ${prop_key_str}(value: ${setter_param_type}) {
      const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;
      const tag_offset = this.__byte_offset + prop_schema.offset;
      const data_offset = (tag_offset + 1 + (prop_schema.alignment - 1)) & ~(prop_schema.alignment - 1);
      const data_size = prop_schema.size - (data_offset - tag_offset);
      const current_tag = this.__view.getUint8(tag_offset);

      const free_and_clear_current = () => {
         switch (current_tag) {
${free_logic_cases}
         }

         new Uint8Array(this.__buffer, data_offset, data_size).fill(0);

${invalidate_views_code}
      };

      if (value == null) {
         if (current_tag !== 0) {
            free_and_clear_current();

            this.__view.setUint8(tag_offset, 0);
         }

         return;
      }

      let new_tag = 0;

${if_else_chain}
   }\
`;
   }

   generate_free_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined {
      if (!property_layout.binary_info.has_dynamic_data) {
         return;
      }

      const prop_key_str = String(property_layout.property_key);
      const variants = (property_layout.binary_info.variants ?? []).filter(v => v.binary_info.has_dynamic_data);

      if (variants.length === 0) {
         return;
      }

      const cases = variants
         .map(
            (variant) => {
               const propgen = this.#find_propgen_for_variant(strategy, variant);

               if (propgen?.generate_union_free_case) {
                  return propgen.generate_union_free_case(strategy, variant, property_layout);
               }

               return `// error: no free case generator for ${variant.type_string}`;
            }
         )
         .join('\n')
         .trimEnd();

      return `\
      const ${prop_key_str}_prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;
      const ${prop_key_str}_tag = this.__view.getUint8(this.__byte_offset + ${prop_key_str}_prop_schema.offset);

      switch (${prop_key_str}_tag) {
${cases}
      }\
`;
   }

   generate_hash_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);

      return `\
      hash = (hash * 31 + this.${prop_key_str}?.$hash?.()) | 0;\
`;
   }

   generate_equals_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);

      return `\
      if (!this.${prop_key_str}?.$equals?.(other.${prop_key_str})) {
         const current_val = this.${prop_key_str};
         const other_val = other.${prop_key_str};

         if (current_val !== other_val) {
            return false;
         }
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
      const data_offset_expr = `(this.__byte_offset + prop_schema.offset + 1 + (prop_schema.alignment - 1)) & ~(prop_schema.alignment - 1)`;

      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(variant.type_string);
      const constructor_call = `\
new ${view_type_info.class_name}(
                     this.__buffer,
                     data_offset,
                     this.__allocator!,
                     ${class_name},
                     this.__byte_offset
                  )\
`;

      return `\
            case ${variant.tag}: {
               if (this.${private_prop_name} == null) {
                  const data_offset = ${data_offset_expr};

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
      const view_type_info = strategy.get_or_generate_view_and_schema_for_type(variant.type_string);
      const view_class_name = view_type_info.class_name;

      return `\
      if (value instanceof ${view_class_name}) {
         new_tag = ${variant.tag};

         if (current_tag !== new_tag) {
            free_and_clear_current();

            this.__view.setUint8(tag_offset, new_tag);
         }

         // might type error
         this.${prop_key_str}.$copy_from(value);
      }\
`;
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