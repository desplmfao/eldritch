/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-aos/src/codegen/propgen/primitives/index.ts
 */

import type { PropertyLayout, SchemaLayout, UnionVariantMetadata } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { TypeNode, PrimitiveTypeNode } from '@eldritch-engine/type-utils/guerrero/parser';

import { generate_schema_layout_code } from '@eldritch-engine/guerrero-core/utils/schema';
import { FIXED_PRIMITIVE_TYPE_DETAILS, FIXED_PRIMITIVE_TYPES } from '@eldritch-engine/guerrero-core/layout/constants';

//
//

export class FixedPrimitivePropgen implements IPropertyCodegen {

   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean {
      const is_fixed_primitive_str = FIXED_PRIMITIVE_TYPES.has(property_layout.type);
      const is_not_dynamic = !property_layout.binary_info.is_dynamic;
      const is_not_nested_struct = !property_layout.binary_info.is_nested_struct;
      const is_not_array = property_layout.binary_info.element_count == null;

      return is_fixed_primitive_str
         && is_not_dynamic
         && is_not_nested_struct
         && is_not_array;
   }

   can_handle_as_standalone(
      type_node: TypeNode
   ): boolean {
      return type_node.kind === 'primitive'
         && FIXED_PRIMITIVE_TYPES.has(type_node.name);
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
      const primitive_node = type_node as PrimitiveTypeNode;
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(primitive_node.name)!;
      const ts_type = details.ts_type;
      const little_endian_arg_pv = details.needs_little_endian_arg ? ', LITTLE_ENDIAN' : '';
      let getter_impl_pv = `this.__view.${details.getter}(this.__byte_offset${little_endian_arg_pv})`;

      if (details.data_type === 'boolean') {
         getter_impl_pv = `!!(${getter_impl_pv})`;
      }

      const imports = new Set([
         'PrimitiveView',
         'SchemaLayout',
         'LITTLE_ENDIAN'
      ]);

      const schema_layout: SchemaLayout = {
         class_name: class_name,
         total_size: details.size,
         alignment: details.alignment,
         has_dynamic_data: false,
         properties: []
      };

      const schema_code = generate_schema_layout_code(strategy, schema_layout, class_name);

      const code = `\
export class ${class_name} extends PrimitiveView<${ts_type}> {

   static readonly __schema: SchemaLayout = ${schema_code};

   get value(): ${ts_type} {
      return ${getter_impl_pv};
   }

   set value(v: ${ts_type}) {
      this.__view.${details.setter}(this.__byte_offset, ${details.data_type === 'boolean' ? 'v ? 1 : 0' : 'v'}${little_endian_arg_pv});
   }
}\
`;

      return {
         code,
         imports,
         schema: schema_layout,
         internal_dependencies: new Set()
      };
   }

   generate_getter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const is_optional = property_layout.binary_info.is_optional;
      const base_type_str = property_layout.type;
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(base_type_str);

      if (!details) {
         throw new Error(`no details found for primitive type '${base_type_str}' during getter generation`);
      }

      const prop_key_str = String(property_layout.property_key);
      const ts_type = is_optional ? `${details.ts_type} | undefined` : details.ts_type;
      const little_endian_arg = details.needs_little_endian_arg ? ', LITTLE_ENDIAN' : '';

      const comment_block = property_layout.description
         ? `\
   /**
    * ${property_layout.description.replace(/\n/g, '\n    * ')}
    */\
`
         : '';

      if (
         property_layout.bit_width != null
         && property_layout.bit_offset != null
      ) {
         const getter_logic = `\
      const container_offset = this.__byte_offset + ${property_layout.offset};
      const container_value = this.__view.getUint32(container_offset, true);
      const value = (container_value >> ${property_layout.bit_offset}) & ((1 << ${property_layout.bit_width}) - 1);
`;
         const return_statement = details.data_type === 'boolean' ? 'return !!value;' : 'return value;';

         return `\
${comment_block}
   get ${prop_key_str}(): ${ts_type} {
${getter_logic}
      ${return_statement}
   }\
`;
      }

      if (is_optional) {
         return `\
${comment_block}
   get ${prop_key_str}(): ${ts_type} {
      const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;
      const presence_flag = this.__view.getUint8(this.__byte_offset + prop_schema.offset);

      if (presence_flag === 0) {
         return null;
      }

      const data_offset = (this.__byte_offset + prop_schema.offset + 1 + (prop_schema.alignment - 1)) & ~(prop_schema.alignment - 1);

      return ${details.data_type === 'boolean'
               ? `!!this.__view.${details.getter}(data_offset${little_endian_arg})`
               : `this.__view.${details.getter}(data_offset${little_endian_arg})`};
   }\
`;
      } else {
         return `\
${comment_block}
   get ${prop_key_str}(): ${ts_type} {
      const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;

      return ${details.data_type === 'boolean'
               ? `!!this.__view.${details.getter}(this.__byte_offset + prop_schema.offset${little_endian_arg})`
               : `this.__view.${details.getter}(this.__byte_offset + prop_schema.offset${little_endian_arg})`};
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
      const is_optional = property_layout.binary_info.is_optional;
      const base_type_str = property_layout.type;
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(base_type_str);

      if (!details) {
         throw new Error(`no details found for primitive type '${base_type_str}' during setter generation`);
      }

      const prop_key_str = String(property_layout.property_key);
      const little_endian_arg = details.needs_little_endian_arg ? ', LITTLE_ENDIAN' : '';

      const setter_param = is_optional ? `value?: ${details.ts_type}` : `value: ${details.ts_type}`;

      if (
         property_layout.bit_width != null
         && property_layout.bit_offset != null
      ) {
         const value_to_set = details.data_type === 'boolean' ? 'value ? 1 : 0' : 'value';
         const bit_width = property_layout.bit_width;
         const bit_offset = property_layout.bit_offset;
         const max_val = (1 << bit_width) - 1;

         let safety_check = '';

         if (details.data_type === 'integer') {
            safety_check = `\
      if (
         typeof value !== 'number'
         || value < 0
         || value > ${max_val}
      ) {
         throw new RangeError(\`value for '${prop_key_str}' (\${value}) is out of range for a ${bit_width}-bit field (0-${max_val})\`);
      }\
`;
         } else if (details.data_type === 'boolean') {
            safety_check = `\
      if (typeof value !== 'boolean') {
         throw new TypeError(\`value for '${prop_key_str}' (\${value}) must be a boolean\`);
      }\
`;
         }

         const setter_logic = `\
      const container_offset = this.__byte_offset + ${property_layout.offset};
      const current_container_value = this.__view.getUint32(container_offset, true);
      const value_mask = (1 << ${bit_width}) - 1;
      const cleared_container = current_container_value & ~(value_mask << ${bit_offset});
      const new_container_value = cleared_container | ((${value_to_set} & value_mask) << ${bit_offset});

      this.__view.setUint32(container_offset, new_container_value, true);\
`;

         return `\
   ${setter_access} ${prop_key_str}(value: ${details.ts_type}) {
      //\/ #if SAFETY
${safety_check}
      //\/ #endif

${setter_logic}
   }\
`;
      }

      const value_to_set = details.data_type === 'boolean' ? 'value ? 1 : 0' : 'value';

      if (is_optional) {
         return `\
   ${setter_access} ${prop_key_str}(${setter_param}) {
      const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;

      if (value == null) {
         this.__view.setUint8(this.__byte_offset + prop_schema.offset, 0);

         return;
      }

      this.__view.setUint8(this.__byte_offset + prop_schema.offset, 1);
      const data_offset = (this.__byte_offset + prop_schema.offset + 1 + (prop_schema.alignment - 1)) & ~(prop_schema.alignment - 1);

      this.__view.${details.setter}(data_offset, ${value_to_set}${little_endian_arg});
   }\
`;
      } else {
         let safety_check = '';

         switch (details.data_type) {
            case 'boolean': {
               safety_check = `\
      if (typeof value !== 'boolean') {
         throw new TypeError(\`value for '${prop_key_str}' (\${value}) must be a boolean for type ${base_type_str}\`);
      }\
`;

               break;
            }

            case 'integer': {
               let condition = '';
               let min_val_str = String(details.min_value);
               let max_val_str = String(details.max_value);

               if (details.ts_type === 'bigint') {
                  condition = `\
         typeof value !== 'bigint'
         || value < ${min_val_str}n
         || value > ${max_val_str}n\
`;
                  min_val_str += 'n';
                  max_val_str += 'n';
               } else {
                  condition = `\
         typeof value !== 'number'
         || !Number.isInteger(value)
         || !Number.isFinite(value)
         || value < ${min_val_str}
         || value > ${max_val_str}\
`;
               }

               safety_check = `\
      if (
${condition}
      ) {
         throw new RangeError(\`value for '${prop_key_str}' (\${value}) is out of range for ${base_type_str} (${min_val_str}-${max_val_str})\`);
      }\
`;
               break;
            }

            case 'float': {

               safety_check = `\
      if (
         typeof value !== 'number' 
         || !Number.isFinite(value)
      ) {
         throw new TypeError(\`value for '${prop_key_str}' (\${value}) must be a finite number for type ${base_type_str}\`);
      }\
`;

               break;
            }
         }

         return `\
   ${setter_access} ${prop_key_str}(${setter_param}) {
      //\/ #if SAFETY
${safety_check}
      //\/ #endif

      const prop_schema = ${class_name}.__schema.properties[${property_layout.order}]!;

      this.__view.${details.setter}(this.__byte_offset + prop_schema.offset, ${value_to_set}${little_endian_arg});
   }\
`;
      }
   }

   get_required_imports(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): Set<string> {
      return new Set<string>();
   }

   generate_free_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined {
      return;
   }

   generate_hash_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(property_layout.type)!;

      if (details.ts_type === 'bigint') {
         return `\
      hash = (hash * 31 + Number(this.${prop_key_str} ?? 0n)) | 0;\
`;
      }

      return `\
      hash = (hash * 31 + (this.${prop_key_str} ?? 0)) | 0;\
`;
   }

   generate_equals_statement(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
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
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(variant.type_string)!;
      const little_endian_arg = details.needs_little_endian_arg ? ', LITTLE_ENDIAN' : '';
      const getter_call = `this.__view.${details.getter}(data_offset${little_endian_arg})`;
      const final_return = details.data_type === 'boolean' ? `!!(${getter_call})` : getter_call;

      return `\
            case ${variant.tag}: {
               return ${final_return};
            }\
`;
   }

   generate_union_setter_case(
      strategy: ICodegenStrategy,
      variant: UnionVariantMetadata,
      property_layout: PropertyLayout,
      class_name: string
   ): string | undefined {
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(variant.type_string)!;
      const ts_type = details.ts_type;
      const little_endian_arg = details.needs_little_endian_arg ? ', LITTLE_ENDIAN' : '';
      const value_to_set = details.data_type === 'boolean' ? 'value ? 1 : 0' : 'value';

      return `\
      if (typeof value === '${ts_type}') {
         new_tag = ${variant.tag};

         if (current_tag !== new_tag) {
            free_and_clear_current();

            this.__view.setUint8(tag_offset, new_tag);
         }

         this.__view.${details.setter}(data_offset, ${value_to_set}${little_endian_arg});
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