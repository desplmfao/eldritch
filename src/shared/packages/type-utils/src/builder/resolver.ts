/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/type-utils/src/builder/resolver.ts
 */

import type { SchemaLayout, BinaryTypeInfo, MetadataProperty } from '@self/guerrero/index';
import type { TypeNode } from '@self/guerrero/parser';

/**
 * a rich, resolved object containing all necessary build-time information about a guerrero type string
 */
export interface ResolvedTypeInfo {
   /** the parsed abstract syntax tree node for the type */
   readonly type_node: TypeNode;
   /** the pre-calculated schema layout if this is a user-defined struct or enum */
   readonly schema_layout?: SchemaLayout;
   /** the calculated binary characteristics (size, alignment, etc.) */
   readonly binary_type_info: BinaryTypeInfo;
   /** a canonical string representation of the type */
   readonly canonical_string: string;
}

/**
 * the interface for the unified type resolver
 */
export interface ITypeResolver {
   /**
    * resolves a guerrero type string into a rich information object
    *
    * @param type_string the type string to resolve (e.g., 'u32', 'MyStruct[] | null')
    * @param is_optional_from_prop indicates if the property was marked with '?'
    * @param prop_metadata optional metadata from the property, used for context (e.g., enum base type)
    *
    * @returns a `ResolvedTypeInfo` object
    */
   resolve(
      type_string: string,
      is_optional_from_prop?: boolean,
      prop_metadata?: MetadataProperty
   ): ResolvedTypeInfo;
}