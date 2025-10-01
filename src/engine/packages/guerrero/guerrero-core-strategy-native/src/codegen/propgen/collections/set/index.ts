/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-native/src/codegen/propgen/collections/set/index.ts
 */

import type { PropertyLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { SetTypeNode } from '@eldritch-engine/type-utils/guerrero/parser';

import { TypeParser } from '@eldritch-engine/guerrero-core/layout/parser/parser';

export class DynamicSetPropgen implements IPropertyCodegen {

   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean {
      return new TypeParser(property_layout.type).parse().kind === 'set';
   }

   get_required_imports(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): Set<string> {
      const node = new TypeParser(property_layout.type).parse() as SetTypeNode;
      const imports = new Set(['DeepSet']);

      if (node.element_type.kind === 'identifier') {
         imports.add(node.element_type.name);
      }

      return imports;
   }

   generate_private_view_field(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);

      return `\
   #${prop_key_str}: DeepSet<any>;
`;
   }

   generate_getter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string {
      const prop_key_str = String(property_layout.property_key);

      return `\
   get ${prop_key_str}(): DeepSet<any> {
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

      return `\
   ${setter_access} ${prop_key_str}(value: DeepSet<any>) {
      this.#${prop_key_str} = value;
   }\
`;
   }
}