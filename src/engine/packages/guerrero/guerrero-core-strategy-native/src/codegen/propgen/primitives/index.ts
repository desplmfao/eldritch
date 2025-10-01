/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-native/src/codegen/propgen/primitives/index.ts
 */

import type { PropertyLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';

import { FIXED_PRIMITIVE_TYPE_DETAILS, FIXED_PRIMITIVE_TYPES } from '@eldritch-engine/guerrero-core/layout/constants';

export class FixedPrimitivePropgen implements IPropertyCodegen {
   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean {
      return FIXED_PRIMITIVE_TYPES.has(property_layout.type)
         && !property_layout.binary_info.is_dynamic
         && !property_layout.binary_info.is_nested_struct
         && property_layout.binary_info.element_count == null;
   }

   get_required_imports(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): Set<string> {
      return new Set<string>();
   }

   generate_private_view_field(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(property_layout.type)!;
      const is_optional = property_layout.binary_info.is_optional;
      const type_name = is_optional ? `${details.ts_type}` : details.ts_type;

      return `\
   #${prop_key_str}?: ${type_name};
`;
   }

   generate_getter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const prop_key_str = String(property_layout.property_key);
      const private_field = `#${prop_key_str}`;
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(property_layout.type)!;
      const is_optional = property_layout.binary_info.is_optional;
      const ts_type = is_optional ? `${details.ts_type} | undefined` : details.ts_type;

      const comment_block = property_layout.description
         ? `\
   /**
    * ${property_layout.description.replace(/\n/g, '\n    * ')}
    */\
`
         : '';

      return `\
${comment_block}
   get ${prop_key_str}(): ${ts_type} {
      return this.${private_field};
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
      const private_field = `#${prop_key_str}`;
      const details = FIXED_PRIMITIVE_TYPE_DETAILS.get(property_layout.type)!;
      const is_optional = property_layout.binary_info.is_optional;
      const ts_type = is_optional ? `${details.ts_type} | undefined` : details.ts_type;

      let safety_check = '';
      const value_check_start = is_optional ? 'if (value != null) {\n' : '';
      const value_check_end = is_optional ? '\n}' : '';

      switch (details.data_type) {
         case 'boolean': {
            safety_check = `\
      if (typeof value !== 'boolean') {
         throw new TypeError(\`value for '${prop_key_str}' (\${value}) must be a boolean for type ${property_layout.type}\`);
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
         throw new RangeError(\`value for '${prop_key_str}' (\${value}) is out of range for ${property_layout.type} (${min_val_str}-${max_val_str})\`);
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
         throw new TypeError(\`value for '${prop_key_str}' (\${value}) must be a finite number for type ${property_layout.type}\`);
      }\
`;
            break;
         }
      }

      return `\
   ${setter_access} ${prop_key_str}(value: ${ts_type}) {
      //\/ #if SAFETY
${value_check_start}
${safety_check.split('\n').map(l => '   ' + l).join('\n').trimStart()}
${value_check_end}
      //\/ #endif

      this.${private_field} = value;
   }\
`;
   }
}