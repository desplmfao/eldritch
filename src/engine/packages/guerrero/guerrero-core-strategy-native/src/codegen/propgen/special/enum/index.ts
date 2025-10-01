/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-native/src/codegen/propgen/special/enum/index.ts
 */

import type { PropertyLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';

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
      return new Set([property_layout.type]);
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

   generate_private_view_field(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);

      return `\
   #${prop_key_str}: ${property_layout.type};
`;
   }

   generate_getter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout,
      class_name: string
   ): string {
      const prop_key_str = String(property_layout.property_key);

      return `\
   get ${prop_key_str}(): ${property_layout.type} {
      return this.#${prop_key_str};
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
      const static_set_name = `$valid_${prop_key_str}_values`;

      const safety_check = `\
      if (!${class_name}.${static_set_name}.has(value)) {
         throw new RangeError(\`invalid value for enum '${property_layout.type}'. received '\${value}'\`);
      }\
`;
      return `\
   ${setter_access} ${prop_key_str}(value: ${property_layout.type}) {
      //\/ #if SAFETY
${safety_check}
      //\/ #endif

      this.#${prop_key_str} = value;
   }\
`;
   }
}