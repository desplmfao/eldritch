/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/type-utils/src/guerrero/parser.ts
 */

export type TypeNode =
   | PrimitiveTypeNode
   | IdentifierTypeNode
   | FixedArrayTypeNode
   | DynamicArrayTypeNode
   | MapTypeNode
   | SetTypeNode
   | SparseSetTypeNode
   | UnionTypeNode
   | TupleTypeNode
   | NullTypeNode;

export interface BaseTypeNode {
   kind: string;
}

export interface PrimitiveTypeNode extends BaseTypeNode {
   kind: 'primitive';
   name: string;
}

export interface IdentifierTypeNode extends BaseTypeNode {
   kind: 'identifier';
   name: string;
}

export interface FixedArrayTypeNode extends BaseTypeNode {
   kind: 'fixed_array';
   element_type: TypeNode;
   count: number;
}

export interface TupleTypeNode extends BaseTypeNode {
   kind: 'tuple';
   element_types: TypeNode[];
}

export interface DynamicArrayTypeNode extends BaseTypeNode {
   kind: 'dynamic_array';
   element_type: TypeNode;
}

export interface MapTypeNode extends BaseTypeNode {
   kind: 'map';
   key_type: TypeNode;
   value_type: TypeNode;
}

export interface SetTypeNode extends BaseTypeNode {
   kind: 'set';
   element_type: TypeNode;
}

export interface SparseSetTypeNode extends BaseTypeNode {
   kind: 'sparseset';
}

export interface UnionTypeNode extends BaseTypeNode {
   kind: 'union';
   variants: TypeNode[];
}

export interface NullTypeNode extends BaseTypeNode {
   kind: 'null';
}