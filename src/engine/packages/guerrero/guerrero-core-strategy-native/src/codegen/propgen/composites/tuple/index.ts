/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core-strategy-native/src/codegen/propgen/composites/tuple/index.ts
 */

import type { PropertyLayout } from '@eldritch-engine/type-utils/guerrero/index';
import type { ICodegenStrategy, IPropertyCodegen } from '@eldritch-engine/type-utils/guerrero/codegen';
import type { TypeNode, TupleTypeNode } from '@eldritch-engine/type-utils/guerrero/parser';

import { TypeParser, stringify_type_node } from '@eldritch-engine/guerrero-core/layout/parser/parser';
import { FIXED_PRIMITIVE_TYPE_DETAILS } from '@eldritch-engine/guerrero-core/layout/constants';

export class TuplePropgen implements IPropertyCodegen {

   can_handle(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): boolean {
      return property_layout.binary_info.is_tuple ?? false;
   }

   get_required_imports(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): Set<string> {
      const node = new TypeParser(property_layout.type).parse() as TupleTypeNode;
      const imports = new Set<string>();

      for (const element_type of node.element_types) {
         if (element_type.kind === 'identifier') {
            imports.add(element_type.name);
         }
      }

      return imports;
   }

   #get_native_type_str(
      node: TypeNode
   ): string {
      const type_str = stringify_type_node(node);

      if (FIXED_PRIMITIVE_TYPE_DETAILS.has(type_str)) {
         return FIXED_PRIMITIVE_TYPE_DETAILS.get(type_str)!.ts_type;
      }

      if (type_str === 'str') {
         return 'string';
      }

      if (node.kind === 'identifier') {
         return node.name;
      }

      return 'any';
   }

   generate_private_view_field(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string | undefined {
      const prop_key_str = String(property_layout.property_key);
      const node = new TypeParser(property_layout.type).parse() as TupleTypeNode;

      const types = node.element_types.map(el_node => this.#get_native_type_str(el_node)).join(', ');

      return `\
   #${prop_key_str}: [${types}];
`;
   }

   generate_getter(
      strategy: ICodegenStrategy,
      property_layout: PropertyLayout
   ): string {
      const prop_key_str = String(property_layout.property_key);
      const node = new TypeParser(property_layout.type).parse() as TupleTypeNode;
      const types = node.element_types.map(el => this.#get_native_type_str(el)).join(', ');

      return `\
   get ${prop_key_str}(): [${types}] {
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
      const node = new TypeParser(property_layout.type).parse() as TupleTypeNode;
      const types = node.element_types.map(el => this.#get_native_type_str(el)).join(', ');

      return `\
   ${setter_access} ${prop_key_str}(value: [${types}]) {
      this.#${prop_key_str} = value;
   }\
`;
   }
}