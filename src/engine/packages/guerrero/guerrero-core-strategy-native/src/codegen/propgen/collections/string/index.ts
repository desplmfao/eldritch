/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-native/src/codegen/propgen/collections/string/index.ts
 */

import type { PropertyLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';

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
      return new Set();
   }

   generate_private_view_field(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const is_optional = property_layout.binary_info.is_optional;
      const type_name = is_optional ? 'string | undefined' : 'string';

      return `\
   #${prop_key_str}: ${type_name};
`;
   }

   generate_getter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string {
      const prop_key_str = String(property_layout.property_key);
      const is_optional = property_layout.binary_info.is_optional;
      const type_name = is_optional ? 'string | undefined' : 'string';

      return `\
   get ${prop_key_str}(): ${type_name} {
      return this.#${prop_key_str};
   }\
`;
   }

   generate_setter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string {
      const setter_access = property_layout.read_only ? 'private set' : 'set';
      const prop_key_str = String(property_layout.property_key);
      const is_optional = property_layout.binary_info.is_optional;
      const property_setter = is_optional ? 'value?: string' : 'value: string';

      return `\
   ${setter_access} ${prop_key_str}(${property_setter}) {
      this.#${prop_key_str} = value;
   }\
`;
   }
}